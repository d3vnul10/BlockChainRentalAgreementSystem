export const RENTAL_FACTORY_ABI = [
  "function createAgreement(address tenant, uint256 monthlyRent, uint256 securityDeposit, uint256 startDate, uint256 endDate, string propertyId, string ipfsDocumentHash) external returns (address)",
  "function getDeployedAgreements() external view returns (address[])",
  "function getLandlordAgreements(address landlord) external view returns (address[])",
  "function getTenantAgreements(address tenant) external view returns (address[])",
  "function paymentHandler() external view returns (address)",
  "function depositManager() external view returns (address)",
  "function penaltyEngine() external view returns (address)",
  "function disputeResolution() external view returns (address)",
  "event AgreementDeployed(address indexed agreementAddress, address indexed landlord, address indexed tenant, string propertyId)"
];

export const RENTAL_AGREEMENT_ABI = [
  "function getAgreementDetails() external view returns (tuple(string propertyId, string ipfsDocumentHash, uint256 monthlyRent, uint256 securityDeposit, uint256 lateFeePercentage, uint256 gracePeriodDays, uint256 startDate, uint256 endDate, uint256 lastPaymentDate, uint256 nextPaymentDue, uint8 state, uint8 latePaymentCount))",
  "function payRent() external payable",
  "function fileDispute(string reason) external",
  "function initiateTermination(uint8 reason) external",
  "function returnDeposit(uint256 amount, string reason) external",
  "function getLandlord() external view returns (address)",
  "function getTenant() external view returns (address)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function LANDLORD_ROLE() external view returns (bytes32)",
  "function TENANT_ROLE() external view returns (bytes32)",
  "function penaltyEngine() external view returns (address)",
  "function disputeResolution() external view returns (address)",
  "event RentPaid(uint256 amount, uint256 timestamp, uint256 nextDueDate)",
  "event LatePayment(uint256 penalty, uint256 timestamp)",
  "event DisputeFiled(bytes32 disputeId, string reason)",
  "event AgreementTerminated(uint256 timestamp, uint8 reason)",
  "event StateChanged(uint8 oldState, uint8 newState)"
];

export const PENALTY_ENGINE_ABI = [
  "function calculateLatePenalty(uint256 rentAmount, uint256 lateFeePercentage, uint256 secondsLate) public pure returns (uint256)"
];

export const AGREEMENT_STATES = [
  "DRAFT", "ACTIVE", "IN_ARREARS", "DISPUTED", "TERMINATING", "COMPLETED", "BREACHED"
];

export const STATE_COLORS = {
  0: "#6B7280", // DRAFT - gray
  1: "#10B981", // ACTIVE - green
  2: "#F59E0B", // IN_ARREARS - amber
  3: "#EF4444", // DISPUTED - red
  4: "#8B5CF6", // TERMINATING - purple
  5: "#3B82F6", // COMPLETED - blue
  6: "#DC2626", // BREACHED - dark red
};
