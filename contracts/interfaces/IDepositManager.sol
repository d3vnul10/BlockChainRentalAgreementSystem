// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// contracts/interfaces/IDepositManager.sol
interface IDepositManager {
    enum DepositStatus {
        NONE,
        LOCKED,
        PARTIALLY_RETURNED,
        RETURNED,
        FORFEITED
    }

    function lockDeposit(
        address agreement,
        address tenant,
        address landlord,
        uint256 amount
    ) external payable;
    
    function makeDeduction(
        address agreement,
        uint256 amount,
        string memory reason
    ) external;
    
    function returnDeposit(
        address agreement,
        address recipient,
        uint256 amount,
        string memory reason
    ) external;
}
