// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// contracts/modules/DisputeResolution.sol
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../interfaces/IDisputeResolution.sol";

contract DisputeResolution is IDisputeResolution, AccessControl, Pausable {
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    // Mapping-in-struct not allowed in Solidity for storage structs returned externally,
    // so we keep votes separate
    struct Dispute {
        bytes32 id;
        address agreement;
        address filedBy;
        string reason;
        uint256 filedAt;
        DisputeStatus status;
        address[] arbitrators;
        uint8 votesInFavor;
        uint8 votesAgainst;
        string evidenceIPFSHash;
        string resolution;
    }

    mapping(bytes32 => Dispute) public disputes;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    bytes32[] public disputeIds;

    event DisputeFiled(
        bytes32 indexed disputeId,
        address indexed agreement,
        address indexed filedBy,
        string reason,
        uint256 timestamp
    );

    event EvidenceSubmitted(
        bytes32 indexed disputeId,
        string evidenceHash
    );

    event DisputeResolved(
        bytes32 indexed disputeId,
        bool inFavorOfTenant,
        string resolution
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function fileDispute(
        string memory reason,
        address filer,
        address agreement
    ) external override returns (bytes32) {
        bytes32 disputeId = keccak256(
            abi.encodePacked(agreement, filer, reason, block.timestamp)
        );

        Dispute storage dispute = disputes[disputeId];
        dispute.id = disputeId;
        dispute.agreement = agreement;
        dispute.filedBy = filer;
        dispute.reason = reason;
        dispute.filedAt = block.timestamp;
        dispute.status = DisputeStatus.FILED;

        disputeIds.push(disputeId);

        emit DisputeFiled(disputeId, agreement, filer, reason, block.timestamp);
        return disputeId;
    }

    function submitEvidence(
        bytes32 disputeId,
        string memory evidenceIPFSHash
    ) external override {
        require(disputes[disputeId].filedBy == msg.sender, "Not dispute filer");
        require(
            disputes[disputeId].status == DisputeStatus.FILED,
            "Dispute not active"
        );

        disputes[disputeId].evidenceIPFSHash = evidenceIPFSHash;
        emit EvidenceSubmitted(disputeId, evidenceIPFSHash);
    }

    function assignArbitrator(
        bytes32 disputeId,
        address arbitrator
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            disputes[disputeId].status == DisputeStatus.FILED,
            "Dispute not in filing stage"
        );

        disputes[disputeId].arbitrators.push(arbitrator);
        grantRole(ARBITRATOR_ROLE, arbitrator);
    }

    function voteOnDispute(
        bytes32 disputeId,
        bool inFavorOfTenant
    ) external onlyRole(ARBITRATOR_ROLE) {
        Dispute storage dispute = disputes[disputeId];
        require(!hasVoted[disputeId][msg.sender], "Already voted");
        require(dispute.status == DisputeStatus.FILED, "Dispute not active");

        hasVoted[disputeId][msg.sender] = true;

        if (inFavorOfTenant) {
            dispute.votesInFavor++;
        } else {
            dispute.votesAgainst++;
        }

        uint8 totalArbitrators = uint8(dispute.arbitrators.length);
        if (dispute.votesInFavor > totalArbitrators / 2 ||
            dispute.votesAgainst > totalArbitrators / 2) {
            dispute.status = DisputeStatus.RESOLVED;
            bool tenantWon = dispute.votesInFavor > dispute.votesAgainst;
            emit DisputeResolved(disputeId, tenantWon, "Majority vote reached");
        }
    }

    function resolveDispute(
        bytes32 disputeId,
        bool inFavorOfTenant
    ) external override onlyRole(ARBITRATOR_ROLE) {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.FILED, "Already resolved");

        dispute.status = DisputeStatus.RESOLVED;
        dispute.resolution = inFavorOfTenant ? "Tenant wins" : "Landlord wins";

        emit DisputeResolved(disputeId, inFavorOfTenant, dispute.resolution);
    }

    function getDisputeDetails(bytes32 disputeId)
        external
        view
        returns (
            address agreement,
            address filedBy,
            string memory reason,
            uint256 filedAt,
            DisputeStatus status,
            uint8 votesInFavor,
            uint8 votesAgainst
        )
    {
        Dispute storage dispute = disputes[disputeId];
        return (
            dispute.agreement,
            dispute.filedBy,
            dispute.reason,
            dispute.filedAt,
            dispute.status,
            dispute.votesInFavor,
            dispute.votesAgainst
        );
    }

    function getActiveDisputes() external view returns (bytes32[] memory) {
        return disputeIds;
    }
}
