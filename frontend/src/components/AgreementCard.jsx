import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { RENTAL_AGREEMENT_ABI, PENALTY_ENGINE_ABI, AGREEMENT_STATES, STATE_COLORS } from "../utils/abis";

const DEPOSIT_MANAGER_ABI = [
  "function getAvailableBalance(address agreement) external view returns (uint256)",
  "function depositManager() external view returns (address)"
];
import { formatEth, formatDate, shortenAddress, formatTimestamp } from "../utils/format";

export default function AgreementCard({ address, signer, account }) {
  const [details, setDetails] = useState(null);
  const [landlord, setLandlord] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [role, setRole] = useState(null); // "landlord" | "tenant" | "observer"
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [penalty, setPenalty] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [returnAmount, setReturnAmount] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [availableDeposit, setAvailableDeposit] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const contract = new ethers.Contract(address, RENTAL_AGREEMENT_ABI, signer);

  const load = useCallback(async () => {
    try {
      const [d, l, t] = await Promise.all([
        contract.getAgreementDetails(),
        contract.getLandlord(),
        contract.getTenant()
      ]);
      setDetails(d);
      setLandlord(l);
      setTenant(t);

      // Fetch available deposit balance from DepositManager
      try {
        const dmAddr = await contract.depositManager();
        const dm = new ethers.Contract(dmAddr, ["function getAvailableBalance(address) external view returns (uint256)"], signer);
        const avail = await dm.getAvailableBalance(agreementAddress || address);
        setAvailableDeposit(avail);
      } catch(e) {
        setAvailableDeposit(d.securityDeposit);
      }
      const addr = account?.toLowerCase();
      if (l?.toLowerCase() === addr) setRole("landlord");
      else if (t?.toLowerCase() === addr) setRole("tenant");
      else setRole("observer");

      // Calculate penalty if overdue
      if (d.state === 1n || d.state === 2n) {
        const now = BigInt(Math.floor(Date.now() / 1000));
        if (now > d.nextPaymentDue + d.gracePeriodDays) {
          const peAddr = await contract.penaltyEngine();
          const pe = new ethers.Contract(peAddr, PENALTY_ENGINE_ABI, signer);
          const p = await pe.calculateLatePenalty(d.monthlyRent, d.lateFeePercentage, now - d.nextPaymentDue);
          setPenalty(p);
        } else {
          setPenalty(null);
        }
      }
    } catch (e) {
      setError("Failed to load agreement");
    }
    setLoading(false);
  }, [address, account]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (fn, successMsg) => {
    setActionLoading(true); setError(null); setSuccess(null);
    try {
      const tx = await fn();
      await tx.wait();
      setSuccess(successMsg);
      await load();
    } catch (e) {
      setError(e.reason || e.message?.slice(0, 120));
    }
    setActionLoading(false);
  };

  const payRent = () => {
    const total = penalty ? details.monthlyRent + penalty : details.monthlyRent;
    doAction(() => contract.payRent({ value: total }), "✓ Rent paid successfully!");
  };

  const fileDispute = () => {
    if (!disputeReason.trim()) return setError("Enter a dispute reason");
    doAction(() => contract.fileDispute(disputeReason), "✓ Dispute filed on-chain");
  };

  const initiateTermination = () =>
    doAction(() => contract.initiateTermination(0), "✓ Termination initiated");

  const doReturnDeposit = () => {
    if (!returnAmount) return setError("Enter amount to return");
    doAction(
      () => contract.returnDeposit(ethers.parseEther(returnAmount), returnReason || "Lease ended"),
      "✓ Deposit returned"
    );
  };

  if (loading) return <div className="agreement-card loading"><div className="skeleton" /></div>;

  const stateNum = Number(details?.state ?? 0);
  const stateLabel = AGREEMENT_STATES[stateNum] ?? "UNKNOWN";
  const stateColor = STATE_COLORS[stateNum];
  const isOverdue = penalty !== null;
  const rentDue = penalty ? details.monthlyRent + penalty : details?.monthlyRent;

  return (
    <div className={`agreement-card ${expanded ? "expanded" : ""}`}>
      {/* Header */}
      <div className="agreement-header" onClick={() => setExpanded(!expanded)}>
        <div className="agreement-id">
          <span className="prop-id">{details?.propertyId}</span>
          <span className="agreement-addr">{shortenAddress(address)}</span>
        </div>
        <div className="agreement-meta">
          <span className="role-badge role-badge--{role}">{role?.toUpperCase()}</span>
          <span className="state-badge" style={{ background: stateColor + "22", color: stateColor, border: `1px solid ${stateColor}44` }}>
            {stateLabel}
          </span>
          <span className="expand-icon">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="agreement-body">
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Monthly Rent</span>
              <span className="stat-value">{formatEth(details?.monthlyRent)} ETH</span>
            </div>
            <div className="stat">
              <span className="stat-label">Security Deposit</span>
              <span className="stat-value">{formatEth(details?.securityDeposit)} ETH</span>
            </div>
            <div className="stat">
              <span className="stat-label">Next Payment</span>
              <span className={`stat-value ${isOverdue ? "overdue" : ""}`}>
                {formatDate(details?.nextPaymentDue)}
                {isOverdue && <span className="overdue-badge">OVERDUE</span>}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Lease End</span>
              <span className="stat-value">{formatDate(details?.endDate)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Landlord</span>
              <span className="stat-value mono">{shortenAddress(landlord)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Tenant</span>
              <span className="stat-value mono">{shortenAddress(tenant)}</span>
            </div>
          </div>

          {isOverdue && penalty && (
            <div className="alert alert-warning">
              ⚠ Late penalty: +{formatEth(penalty)} ETH — Total due: {formatEth(rentDue)} ETH
            </div>
          )}

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Tenant actions */}
          {role === "tenant" && stateNum === 1 && (
            <div className="actions-section">
              <h4>Tenant Actions</h4>
              <div className="actions-row">
                <button className="btn btn-primary" onClick={payRent} disabled={actionLoading}>
                  {actionLoading ? "Processing..." : `Pay Rent (${formatEth(rentDue)} ETH)`}
                </button>
              </div>
              <div className="actions-row">
                <input
                  className="input"
                  placeholder="Dispute reason..."
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                />
                <button className="btn btn-danger" onClick={fileDispute} disabled={actionLoading}>
                  File Dispute
                </button>
              </div>
              <button className="btn btn-ghost" onClick={initiateTermination} disabled={actionLoading}>
                Request Termination
              </button>
            </div>
          )}

          {/* Landlord actions */}
          {role === "landlord" && (
            <div className="actions-section">
              <h4>Landlord Actions</h4>
              {stateNum === 1 && (
                <button className="btn btn-ghost" onClick={initiateTermination} disabled={actionLoading}>
                  Initiate Termination
                </button>
              )}
              {(stateNum === 4 || stateNum === 5) && (
                <div className="actions-row">
                  <input className="input" placeholder={availableDeposit ? `Max: ${formatEth(availableDeposit)} ETH` : "Amount (ETH)"} type="number" step="0.001"
                    value={returnAmount} onChange={e => setReturnAmount(e.target.value)} />
                  <input className="input" placeholder="Reason" value={returnReason}
                    onChange={e => setReturnReason(e.target.value)} />
                  <button className="btn btn-primary" onClick={doReturnDeposit} disabled={actionLoading}>
                    Return Deposit
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Contract address */}
          <div className="contract-footer">
            <span className="mono small">Contract: {address}</span>
          </div>
        </div>
      )}
    </div>
  );
}
