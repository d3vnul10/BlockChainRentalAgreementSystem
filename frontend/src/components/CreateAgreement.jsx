import React, { useState } from "react";
import { ethers } from "ethers";
import { RENTAL_FACTORY_ABI } from "../utils/abis";

export default function CreateAgreement({ signer, factoryAddress, onCreated }) {
  const [form, setForm] = useState({
    tenant: "", monthlyRent: "", securityDeposit: "",
    startDate: "", endDate: "", propertyId: "", ipfsHash: ""
  });
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const factory = new ethers.Contract(factoryAddress, RENTAL_FACTORY_ABI, signer);
      const startTs = Math.floor(new Date(form.startDate).getTime() / 1000);
      const endTs = Math.floor(new Date(form.endDate).getTime() / 1000);
      const tx = await factory.createAgreement(
        form.tenant,
        ethers.parseEther(form.monthlyRent),
        ethers.parseEther(form.securityDeposit),
        startTs, endTs,
        form.propertyId,
        form.ipfsHash || "QmNoHash"
      );
      setTxHash(tx.hash);
      const receipt = await tx.wait();
      const iface = new ethers.Interface(RENTAL_FACTORY_ABI);
      const log = receipt.logs.find(l => { try { return iface.parseLog(l)?.name === "AgreementDeployed"; } catch { return false; } });
      const agreementAddress = iface.parseLog(log).args.agreementAddress;
      onCreated(agreementAddress);
      setForm({ tenant: "", monthlyRent: "", securityDeposit: "", startDate: "", endDate: "", propertyId: "", ipfsHash: "" });
      setTxHash(null);
    } catch (e) {
      setError(e.reason || e.message);
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>New Rental Agreement</h2>
        <p>Deploy a rental agreement to the blockchain</p>
      </div>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <div className="form-group">
            <label>Tenant Address</label>
            <input name="tenant" placeholder="0x..." value={form.tenant} onChange={handleChange} required className="input" />
          </div>
          <div className="form-group">
            <label>Property ID</label>
            <input name="propertyId" placeholder="PROP-001" value={form.propertyId} onChange={handleChange} required className="input" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Monthly Rent (ETH)</label>
            <input name="monthlyRent" type="number" step="0.001" placeholder="1.0" value={form.monthlyRent} onChange={handleChange} required className="input" />
          </div>
          <div className="form-group">
            <label>Security Deposit (ETH)</label>
            <input name="securityDeposit" type="number" step="0.001" placeholder="3.0" value={form.securityDeposit} onChange={handleChange} required className="input" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Start Date</label>
            <input name="startDate" type="date" value={form.startDate} onChange={handleChange} required className="input" />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input name="endDate" type="date" value={form.endDate} onChange={handleChange} required className="input" />
          </div>
        </div>
        <div className="form-group">
          <label>IPFS Document Hash <span className="label-optional">(optional)</span></label>
          <input name="ipfsHash" placeholder="QmHash..." value={form.ipfsHash} onChange={handleChange} className="input" />
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {txHash && <div className="alert alert-info">⏳ Deploying... tx: {txHash.slice(0,18)}...</div>}
        <button type="submit" disabled={loading} className="btn btn-primary btn-full">
          {loading ? "Deploying..." : "Deploy Agreement"}
        </button>
      </form>
    </div>
  );
}
