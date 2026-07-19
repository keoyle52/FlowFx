"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, ERC20_ABI, PAYMENT_SCHEDULER_ABI } from "@/lib/contracts";

export default function SchedulePage() {
  const [fromToken, setFromToken] = useState<"USDC" | "EURC">("USDC");
  const [amount, setAmount] = useState<string>("5");
  const [recipient, setRecipient] = useState<string>("");
  const [delaySeconds, setDelaySeconds] = useState<number>(120); // Default 2 minutes
  const [customTimestamp, setCustomTimestamp] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();

    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("Please connect an EVM wallet first.");
      return;
    }

    if (!recipient || !ethers.isAddress(recipient)) {
      alert("Please enter a valid recipient EVM address.");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    setLoading(true);
    setTxHash(null);
    setStatusMessage("Connecting to wallet...");

    try {
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await browserProvider.getSigner();
      const userAddress = await signer.getAddress();

      const fromAddr = fromToken === "USDC" ? CONTRACT_ADDRESSES.USDC : CONTRACT_ADDRESSES.EURC;
      const toAddr = fromToken === "USDC" ? CONTRACT_ADDRESSES.EURC : CONTRACT_ADDRESSES.USDC;

      const tokenContract = new ethers.Contract(fromAddr, ERC20_ABI, signer);
      const schedulerContract = new ethers.Contract(CONTRACT_ADDRESSES.PaymentScheduler, PAYMENT_SCHEDULER_ABI, signer);

      const amountUnits = BigInt(Math.floor(numericAmount * 1e6));
      
      // Calculate executeAfter timestamp with mining buffer
      const block = await browserProvider.getBlock("latest");
      const currentBlockTs = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
      const nowTs = Math.max(currentBlockTs, Math.floor(Date.now() / 1000));

      let executeAfterTs = nowTs + delaySeconds + 10; // 10s mining buffer
      if (delaySeconds === 0 && customTimestamp) {
        executeAfterTs = Math.floor(new Date(customTimestamp).getTime() / 1000);
      }

      if (executeAfterTs <= nowTs) {
        alert("Execution time must be in the future!");
        setLoading(false);
        return;
      }

      // 1. Approve Scheduler contract
      setStatusMessage(`Approving ${fromToken} transfer...`);
      const allowance = await tokenContract.allowance(userAddress, CONTRACT_ADDRESSES.PaymentScheduler);
      if (BigInt(allowance) < amountUnits) {
        const approveTx = await tokenContract.approve(CONTRACT_ADDRESSES.PaymentScheduler, amountUnits);
        await approveTx.wait();
      }

      // 2. Call createOrder
      setStatusMessage("Broadcasting scheduled order to Arc Testnet...");
      // Minimum received estimate with 1% slippage buffer
      const rateNum = 920000;
      const ratePrec = 1000000;
      let minReceivedUnits = 1n;
      if (fromToken === "USDC") {
        const estEurc = (numericAmount * rateNum) / ratePrec;
        minReceivedUnits = BigInt(Math.floor(estEurc * 0.99 * 1e6));
      } else {
        const estUsdc = (numericAmount * ratePrec) / rateNum;
        minReceivedUnits = BigInt(Math.floor(estUsdc * 0.99 * 1e6));
      }

      const tx = await schedulerContract.createOrder(
        fromAddr,
        toAddr,
        amountUnits,
        recipient,
        executeAfterTs,
        minReceivedUnits
      );

      setTxHash(tx.hash);
      setStatusMessage("Waiting for transaction confirmation...");
      await tx.wait();

      setStatusMessage("✅ Scheduled Payment Order created & locked on-chain!");
    } catch (err: any) {
      console.error("Order Creation Error:", err);
      setStatusMessage(`❌ Error: ${err.reason || err.message || "Failed to create order"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Schedule Automated Payment
        </h1>
        <p className="text-sm text-slate-400">
          Lock funds now for automated cross-currency settlement via Keeper bot on Arc
        </p>
      </div>

      <form onSubmit={handleCreateOrder} className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl shadow-blue-950/20 space-y-5">
        {/* Token Pair Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400">From Token (Pay in)</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFromToken("USDC")}
              className={`py-3 rounded-2xl border text-sm font-bold transition-all ${
                fromToken === "USDC"
                  ? "bg-blue-600/20 border-blue-500 text-blue-400"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              USDC → EURC
            </button>
            <button
              type="button"
              onClick={() => setFromToken("EURC")}
              className={`py-3 rounded-2xl border text-sm font-bold transition-all ${
                fromToken === "EURC"
                  ? "bg-blue-600/20 border-blue-500 text-blue-400"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              EURC → USDC
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400">Payment Amount ({fromToken})</label>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-transparent text-xl font-bold text-white focus:outline-none w-full"
              required
            />
            <span className="text-xs font-bold text-slate-400 uppercase">{fromToken}</span>
          </div>
        </div>

        {/* Recipient Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400">Recipient Address</label>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="bg-transparent font-mono text-sm text-white focus:outline-none w-full"
              required
            />
          </div>
        </div>

        {/* Execution Timelock Presets */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400">Execution Timelock</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "1 Min", sec: 60 },
              { label: "5 Min", sec: 300 },
              { label: "1 Hour", sec: 3600 },
              { label: "Custom", sec: 0 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDelaySeconds(p.sec)}
                className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  delaySeconds === p.sec
                    ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {delaySeconds === 0 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Custom Date & Time</label>
            <input
              type="datetime-local"
              value={customTimestamp}
              onChange={(e) => setCustomTimestamp(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-sm text-white focus:outline-none"
              required
            />
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-50 text-white font-bold text-base shadow-xl shadow-indigo-600/30 hover:shadow-indigo-500/50 transition-all"
        >
          {loading ? "Locking Funds On-Chain..." : "Create Scheduled Payment"}
        </button>

        {/* Status Feedback */}
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
                View Transaction on Arcscan ↗
              </a>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
