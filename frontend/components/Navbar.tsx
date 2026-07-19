"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ARC_TESTNET_CONFIG } from "@/lib/contracts";

export default function Navbar() {
  const pathname = usePathname();
  const [account, setAccount] = useState<string | null>(null);
  const [networkOk, setNetworkOk] = useState<boolean>(true);
  const [usdcBalance, setUsdcBalance] = useState<string>("0.00");

  async function checkWallet() {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const network = await provider.getNetwork();
          setNetworkOk(Number(network.chainId) === ARC_TESTNET_CONFIG.chainId);
          
          // Fetch native balance
          const bal = await provider.getBalance(accounts[0]);
          setUsdcBalance((Number(bal) / 1e18).toFixed(2));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  useEffect(() => {
    checkWallet();
    if (typeof window !== "undefined" && (window as any).ethereum) {
      (window as any).ethereum.on("accountsChanged", (accs: string[]) => {
        if (accs.length > 0) setAccount(accs[0]);
        else setAccount(null);
      });
      (window as any).ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }
  }, []);

  async function connectWallet() {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);

        const network = await provider.getNetwork();
        if (Number(network.chainId) !== ARC_TESTNET_CONFIG.chainId) {
          await switchNetwork();
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      alert("Please install MetaMask or an EVM wallet to connect to Arc Testnet.");
    }
  }

  async function switchNetwork() {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ARC_TESTNET_CONFIG.hexChainId }]
        });
        setNetworkOk(true);
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: ARC_TESTNET_CONFIG.hexChainId,
              chainName: ARC_TESTNET_CONFIG.chainName,
              rpcUrls: [ARC_TESTNET_CONFIG.rpcUrl],
              blockExplorerUrls: [ARC_TESTNET_CONFIG.blockExplorerUrl],
              nativeCurrency: ARC_TESTNET_CONFIG.nativeCurrency
            }]
          });
          setNetworkOk(true);
        }
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              FX
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white">FlowFX</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-950/90 text-cyan-400 border border-cyan-800/50">
                Arc Testnet
              </span>
            </div>
            <p className="text-xs text-slate-400">Programmable FX & Scheduled Payments</p>
          </div>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
          <Link
            href="/"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              pathname === "/"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Instant Swap
          </Link>
          <Link
            href="/schedule"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              pathname === "/schedule"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Schedule Payment
          </Link>
          <Link
            href="/orders"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              pathname === "/orders"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Live Orders
          </Link>
        </nav>

        {/* Right Section: Wallet & Network */}
        <div className="flex items-center gap-3">
          {account && !networkOk && (
            <button
              onClick={switchNetwork}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/20 transition-all animate-pulse"
            >
              Switch to Arc (5042002)
            </button>
          )}

          {account ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-2xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{usdcBalance} Gas USDC</span>
              </div>
              <span className="text-slate-700">|</span>
              <span className="font-mono text-xs text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-xl border border-blue-800/40">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
