// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// contracts/core/RentalAgreement.sol
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../modules/PaymentHandler.sol";
import "../modules/DepositManager.sol";
import "../modules/PenaltyEngine.sol";
import "../modules/DisputeResolution.sol";
import "../interfaces/IRentalAgreement.sol";

contract RentalAgreement is
    IRentalAgreement,
    ReentrancyGuard,
    AccessControlEnumerable,
    Pausable
{
    bytes32 public constant LANDLORD_ROLE = keccak256("LANDLORD_ROLE");
    bytes32 public constant TENANT_ROLE = keccak256("TENANT_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    PaymentHandler public paymentHandler;
    DepositManager public depositManager;
    PenaltyEngine public penaltyEngine;
    DisputeResolution public disputeResolution;

    // Store landlord/tenant explicitly to avoid stack issues with getRoleMember
    address private _landlord;
    address private _tenant;

    struct AgreementDetails {
        string propertyId;
        string ipfsDocumentHash;
        uint256 monthlyRent;
        uint256 securityDeposit;
        uint256 lateFeePercentage;
        uint256 gracePeriodDays;
        uint256 startDate;
        uint256 endDate;
        uint256 lastPaymentDate;
        uint256 nextPaymentDue;
        AgreementState state;
        uint8 latePaymentCount;
    }

    AgreementDetails public agreement;

    event RentPaid(uint256 amount, uint256 timestamp, uint256 nextDueDate);
    event LatePayment(uint256 penalty, uint256 timestamp);
    event DepositWithdrawn(uint256 amount, string reason);
    event DisputeFiled(bytes32 disputeId, string reason);
    event AgreementTerminated(uint256 timestamp, TerminationReason reason);
    event StateChanged(AgreementState oldState, AgreementState newState);

    modifier onlyTenant() {
        require(hasRole(TENANT_ROLE, msg.sender), "Caller is not tenant");
        _;
    }

    modifier onlyLandlord() {
        require(hasRole(LANDLORD_ROLE, msg.sender), "Caller is not landlord");
        _;
    }

    modifier inState(AgreementState _state) {
        require(agreement.state == _state, "Invalid agreement state");
        _;
    }

    constructor(
        address tenantAddr,
        address landlordAddr,
        uint256 monthlyRent,
        uint256 securityDeposit,
        uint256 startDate,
        uint256 endDate,
        string memory propertyId,
        string memory ipfsDocumentHash,
        address paymentHandlerAddr,
        address depositManagerAddr,
        address penaltyEngineAddr,
        address disputeResolutionAddr
    ) {
        require(tenantAddr != address(0) && landlordAddr != address(0), "Invalid addresses");
        require(monthlyRent > 0, "Rent must be greater than 0");
        require(endDate > startDate, "Invalid dates");

        _grantRole(DEFAULT_ADMIN_ROLE, landlordAddr);
        _grantRole(LANDLORD_ROLE, landlordAddr);
        _grantRole(TENANT_ROLE, tenantAddr);

        _landlord = landlordAddr;
        _tenant = tenantAddr;

        paymentHandler = PaymentHandler(paymentHandlerAddr);
        depositManager = DepositManager(payable(depositManagerAddr));
        penaltyEngine = PenaltyEngine(penaltyEngineAddr);
        disputeResolution = DisputeResolution(disputeResolutionAddr);

        agreement = AgreementDetails({
            propertyId: propertyId,
            ipfsDocumentHash: ipfsDocumentHash,
            monthlyRent: monthlyRent,
            securityDeposit: securityDeposit,
            lateFeePercentage: 500,
            gracePeriodDays: 5 days,
            startDate: startDate,
            endDate: endDate,
            lastPaymentDate: 0,
            nextPaymentDue: startDate + 30 days,
            state: AgreementState.ACTIVE,
            latePaymentCount: 0
        });
    }

    function payRent() external payable override nonReentrant onlyTenant inState(AgreementState.ACTIVE) {
        uint256 paymentAmount = agreement.monthlyRent;
        uint256 penalty = 0;

        if (block.timestamp > agreement.nextPaymentDue + agreement.gracePeriodDays) {
            penalty = penaltyEngine.calculateLatePenalty(
                agreement.monthlyRent,
                agreement.lateFeePercentage,
                block.timestamp - agreement.nextPaymentDue
            );
            paymentAmount += penalty;
            agreement.latePaymentCount++;
            emit LatePayment(penalty, block.timestamp);
        }

        require(msg.value >= paymentAmount, "Insufficient payment");

        paymentHandler.processPayment{value: msg.value}(
            address(this),
            _landlord,
            agreement.monthlyRent,
            penalty
        );

        agreement.lastPaymentDate = block.timestamp;
        agreement.nextPaymentDue = block.timestamp + 30 days;

        emit RentPaid(msg.value, block.timestamp, agreement.nextPaymentDue);

        if (agreement.state == AgreementState.IN_ARREARS) {
            _updateState(AgreementState.ACTIVE);
        }
    }

    function initiateTermination(TerminationReason reason)
        external
        override
        inState(AgreementState.ACTIVE)
    {
        require(
            hasRole(TENANT_ROLE, msg.sender) || hasRole(LANDLORD_ROLE, msg.sender),
            "Unauthorized"
        );

        if (reason == TerminationReason.MUTUAL_AGREEMENT) {
            _updateState(AgreementState.TERMINATING);
        } else if (reason == TerminationReason.LANDLORD_BREACH) {
            require(hasRole(TENANT_ROLE, msg.sender), "Only tenant can claim breach");
            _updateState(AgreementState.DISPUTED);
            disputeResolution.fileDispute("Landlord breach of contract", msg.sender, address(this));
        } else if (reason == TerminationReason.TENANT_BREACH) {
            require(hasRole(LANDLORD_ROLE, msg.sender), "Only landlord can claim breach");
            _updateState(AgreementState.DISPUTED);
            disputeResolution.fileDispute("Tenant breach of contract", msg.sender, address(this));
        }

        emit AgreementTerminated(block.timestamp, reason);
    }

    function returnDeposit(
        uint256 amount,
        string memory reason
    ) external override onlyLandlord nonReentrant {
        require(
            agreement.state == AgreementState.TERMINATING ||
            agreement.state == AgreementState.COMPLETED,
            "Cannot return deposit now"
        );

        depositManager.returnDeposit(address(this), _tenant, amount, reason);
        emit DepositWithdrawn(amount, reason);

        if (agreement.state == AgreementState.TERMINATING) {
            _updateState(AgreementState.COMPLETED);
        }
    }

    function fileDispute(string memory reason)
        external
        override
        inState(AgreementState.ACTIVE)
    {
        require(
            hasRole(TENANT_ROLE, msg.sender) || hasRole(LANDLORD_ROLE, msg.sender),
            "Unauthorized"
        );

        bytes32 disputeId = disputeResolution.fileDispute(reason, msg.sender, address(this));
        _updateState(AgreementState.DISPUTED);
        emit DisputeFiled(disputeId, reason);
    }

    function resolveDispute(bytes32 disputeId, bool inFavorOfTenant)
        external
        onlyRole(ARBITRATOR_ROLE)
        inState(AgreementState.DISPUTED)
    {
        disputeResolution.resolveDispute(disputeId, inFavorOfTenant);

        address recipient = inFavorOfTenant ? _tenant : _landlord;
        string memory resolutionNote = inFavorOfTenant
            ? "Dispute resolution"
            : "Dispute resolution against tenant";

        depositManager.returnDeposit(address(this), recipient, agreement.securityDeposit, resolutionNote);
        _updateState(AgreementState.TERMINATING);
    }

    function checkArrears() external onlyLandlord {
        if (block.timestamp > agreement.nextPaymentDue + agreement.gracePeriodDays) {
            if (agreement.latePaymentCount >= 3) {
                _updateState(AgreementState.BREACHED);
            } else {
                _updateState(AgreementState.IN_ARREARS);
            }
        }
    }

    function getLandlord() public view returns (address) {
        return _landlord;
    }

    function getTenant() public view returns (address) {
        return _tenant;
    }

    function getAgreementDetails()
        external
        view
        returns (AgreementDetails memory)
    {
        return agreement;
    }

    function _updateState(AgreementState newState) private {
        emit StateChanged(agreement.state, newState);
        agreement.state = newState;
    }

    receive() external payable {
        revert("Direct ETH transfer not allowed");
    }
}
