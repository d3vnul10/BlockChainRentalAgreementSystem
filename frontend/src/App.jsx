import React from "react";
import { useWallet } from "./hooks/useWallet";
import ConnectWallet from "./components/ConnectWallet";
import Dashboard from "./components/Dashboard";

function ChainLeaseLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shield */}
      <path d="M18 2L4 7.5V17C4 24.5 10.2 31.4 18 34C25.8 31.4 32 24.5 32 17V7.5L18 2Z"
        fill="url(#shieldGrad)" stroke="#22d3ee" strokeWidth="0.5"/>
      {/* Chain link left */}
      <rect x="8" y="15" width="7" height="6" rx="3" stroke="#0a1628" strokeWidth="2.5" fill="none"/>
      <rect x="8" y="15" width="7" height="6" rx="3" stroke="#22d3ee" strokeWidth="1.5" fill="none"/>
      {/* Chain link right */}
      <rect x="21" y="15" width="7" height="6" rx="3" stroke="#0a1628" strokeWidth="2.5" fill="none"/>
      <rect x="21" y="15" width="7" height="6" rx="3" stroke="#22d3ee" strokeWidth="1.5" fill="none"/>
      {/* Connecting bar */}
      <rect x="14.5" y="17.5" width="7" height="1" fill="#22d3ee"/>
      <defs>
        <linearGradient id="shieldGrad" x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f2040"/>
          <stop offset="100%" stopColor="#1a3055"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function App() {
  const { account, signer, chainId, error, connect, disconnect } = useWallet();

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <ChainLeaseLogo size={36} />
            <div className="logo-text-group">
              <span className="logo-text">ChainLease</span>
              <span className="logo-sub">CYB204 · Cybersecurity Project</span>
            </div>
          </div>
          <ConnectWallet
            account={account}
            chainId={chainId}
            error={error}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </div>
      </header>

      <main className="main">
        {!account ? (
          <div className="landing">
            <div className="landing-content">
              <div className="landing-badge">
                <span className="badge-dot" />
                CYB204 · Blockchain Security Project
              </div>
              <h1 className="landing-title">
                Rental agreements,<br />
                <span className="gradient-text">secured by code</span>
              </h1>
              <p className="landing-subtitle">
                A CYB204 capstone demonstrating how smart contracts eliminate
                fraud, enforce lease terms, and protect both landlords and tenants —
                without trusting any middleman.
              </p>
              <div className="landing-features">
                <div className="feature">
                  <span className="feature-icon">🛡️</span>
                  <div>
                    <strong>Cryptographic enforcement</strong>
                    <span>Lease terms coded into immutable smart contracts</span>
                  </div>
                </div>
                <div className="feature">
                  <span className="feature-icon">🔐</span>
                  <div>
                    <strong>Escrow-secured deposits</strong>
                    <span>Funds locked on-chain, released only by contract rules</span>
                  </div>
                </div>
                <div className="feature">
                  <span className="feature-icon">⛓️</span>
                  <div>
                    <strong>Tamper-proof audit trail</strong>
                    <span>Every payment and action recorded permanently</span>
                  </div>
                </div>
                <div className="feature">
                  <span className="feature-icon">⚖️</span>
                  <div>
                    <strong>Decentralised dispute resolution</strong>
                    <span>On-chain arbitration, no courts needed</span>
                  </div>
                </div>
              </div>
              <div className="landing-cta-row">
                <button className="btn btn-primary btn-lg" onClick={connect}>
                  Connect Wallet to Start
                </button>
                <span className="landing-hint">MetaMask · Hardhat Local · Chain 31337</span>
              </div>
            </div>

            <div className="landing-visual">
              {/* Big logo centrepiece */}
              <div className="hero-logo-wrap">
                <div className="hero-logo-glow" />
                <ChainLeaseLogo size={120} />
              </div>
              <div className="visual-card vc1">
                <div className="vc-label">Security Deposit</div>
                <div className="vc-value">3.0000 ETH</div>
                <div className="vc-status active">● LOCKED IN ESCROW</div>
              </div>
              <div className="visual-card vc2">
                <div className="vc-label">Monthly Rent</div>
                <div className="vc-value">1.0000 ETH</div>
                <div className="vc-status">● ACTIVE</div>
              </div>
              <div className="visual-card vc3">
                <div className="vc-label">Audit Trail</div>
                <div className="vc-value">On-Chain</div>
                <div className="vc-status purple">● IMMUTABLE</div>
              </div>
            </div>
          </div>
        ) : (
          <Dashboard signer={signer} account={account} factoryAddress="" />
        )}
      </main>

      <footer className="footer">
        <span>ChainLease · CYB204 Cybersecurity Capstone Project</span>
        <span className="footer-sep">·</span>
        <span>Built on Ethereum · Hardhat · Ethers v6 · React</span>
      </footer>
    </div>
  );
}
