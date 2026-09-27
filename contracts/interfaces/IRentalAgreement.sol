// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// contracts/interfaces/IRentalAgreement.sol
interface IRentalAgreement {
    enum AgreementState {
        DRAFT,
        ACTIVE,
        IN_ARREARS,
        DISPUTED,
        TERMINATING,
        COMPLETED,
        BREACHED
    }

    enum TerminationReason {
        MUTUAL_AGREEMENT,
        LANDLORD_BREACH,
        TENANT_BREACH,
        NON_PAYMENT,
        PROPERTY_DAMAGE
    }

    function payRent() external payable;
    function initiateTermination(TerminationReason reason) external;
    function returnDeposit(uint256 amount, string memory reason) external;
    function fileDispute(string memory reason) external;
}
