import React from "react";
import { shortenAddress } from "../utils/format";

export default function ConnectWallet({ account, chainId, error, onConnect, onDisconnect }) {
  const isLocalnet = chainId === 31337;

  return (
    <div className="wallet-bar">
      {error && <span className="wallet-error">⚠ {error}</span>}
      {account ? (
        <div className="wallet-connected">
          <span className={`chain-badge ${isLocalnet ? "chain-local" : "chain-other"}`}>
            {isLocalnet ? "⬡ Hardhat Local" : `Chain ${chainId}`}
          </span>
          <span className="wallet-address">{shortenAddress(account)}</span>
          <button className="btn btn-ghost btn-sm" onClick={onDisconnect}>Disconnect</button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={onConnect}>
          Connect Wallet
        </button>
      )}
    </div>
  );
}
