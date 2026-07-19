import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URLS = [
  process.env.ARC_RPC_URL || "https://arc-testnet.drpc.org",
  "https://rpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network"
];

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SCHEDULER_ADDRESS = process.env.PAYMENT_SCHEDULER_ADDRESS;

if (!PRIVATE_KEY || !SCHEDULER_ADDRESS) {
  console.error("Missing PRIVATE_KEY or PAYMENT_SCHEDULER_ADDRESS in environment.");
  process.exit(1);
}

const SCHEDULER_ABI = [
  "function nextOrderId() view returns (uint256)",
  "function orders(uint256) view returns (uint256 id, address creator, address fromToken, address toToken, uint256 amount, address recipient, uint256 executeAfter, uint256 minReceived, uint8 status)",
  "function executeOrder(uint256 orderId) returns (uint256)"
];

async function getWorkingProvider() {
  for (const url of RPC_URLS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber();
      return { provider: p, url };
    } catch {
      continue;
    }
  }
  return { provider: new ethers.JsonRpcProvider(RPC_URLS[0]), url: RPC_URLS[0] };
}

async function main() {
  const { provider, url } = await getWorkingProvider();
  const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);

  console.log("==================================================");
  console.log("FlowFX Keeper Bot Started on Arc Testnet (Daemon Mode)");
  console.log(`Keeper Address : ${wallet.address}`);
  console.log(`Scheduler Addr : ${SCHEDULER_ADDRESS}`);
  console.log(`Active RPC     : ${url}`);
  console.log("==================================================");

  const schedulerContract = new ethers.Contract(SCHEDULER_ADDRESS!, SCHEDULER_ABI, wallet);

  async function checkAndExecuteOrders() {
    try {
      const nextId = await schedulerContract.nextOrderId();
      const currentBlock = await provider.getBlock("latest");
      const currentTimestamp = currentBlock ? currentBlock.timestamp : Math.floor(Date.now() / 1000);

      console.log(`[${new Date().toISOString()}] Scanning orders (Total: ${Number(nextId) - 1})...`);

      for (let id = 1; id < Number(nextId); id++) {
        const order = await schedulerContract.orders(id);
        const status = Number(order.status); // 0: Pending, 1: Executed, 2: Cancelled
        const executeAfter = Number(order.executeAfter);

        if (status === 0) {
          if (currentTimestamp >= executeAfter) {
            console.log(`\n⚡ Order #${id} is DUE for execution!`);
            console.log(`   ExecuteAfter : ${new Date(executeAfter * 1000).toLocaleString()}`);
            console.log(`   Current Time : ${new Date(currentTimestamp * 1000).toLocaleString()}`);
            console.log(`   Executing on-chain transaction...`);

            const tx = await schedulerContract.executeOrder(id);
            console.log(`   Broadcasted Tx Hash: ${tx.hash}`);
            console.log(`   Arcscan Link: https://testnet.arcscan.app/tx/${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`   ✅ Order #${id} executed successfully in block ${receipt.blockNumber}!`);
          } else {
            const timeRemaining = executeAfter - currentTimestamp;
            console.log(`   ⏳ Order #${id} pending (unlocks in ${timeRemaining}s)`);
          }
        }
      }
    } catch (err: any) {
      console.error("Error checking orders:", err.reason || err.message || err);
    }
  }

  await checkAndExecuteOrders();
  setInterval(checkAndExecuteOrders, 10000);
}

main().catch((err) => {
  console.error("Keeper Bot Fatal Error:", err);
  process.exit(1);
});
