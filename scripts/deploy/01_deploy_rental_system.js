// scripts/deploy/01_deploy_rental_system.js
const hre = require("hardhat");

async function main() {
    const [deployer, platformWallet] = await hre.ethers.getSigners();

    console.log("Deploying with account:", deployer.address);

    const RentalFactory = await hre.ethers.getContractFactory("RentalFactory");
    const factory = await RentalFactory.deploy(
        platformWallet.address,
        100
    );

    // ethers v6: waitForDeployment() replaces deployed()
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("RentalFactory deployed to:", factoryAddress);

    const paymentHandler = await factory.paymentHandler();
    const depositManager = await factory.depositManager();
    const penaltyEngine = await factory.penaltyEngine();
    const disputeResolution = await factory.disputeResolution();

    console.log("PaymentHandler:", paymentHandler);
    console.log("DepositManager:", depositManager);
    console.log("PenaltyEngine:", penaltyEngine);
    console.log("DisputeResolution:", disputeResolution);

    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        await hre.run("verify:verify", {
            address: paymentHandler,
            constructorArguments: [platformWallet.address, 100],
        });

        await hre.run("verify:verify", {
            address: depositManager,
            constructorArguments: [],
        });

        await hre.run("verify:verify", {
            address: penaltyEngine,
            constructorArguments: [],
        });

        await hre.run("verify:verify", {
            address: disputeResolution,
            constructorArguments: [],
        });
    }

    return {
        factory: factoryAddress,
        paymentHandler,
        depositManager,
        penaltyEngine,
        disputeResolution
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
