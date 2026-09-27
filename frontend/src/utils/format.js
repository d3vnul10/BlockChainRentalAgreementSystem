import { ethers } from "ethers";

export const formatEth = (wei) => {
  if (!wei) return "0";
  return parseFloat(ethers.formatEther(wei)).toFixed(4);
};

export const formatDate = (timestamp) => {
  if (!timestamp || timestamp === 0n) return "—";
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric"
  });
};

export const shortenAddress = (addr) => {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

export const formatTimestamp = (ts) => {
  if (!ts || ts === 0n) return "Never";
  return new Date(Number(ts) * 1000).toLocaleString();
};
