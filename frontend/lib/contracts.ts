import { ethers } from "ethers";

export const ARC_TESTNET_CONFIG = {
  chainId: 5042002,
  hexChainId: "0x4cef52",
  chainName: "Arc Testnet",
  rpcUrl: "https://arc-testnet.drpc.org",
  rpcUrls: [
    "https://arc-testnet.drpc.org",
    "https://rpc.testnet.arc.network",
    "https://rpc.blockdaemon.testnet.arc.network"
  ],
  blockExplorerUrl: "https://testnet.arcscan.app",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18
  }
};

export async function getArcProvider(): Promise<ethers.JsonRpcProvider> {
  for (const url of ARC_TESTNET_CONFIG.rpcUrls) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber();
      return p;
    } catch {
      continue;
    }
  }
  return new ethers.JsonRpcProvider(ARC_TESTNET_CONFIG.rpcUrls[0]);
}

export const CONTRACT_ADDRESSES = {
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  FXPool: "0xC2F1dceB5E75ba7d926Cc0Ce37284C5236178ba4",
  PaymentScheduler: "0x14553fF66fB3883C87d6ACa3830bE126586D7d4b"
};

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

export const FX_POOL_ABI = [
  "function usdc() view returns (address)",
  "function eurc() view returns (address)",
  "function rateNumerator() view returns (uint256)",
  "function RATE_PRECISION() view returns (uint256)",
  "function feeBps() view returns (uint256)",
  "function getRate() view returns (uint256 _rateNumerator, uint256 _ratePrecision, uint256 _feeBps)",
  "function swapUSDCtoEURC(uint256 usdcIn, uint256 minEurcOut) returns (uint256)",
  "function swapEURCtoUSDC(uint256 eurcIn, uint256 minUsdcOut) returns (uint256)",
  "function addLiquidity(uint256 usdcAmount, uint256 eurcAmount)"
];

export const PAYMENT_SCHEDULER_ABI = [
  "function nextOrderId() view returns (uint256)",
  "function orders(uint256) view returns (uint256 id, address creator, address fromToken, address toToken, uint256 amount, address recipient, uint256 executeAfter, uint256 minReceived, uint8 status)",
  "function createOrder(address fromToken, address toToken, uint256 amount, address recipient, uint256 executeAfter, uint256 minReceived) returns (uint256)",
  "function executeOrder(uint256 orderId) returns (uint256)",
  "function cancelOrder(uint256 orderId)",
  "function getUserOrders(address user) view returns (uint256[])",
  "function getOrder(uint256 orderId) view returns (tuple(uint256 id, address creator, address fromToken, address toToken, uint256 amount, address recipient, uint256 executeAfter, uint256 minReceived, uint8 status))"
];
