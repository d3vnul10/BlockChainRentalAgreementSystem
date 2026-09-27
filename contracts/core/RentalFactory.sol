// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// contracts/core/RentalFactory.sol
import "./RentalAgreement.sol";
import "../modules/PaymentHandler.sol";
import "../modules/DepositManager.sol";
import "../modules/PenaltyEngine.sol";
import "../modules/DisputeResolution.sol";

contract RentalFactory {
    address[] public deployedAgreements;
    mapping(address => address[]) public landlordAgreements;
    mapping(address => address[]) public tenantAgreements;
    
    PaymentHandler public paymentHandler;
    DepositManager public depositManager;
    PenaltyEngine public penaltyEngine;
    DisputeResolution public disputeResolution;

    event AgreementDeployed(
        address indexed agreementAddress,
        address indexed landlord,
        address indexed tenant,
        string propertyId
    );

    constructor(
        address _platformWallet,
        uint256 _platformFee
    ) {
        paymentHandler = new PaymentHandler(_platformWallet, _platformFee);
        depositManager = new DepositManager();
        penaltyEngine = new PenaltyEngine();
        disputeResolution = new DisputeResolution();

        depositManager.grantRole(
            depositManager.RENTAL_AGREEMENT_ROLE(), 
            address(this)
        );
    }

    function createAgreement(
        address _tenant,
        uint256 _monthlyRent,
        uint256 _securityDeposit,
        uint256 _startDate,
        uint256 _endDate,
        string memory _propertyId,
        string memory _ipfsDocumentHash
    ) external returns (address) {
        RentalAgreement newAgreement = new RentalAgreement(
            _tenant,
            msg.sender,
            _monthlyRent,
            _securityDeposit,
            _startDate,
            _endDate,
            _propertyId,
            _ipfsDocumentHash,
            address(paymentHandler),
            address(depositManager),
            address(penaltyEngine),
            address(disputeResolution)
        );

        depositManager.grantRole(
            depositManager.RENTAL_AGREEMENT_ROLE(),
            address(newAgreement)
        );

        deployedAgreements.push(address(newAgreement));
        landlordAgreements[msg.sender].push(address(newAgreement));
        tenantAgreements[_tenant].push(address(newAgreement));

        emit AgreementDeployed(
            address(newAgreement),
            msg.sender,
            _tenant,
            _propertyId
        );

        return address(newAgreement);
    }

    function getDeployedAgreements() external view returns (address[] memory) {
        return deployedAgreements;
    }

    function getLandlordAgreements(address landlord) 
        external 
        view 
        returns (address[] memory) 
    {
        return landlordAgreements[landlord];
    }

    function getTenantAgreements(address tenant) 
        external 
        view 
        returns (address[] memory) 
    {
        return tenantAgreements[tenant];
    }
}
