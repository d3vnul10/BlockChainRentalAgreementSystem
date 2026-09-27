// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// contracts/modules/PenaltyEngine.sol
import "@openzeppelin/contracts/access/Ownable.sol";

contract PenaltyEngine is Ownable {
    struct PenaltyConfig {
        uint256 baseLateFee;
        uint256 dailyAccrual;
        uint256 maxPenalty;
        uint256 gracePeriod;
        uint256 escalationThreshold;
    }

    mapping(address => PenaltyConfig) public agreementPenalties;
    mapping(address => uint256) public penaltyBalance;
    mapping(address => uint8) public violationCount;

    event PenaltyCalculated(
        address indexed agreement,
        uint256 baseAmount,
        uint256 penaltyAmount,
        uint256 daysLate
    );

    event PenaltyPaid(
        address indexed agreement,
        uint256 amount,
        address payer
    );

    // OZ v4 Ownable: no-arg constructor is fine
    constructor() Ownable() {}

    function calculateLatePenalty(
        uint256 rentAmount,
        uint256 lateFeePercentage,
        uint256 secondsLate
    ) public pure returns (uint256) {
        uint256 daysLate = secondsLate / 1 days;
        uint256 penalty = (rentAmount * lateFeePercentage) / 10000;

        if (daysLate > 0) {
            uint256 dailyRate = (rentAmount * 50) / 10000;
            penalty += dailyRate * daysLate;
        }

        uint256 maxPenalty = (rentAmount * 2000) / 10000;
        if (penalty > maxPenalty) {
            penalty = maxPenalty;
        }

        return penalty;
    }

    function calculatePropertyDamage(
        uint256 repairCost,
        address /*agreement*/
    ) external pure returns (uint256) {
        return repairCost;
    }

    function calculateEarlyTerminationPenalty(
        uint256 monthlyRent,
        uint256 remainingMonths
    ) public pure returns (uint256) {
        if (remainingMonths <= 1) {
            return monthlyRent;
        } else if (remainingMonths <= 3) {
            return (monthlyRent * 150) / 100;
        } else {
            return monthlyRent * 2;
        }
    }

    function recordViolation(address agreement) external {
        violationCount[agreement]++;
        emit PenaltyCalculated(agreement, 0, 0, 0);
    }

    function getViolationCount(address agreement) external view returns (uint8) {
        return violationCount[agreement];
    }

    function resetViolations(address agreement) external onlyOwner {
        violationCount[agreement] = 0;
    }
}
