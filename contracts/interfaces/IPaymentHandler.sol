// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// contracts/interfaces/IPaymentHandler.sol
interface IPaymentHandler {
    function processPayment(
        address agreement,
        address payee,
        uint256 baseAmount,
        uint256 penalty
    ) external payable;
    
    function processDeposit(
        address agreement,
        uint256 depositAmount
    ) external payable;
}
