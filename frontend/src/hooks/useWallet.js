import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);

  const connect = useCallback(async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not found. Please install it.");
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      await web3Provider.send("eth_requestAccounts", []);
      const web3Signer = await web3Provider.getSigner();
      const addr = await web3Signer.getAddress();
      const network = await web3Provider.getNetwork();
      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(addr);
      setChainId(Number(network.chainId));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) disconnect();
      else connect();
    });
    window.ethereum.on("chainChanged", () => connect());
    return () => {
      window.ethereum.removeAllListeners("accountsChanged");
      window.ethereum.removeAllListeners("chainChanged");
    };
  }, [connect, disconnect]);

  return { account, provider, signer, chainId, error, connect, disconnect };
}
