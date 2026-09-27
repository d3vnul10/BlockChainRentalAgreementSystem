import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { RENTAL_FACTORY_ABI } from "../utils/abis";
import AgreementCard from "./AgreementCard";
import CreateAgreement from "./CreateAgreement";

export default function Dashboard({ signer, account, factoryAddress }) {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("mine"); // "mine" | "all" | "create"
  const [customFactory, setCustomFactory] = useState(factoryAddress || "");
  const [activeFactory, setActiveFactory] = useState(factoryAddress || "");

  const loadAgreements = useCallback(async () => {
    if (!activeFactory || !signer) return;
    setLoading(true);
    try {
      const factory = new ethers.Contract(activeFactory, RENTAL_FACTORY_ABI, signer);
      const [landlordList, tenantList, allList] = await Promise.all([
        factory.getLandlordAgreements(account),
        factory.getTenantAgreements(account),
        factory.getDeployedAgreements()
      ]);
      const mine = [...new Set([...landlordList, ...tenantList])];
      setAgreements({ mine, all: allList });
    } catch (e) {
      setAgreements({ mine: [], all: [] });
    }
    setLoading(false);
  }, [activeFactory, signer, account]);

  useEffect(() => { loadAgreements(); }, [loadAgreements]);

  const handleCreated = (addr) => {
    loadAgreements();
    setTab("mine");
  };

  const displayList = tab === "all" ? agreements.all : agreements.mine;

  return (
    <div className="dashboard">
      {/* Factory Address Bar */}
      <div className="factory-bar">
        <span className="factory-label">Factory Contract</span>
        <input
          className="input factory-input"
          value={customFactory}
          onChange={e => setCustomFactory(e.target.value)}
          placeholder="0x... paste your deployed factory address"
        />
        <button className="btn btn-ghost btn-sm" onClick={() => setActiveFactory(customFactory)}>
          Load
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === "mine" ? "tab-active" : ""}`} onClick={() => setTab("mine")}>
          My Agreements
          {agreements.mine?.length > 0 && <span className="tab-count">{agreements.mine.length}</span>}
        </button>
        <button className={`tab ${tab === "all" ? "tab-active" : ""}`} onClick={() => setTab("all")}>
          All Agreements
          {agreements.all?.length > 0 && <span className="tab-count">{agreements.all.length}</span>}
        </button>
        <button className={`tab ${tab === "create" ? "tab-active" : ""}`} onClick={() => setTab("create")}>
          + New Agreement
        </button>
        <button className="btn btn-ghost btn-sm refresh-btn" onClick={loadAgreements}>↻ Refresh</button>
      </div>

      {/* Content */}
      {tab === "create" ? (
        <CreateAgreement signer={signer} factoryAddress={activeFactory} onCreated={handleCreated} />
      ) : loading ? (
        <div className="loading-state">Loading agreements...</div>
      ) : displayList?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>{tab === "mine" ? "No agreements yet" : "No agreements deployed"}</h3>
          <p>{tab === "mine" ? "Create one or ask a landlord to add you as tenant." : "Deploy the factory first."}</p>
          {tab === "mine" && (
            <button className="btn btn-primary" onClick={() => setTab("create")}>Create Agreement</button>
          )}
        </div>
      ) : (
        <div className="agreements-list">
          {displayList.map(addr => (
            <AgreementCard key={addr} address={addr} signer={signer} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
