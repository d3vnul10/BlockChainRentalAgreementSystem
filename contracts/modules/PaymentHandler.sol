// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// contracts/modules/PaymentHandler.sol
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IPaymentHandler.sol";

contract PaymentHandler is IPaymentHandler, Ownable, ReentrancyGuard {
    uint256 public platformFee;
    address public platformWallet;

    mapping(address => PaymentRecord[]) public paymentHistory;
    mapping(address => uint256) public totalRentPaid;

    struct PaymentRecord {
        uint256 amount;
        uint256 penalty;
        uint256 timestamp;
        address payer;
        address payee;
        PaymentType paymentType;
    }

    enum PaymentType {
        RENT,
        DEPOSIT,
        PENALTY,
        REFUND
    }

    event PaymentProcessed(
        address indexed agreement,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 penalty,
        uint256 platformCut,
        PaymentType paymentType
    );

    // OZ v4 Ownable: pass initial owner explicitly
    constructor(address _platformWallet, uint256 _platformFee) Ownable() {
        require(_platformFee <= 1000, "Fee too high");
        platformWallet = _platformWallet;
        platformFee = _platformFee;
    }

    function processPayment(
        address agreement,
        address payee,
        uint256 baseAmount,
        uint256 penalty
    ) external payable override nonReentrant {
        require(msg.value >= baseAmount + penalty, "Insufficient payment");
        require(payee != address(0), "Invalid payee");

        uint256 platformCut = (baseAmount * platformFee) / 10000;
        uint256 payeeAmount = baseAmount - platformCut;

        (bool successPayee, ) = payee.call{value: payeeAmount}("");
        require(successPayee, "Payment to payee failed");

        if (platformCut > 0) {
            (bool successPlatform, ) = platformWallet.call{value: platformCut}("");
            require(successPlatform, "Platform fee transfer failed");
        }

        if (penalty > 0) {
            (bool successPenalty, ) = payee.call{value: penalty}("");
            require(successPenalty, "Penalty transfer failed");
        }

        PaymentType pType = penalty > 0 ? PaymentType.PENALTY : PaymentType.RENT;

        paymentHistory[agreement].push(PaymentRecord({
            amount: baseAmount,
            penalty: penalty,
            timestamp: block.timestamp,
            payer: msg.sender,
            payee: payee,
            paymentType: pType
        }));

        totalRentPaid[agreement] += baseAmount;

        emit PaymentProcessed(agreement, msg.sender, payee, baseAmount, penalty, platformCut, pType);

        if (msg.value > baseAmount + penalty) {
            (bool successRefund, ) = msg.sender.call{value: msg.value - baseAmount - penalty}("");
            require(successRefund, "Refund failed");
        }
    }

    function processDeposit(
        address agreement,
        uint256 depositAmount
    ) external payable override {
        require(msg.value >= depositAmount, "Insufficient deposit");
        emit PaymentProcessed(
            agreement,
            msg.sender,
            address(this),
            depositAmount,
            0,
            0,
            PaymentType.DEPOSIT
        );
    }

    function updatePlatformFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1000, "Fee too high");
        platformFee = _newFee;
    }

    function getPaymentHistory(address agreement)
        external
        view
        returns (PaymentRecord[] memory)
    {
        return paymentHistory[agreement];
    }
}
