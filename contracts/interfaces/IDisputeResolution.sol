// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// contracts/interfaces/IDisputeResolution.sol
interface IDisputeResolution {
    enum DisputeStatus {
        NONE,
        FILED,
        UNDER_REVIEW,
        RESOLVED,
        APPEALED
    }

    function fileDispute(
        string memory reason,
        address filer,
        address agreement
    ) external returns (bytes32);
    
    function submitEvidence(
        bytes32 disputeId,
        string memory evidenceIPFSHash
    ) external;
    
    function resolveDispute(
        bytes32 disputeId,
        bool inFavorOfTenant
    ) external;
}
