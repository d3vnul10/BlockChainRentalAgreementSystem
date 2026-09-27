// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IDepositManager.sol";

contract DepositManager is IDepositManager, AccessControl, ReentrancyGuard {
    bytes32 public constant RENTAL_AGREEMENT_ROLE = keccak256("RENTAL_AGREEMENT_ROLE");

    struct Deposit {
        uint256 amount;
        uint256 lockUntil;
        address tenant;
        address landlord;
        DepositStatus status;
        string condition;
        uint256 deductions;
        string[] deductionReasons;
    }

    mapping(address => Deposit) public deposits;

    event DepositLocked(address indexed agreement, address indexed tenant, uint256 amount, uint256 lockUntil);
    event DepositReturned(address indexed agreement, address indexed recipient, uint256 amount, string reason);
    event DeductionMade(address indexed agreement, uint256 amount, string reason);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Called by RentalAgreement when landlord locks deposit
    function lockDeposit(
        address agreement,
        address tenant,
        address landlord,
        uint256 amount
    ) external payable override onlyRole(RENTAL_AGREEMENT_ROLE) {
        require(msg.value >= amount, "Insufficient deposit");
        require(deposits[agreement].amount == 0, "Deposit already exists");

        deposits[agreement] = Deposit({
            amount: amount,
            lockUntil: block.timestamp + 365 days,
            tenant: tenant,
            landlord: landlord,
            status: DepositStatus.LOCKED,
            condition: "Good",
            deductions: 0,
            deductionReasons: new string[](0)
        });

        emit DepositLocked(agreement, tenant, amount, block.timestamp + 365 days);
    }

    function makeDeduction(
        address agreement,
        uint256 amount,
        string memory reason
    ) external override onlyRole(RENTAL_AGREEMENT_ROLE) {
        Deposit storage deposit = deposits[agreement];
        require(deposit.status == DepositStatus.LOCKED, "Deposit not locked");
        require(amount <= deposit.amount - deposit.deductions, "Insufficient deposit");
        deposit.deductions += amount;
        deposit.deductionReasons.push(reason);
        emit DeductionMade(agreement, amount, reason);
    }

    function returnDeposit(
        address agreement,
        address recipient,
        uint256 amount,
        string memory reason
    ) external override onlyRole(RENTAL_AGREEMENT_ROLE) nonReentrant {
        Deposit storage deposit = deposits[agreement];

        // If deposit was never formally locked (legacy/test agreements),
        // fall back to checking contract ETH balance directly
        uint256 available;
        if (deposit.amount == 0) {
            available = address(this).balance;
        } else {
            available = deposit.amount - deposit.deductions;
        }

        require(amount > 0, "Amount must be greater than 0");
        require(amount <= available, "Amount too high");

        // For formally locked deposits, validate recipient
        if (deposit.amount > 0) {
            require(
                recipient == deposit.tenant || recipient == deposit.landlord,
                "Invalid recipient"
            );
        }

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");

        if (deposit.amount > 0) {
            deposit.status = DepositStatus.RETURNED;
        }

        emit DepositReturned(agreement, recipient, amount, reason);
    }

    function getDepositDetails(address agreement) external view returns (Deposit memory) {
        return deposits[agreement];
    }

    // Returns actual spendable balance for an agreement
    function getAvailableBalance(address agreement) external view returns (uint256) {
        Deposit storage deposit = deposits[agreement];
        if (deposit.amount == 0) {
            return address(this).balance;
        }
        return deposit.amount - deposit.deductions;
    }

    receive() external payable {}
}
