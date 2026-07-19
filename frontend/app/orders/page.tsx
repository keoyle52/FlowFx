"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, PAYMENT_SCHEDULER_ABI, ARC_TESTNET_CONFIG } from "@/lib/contracts";

interface OrderData {
  id: number;
  creator: string;
  fromToken: string;
  toToken: string;
  amount: string;
  recipient: string;
  executeAfter: number;
  status: number; // 0: Pending, 1: Executed, 2: Cancelled
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);

  async function getProvider() {
    try {
      const p1 = new ethers.JsonRpcProvider(ARC_TESTNET_CONFIG.rpcUrl);
      await p1.getBlockNumber();
      return p1;
    } catch {
      return new ethers.JsonRpcProvider(ARC_TESTNET_CONFIG.fallbackRpcUrl);
    }
  }

  async function fetchOrders() {
    try {
      setErrorMessage(null);
      const provider = await getProvider();
      const scheduler = new ethers.Contract(CONTRACT_ADDRESSES.PaymentScheduler, PAYMENT_SCHEDULER_ABI, provider);

      const nextId = await scheduler.nextOrderId();
      const total = Number(nextId) - 1;

      const loadedOrders: OrderData[] = [];
      for (let i = 1; i <= total; i++) {
        try {
          const o = await scheduler.getOrder(i);
          loadedOrders.push({
            id: Number(o.id || i),
            creator: o.creator || "",
            fromToken: o.fromToken || "",
            toToken: o.toToken || "",
            amount: o.amount ? (Number(o.amount) / 1e6).toFixed(2) : "0.00",
            recipient: o.recipient || "",
            executeAfter: Number(o.executeAfter || 0),
            status: Number(o.status || 0)
          });
        } catch (itemErr) {
          console.warn(`Could not load order #${i}:`, itemErr);
        }
      }

      setOrders(loadedOrders.reverse()); // Show newest first

      if (typeof window !== "undefined" && (window as any).ethereum) {
        try {
          const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
          const accounts = await browserProvider.send("eth_accounts", []);
          if (accounts.length > 0) setCurrentAccount(accounts[0]);
        } catch {
          // ignore wallet query error
        }
      }
    } catch (e: any) {
      console.error("Error fetching orders:", e);
      setErrorMessage("Notice: Arc RPC rate-limited. Retrying automatically...");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 6000);
    return () => clearInterval(interval);
  }, []);

  async function handleExecute(orderId: number) {
    if (!currentAccount) {
      alert("Please connect your wallet first.");
      return;
    }
    setActionLoadingId(orderId);
    try {
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await browserProvider.getSigner();
      const scheduler = new ethers.Contract(CONTRACT_ADDRESSES.PaymentScheduler, PAYMENT_SCHEDULER_ABI, signer);

      const tx = await scheduler.executeOrder(orderId);
      await tx.wait();
      alert(`Order #${orderId} executed successfully!`);
      fetchOrders();
    } catch (err: any) {
      console.error("Execute error:", err);
      alert(`Execution failed: ${err.reason || err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCancel(orderId: number) {
    if (!currentAccount) {
      alert("Please connect your wallet first.");
      return;
    }
    setActionLoadingId(orderId);
    try {
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await browserProvider.getSigner();
      const scheduler = new ethers.Contract(CONTRACT_ADDRESSES.PaymentScheduler, PAYMENT_SCHEDULER_ABI, signer);

      const tx = await scheduler.cancelOrder(orderId);
      await tx.wait();
      alert(`Order #${orderId} cancelled & funds refunded!`);
      fetchOrders();
    } catch (err: any) {
      console.error("Cancel error:", err);
      alert(`Cancellation failed: ${err.reason || err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  }

  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Live On-Chain Orders</h1>
          <p className="text-sm text-slate-400">Real-time contract state from Arc Testnet PaymentScheduler</p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-all"
        >
          🔄 Refresh Orders
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-400 text-center">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-3xl border border-slate-800">
          Loading orders from Arc Testnet contract...
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/50 rounded-3xl border border-slate-800 space-y-3">
          <p className="text-slate-400 font-medium">No scheduled payment orders found on-chain.</p>
          <a
            href="/schedule"
            className="inline-block px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 transition-all"
          >
            Create First Scheduled Payment ↗
          </a>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Tokens</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Recipient</th>
                  <th className="px-6 py-4">Execution Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {orders.map((o) => {
                  const isPending = o.status === 0;
                  const isExecuted = o.status === 1;
                  const isCancelled = o.status === 2;
                  const isDue = isPending && now >= o.executeAfter;
                  const isCreator = Boolean(currentAccount && o.creator && currentAccount.toLowerCase() === o.creator.toLowerCase());

                  const isUsdc = o.fromToken && o.fromToken.toLowerCase() === CONTRACT_ADDRESSES.USDC.toLowerCase();
                  const recipientDisplay = o.recipient && o.recipient.length >= 10 ? `${o.recipient.slice(0, 6)}...${o.recipient.slice(-4)}` : (o.recipient || "—");

                  return (
                    <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-white">#{o.id}</td>
                      <td className="px-6 py-4 font-semibold text-xs text-blue-400">
                        {isUsdc ? "USDC ➔ EURC" : "EURC ➔ USDC"}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-white">{o.amount}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {recipientDisplay}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="text-slate-200">{o.executeAfter ? new Date(o.executeAfter * 1000).toLocaleString() : "—"}</div>
                        {isPending && (
                          <div className="text-[10px] text-cyan-400">
                            {isDue ? "⚡ Ready for Keeper Execution" : `Unlocks in ${Math.max(0, o.executeAfter - now)}s`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Pending
                          </span>
                        )}
                        {isExecuted && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ✅ Executed
                          </span>
                        )}
                        {isCancelled && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            ❌ Cancelled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {isDue && (
                          <button
                            onClick={() => handleExecute(o.id)}
                            disabled={actionLoadingId === o.id}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all"
                          >
                            Execute
                          </button>
                        )}
                        {isPending && !isDue && isCreator && (
                          <button
                            onClick={() => handleCancel(o.id)}
                            disabled={actionLoadingId === o.id}
                            className="px-3 py-1.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600 hover:text-white font-bold text-xs transition-all"
                          >
                            Cancel
                          </button>
                        )}
                        <a
                          href={`${ARC_TESTNET_CONFIG.blockExplorerUrl}/address/${CONTRACT_ADDRESSES.PaymentScheduler}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-xs text-slate-500 hover:text-slate-300 underline font-mono"
                        >
                          Arcscan ↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
