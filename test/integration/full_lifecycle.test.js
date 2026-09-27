// test/integration/full_lifecycle.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Rental Agreement Full Lifecycle", function () {
    let factory;
    let agreement;
    let disputeResolutionContract;
    let landlord;
    let tenant;
    let arbitrator;
    let platformWallet;

    const monthlyRent = ethers.parseEther("1");
    const securityDeposit = ethers.parseEther("3");

    beforeEach(async function () {
        [landlord, tenant, arbitrator, platformWallet] = await ethers.getSigners();

        const RentalFactory = await ethers.getContractFactory("RentalFactory");
        factory = await RentalFactory.deploy(platformWallet.address, 100);
        await factory.waitForDeployment();

        const startDate = Math.floor(Date.now() / 1000);
        const endDate = startDate + 365 * 24 * 60 * 60;

        const tx = await factory.connect(landlord).createAgreement(
            tenant.address,
            monthlyRent,
            securityDeposit,
            startDate,
            endDate,
            "PROP-001",
            "QmHash123"
        );

        const receipt = await tx.wait();

        const factoryInterface = factory.interface;
        const log = receipt.logs.find(l => {
            try { return factoryInterface.parseLog(l)?.name === "AgreementDeployed"; }
            catch { return false; }
        });
        const agreementAddress = factoryInterface.parseLog(log).args.agreementAddress;
        agreement = await ethers.getContractAt("RentalAgreement", agreementAddress);

        // Get the shared DisputeResolution contract deployed by the factory
        const drAddress = await factory.disputeResolution();
        disputeResolutionContract = await ethers.getContractAt("DisputeResolution", drAddress);
    });

    describe("Agreement Creation", function () {
        it("Should create agreement with correct details", async function () {
            const details = await agreement.getAgreementDetails();
            expect(details.propertyId).to.equal("PROP-001");
            expect(details.monthlyRent).to.equal(monthlyRent);
        });

        it("Should assign correct roles", async function () {
            expect(await agreement.hasRole(await agreement.LANDLORD_ROLE(), landlord.address)).to.be.true;
            expect(await agreement.hasRole(await agreement.TENANT_ROLE(), tenant.address)).to.be.true;
        });
    });

    describe("Rent Payment", function () {
        it("Should accept rent payment", async function () {
            await expect(
                agreement.connect(tenant).payRent({ value: monthlyRent })
            ).to.emit(agreement, "RentPaid");
        });

        it("Should calculate late penalty", async function () {
            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine");

            const penaltyEngine = await ethers.getContractAt(
                "PenaltyEngine",
                await agreement.penaltyEngine()
            );

            const penalty = await penaltyEngine.calculateLatePenalty(
                monthlyRent,
                500,
                7 * 24 * 60 * 60
            );

            // Send exact amount (rent + penalty) so no refund path is triggered
            const totalPayment = monthlyRent + penalty;

            await expect(
                agreement.connect(tenant).payRent({ value: totalPayment })
            ).to.emit(agreement, "LatePayment");
        });
    });

    describe("Dispute Resolution", function () {
        it("Should file and resolve dispute", async function () {
            // Step 1: file dispute from agreement — captures the real disputeId from event
            const tx = await agreement.connect(tenant).fileDispute("Maintenance issue");
            const receipt = await tx.wait();

            // Extract the real disputeId from the DisputeFiled event
            const agreementInterface = agreement.interface;
            const disputeLog = receipt.logs.find(l => {
                try { return agreementInterface.parseLog(l)?.name === "DisputeFiled"; }
                catch { return false; }
            });
            const realDisputeId = agreementInterface.parseLog(disputeLog).args.disputeId;

            // Step 2: the factory deployer (landlord here) needs DEFAULT_ADMIN_ROLE on DisputeResolution
            // Factory constructor deploys DisputeResolution — factory IS the admin
            // We need to call assignArbitrator via the factory's deployer
            // DisputeResolution was deployed by the factory so factory has DEFAULT_ADMIN_ROLE
            // We must impersonate the factory to call assignArbitrator
            const factoryAddress = await factory.getAddress();
            await ethers.provider.send("hardhat_impersonateAccount", [factoryAddress]);
            await ethers.provider.send("hardhat_setBalance", [factoryAddress, "0x56BC75E2D63100000"]); // 100 ETH
            const factorySigner = await ethers.getSigner(factoryAddress);

            await disputeResolutionContract
                .connect(factorySigner)
                .assignArbitrator(realDisputeId, arbitrator.address);

            await ethers.provider.send("hardhat_stopImpersonatingAccount", [factoryAddress]);

            // Step 3: arbitrator resolves
            // RentalAgreement.resolveDispute requires ARBITRATOR_ROLE on the agreement too
            await agreement.connect(landlord).grantRole(
                await agreement.ARBITRATOR_ROLE(),
                arbitrator.address
            );

            await agreement
                .connect(arbitrator)
                .resolveDispute(realDisputeId, true);
        });
    });
});
