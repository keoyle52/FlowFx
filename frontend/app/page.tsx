"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, ERC20_ABI, FX_POOL_ABI, ARC_TESTNET_CONFIG, getArcProvider } from "@/lib/contracts";

export default function SwapPage() {
  const [account, setAccount] = useState<string | null>(null);
  const [direction, setDirection] = useState<"USDC_TO_EURC" | "EURC_TO_USDC">("USDC_TO_EURC");
  const [amountIn, setAmountIn] = useState<string>("10");
  const [usdcBalance, setUsdcBalance] = useState<string>("0.00");
  const [eurcBalance, setEurcBalance] = useState<string>("0.00");
  const [poolUsdcBalance, setPoolUsdcBalance] = useState<string>("0.00");
  const [poolEurcBalance, setPoolEurcBalance] = useState<string>("0.00");
  
  const [loading, setLoading] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const rateNum = 920000;
  const ratePrec = 1000000;
  const feeBps = 30;

  async function loadData() {
    try {
      const provider = await getArcProvider();
      
      // Pool balances
      const usdcContract = new ethers.Contract(CONTRACT_ADDRESSES.USDC, ERC20_ABI, provider);
      const eurcContract = new ethers.Contract(CONTRACT_ADDRESSES.EURC, ERC20_ABI, provider);

      const pUsdc = await usdcContract.balanceOf(CONTRACT_ADDRESSES.FXPool);
      const pEurc = await eurcContract.balanceOf(CONTRACT_ADDRESSES.FXPool);

      setPoolUsdcBalance((Number(pUsdc) / 1e6).toFixed(2));
      setPoolEurcBalance((Number(pEurc) / 1e6).toFixed(2));

      // Connected wallet balances
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await browserProvider.send("eth_accounts", []);
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const uBal = await usdcContract.balanceOf(accounts[0]);
          const eBal = await eurcContract.balanceOf(accounts[0]);
          setUsdcBalance((Number(uBal) / 1e6).toFixed(2));
          setEurcBalance((Number(eBal) / 1e6).toFixed(2));
        }
      }
    } catch (e) {
      console.error("Error loading swap data:", e);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate estimated output
  const parsedIn = parseFloat(amountIn) || 0;
  let estimatedOut = 0;
  if (direction === "USDC_TO_EURC") {
    const gross = (parsedIn * rateNum) / ratePrec;
    estimatedOut = gross * (1 - feeBps / 10000);
  } else {
    const gross = (parsedIn * ratePrec) / rateNum;
    estimatedOut = gross * (1 - feeBps / 10000);
  }

  async function executeSwap() {
    let userAddr = account;
    if (!userAddr) {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        try {
          const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
          const accounts = await browserProvider.send("eth_requestAccounts", []);
          if (accounts.length > 0) {
            userAddr = accounts[0];
            setAccount(accounts[0]);
          }
        } catch (e) {
          alert("Please connect your wallet to execute swap.");
          return;
        }
      } else {
        alert("Please install MetaMask or an EVM wallet.");
        return;
      }
    }

    if (parsedIn <= 0) {
      alert("Please enter a valid swap amount.");
      return;
    }

    setLoading(true);
    setTxHash(null);
    setStatusMessage("Preparing transaction on Arc Testnet...");

    try {
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await browserProvider.getSigner();

      const tokenInAddr = direction === "USDC_TO_EURC" ? CONTRACT_ADDRESSES.USDC : CONTRACT_ADDRESSES.EURC;
      const tokenInContract = new ethers.Contract(tokenInAddr, ERC20_ABI, signer);
      const poolContract = new ethers.Contract(CONTRACT_ADDRESSES.FXPool, FX_POOL_ABI, signer);

      const inAmountUnits = BigInt(Math.floor(parsedIn * 1e6));
      
      // Compute minOutUnits dynamically based on current direction
      let currentEstOut = 0;
      if (direction === "USDC_TO_EURC") {
        const gross = (parsedIn * rateNum) / ratePrec;
        currentEstOut = gross * (1 - feeBps / 10000);
      } else {
        const gross = (parsedIn * ratePrec) / rateNum;
        currentEstOut = gross * (1 - feeBps / 10000);
      }
      
      // 5% max slippage buffer for safe execution
      const minOutUnits = BigInt(Math.floor(currentEstOut * 0.95 * 1e6));

      // 1. Check & Approve Allowance
      setStatusMessage("Checking token approval...");
      const allowance = await tokenInContract.allowance(userAddr, CONTRACT_ADDRESSES.FXPool);
      if (BigInt(allowance) < inAmountUnits) {
        setStatusMessage("Approving FXPool contract to spend tokens...");
        const approveTx = await tokenInContract.approve(CONTRACT_ADDRESSES.FXPool, inAmountUnits);
        await approveTx.wait();
      }

      // 2. Execute Swap
      setStatusMessage("Broadcasting instant FX swap transaction...");
      let swapTx;
      if (direction === "USDC_TO_EURC") {
        swapTx = await poolContract.swapUSDCtoEURC(inAmountUnits, minOutUnits, { gasLimit: 300000 });
      } else {
        swapTx = await poolContract.swapEURCtoUSDC(inAmountUnits, minOutUnits, { gasLimit: 300000 });
      }

      setTxHash(swapTx.hash);
      setStatusMessage("Waiting for block confirmation on Arc Testnet...");
      await swapTx.wait();

      setStatusMessage("✅ Swap completed successfully!");
      loadData();
    } catch (err: any) {
      console.error("Swap Error:", err);
      setStatusMessage(`❌ Swap failed: ${err.reason || err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-4">
      {/* Hero Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Instant FX Swap
        </h1>
        <p className="text-sm text-slate-400">
          Zero-slippage FX liquidity for stablecoins on Arc Testnet
        </p>
      </div>

      {/* Main Swap Card */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl shadow-blue-950/20 space-y-5">
        {/* Rate Banner */}
        <div className="flex items-center justify-between text-xs bg-slate-950/60 border border-slate-800/80 px-4 py-2.5 rounded-2xl">
          <span className="text-slate-400">Exchange Rate</span>
          <span className="font-semibold text-cyan-400">1 USDC ≈ 0.9200 EURC (%0.3 Fee)</span>
        </div>

        {/* Input Token Box */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>You Pay</span>
            <span>Balance: {direction === "USDC_TO_EURC" ? usdcBalance : eurcBalance}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.00"
              className="bg-transparent text-2xl font-bold text-white focus:outline-none w-full"
            />
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3.5 py-1.5 rounded-xl font-bold text-sm text-white shrink-0">
              {direction === "USDC_TO_EURC" ? "USDC" : "EURC"}
            </div>
          </div>
        </div>

        {/* Switch Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={() => setDirection(direction === "USDC_TO_EURC" ? "EURC_TO_USDC" : "USDC_TO_EURC")}
            className="p-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-blue-400 hover:text-white hover:bg-blue-600 hover:scale-110 active:scale-95 transition-all shadow-md"
          >
            ⇅
          </button>
        </div>

        {/* Output Token Box */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>You Receive (Estimated)</span>
            <span>Balance: {direction === "USDC_TO_EURC" ? eurcBalance : usdcBalance}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              readOnly
              value={estimatedOut.toFixed(4)}
              className="bg-transparent text-2xl font-bold text-cyan-400 focus:outline-none w-full"
            />
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3.5 py-1.5 rounded-xl font-bold text-sm text-white shrink-0">
              {direction === "USDC_TO_EURC" ? "EURC" : "USDC"}
            </div>
          </div>
        </div>

        {/* Swap Action Button */}
        <button
          onClick={executeSwap}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white font-bold text-base shadow-xl shadow-blue-600/30 hover:shadow-blue-500/50 transition-all"
        >
          {loading ? "Processing Transaction..." : `Swap ${direction === "USDC_TO_EURC" ? "USDC to EURC" : "EURC to USDC"}`}
        </button>

        {/* Status & Tx Link */}
        {statusMessage && (
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-center space-y-1">
            <p className="text-slate-300 font-medium">{statusMessage}</p>
            {txHash && (
              <a
                href={`https://testnet.arcscan.app/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-cyan-400 underline hover:text-cyan-300 font-mono"
              >
                View on Arcscan ↗
              </a>
            )}
          </div>
        )}

        {/* Live Pool Reserve Indicators */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Pool Reserve:</span>
          <span className="font-mono text-slate-300">
            {poolUsdcBalance} USDC | {poolEurcBalance} EURC
          </span>
        </div>
      </div>
    </div>
  );
}
