# FlowFX — Programmable Money & Scheduled FX Settlement Protocol

> **Built on Arc Testnet** for the **Programmable Money Hackathon — DeFi Track**

FlowFX is a decentralized FX payment & payroll protocol built on **Arc Testnet**. It enables instant **USDC ⇄ EURC stablecoin swaps** and **time-locked conditional cross-currency payment scheduling** (e.g., automated international payroll and recurring supplier invoices).

---

## 🏆 Deployed Smart Contracts (Arc Testnet — Chain ID: `5042002`)

| Contract | Verified Address | Block Explorer Link |
| :--- | :--- | :--- |
| **FXPool** | `0xC2F1dceB5E75ba7d926Cc0Ce37284C5236178ba4` | [Arcscan Link](https://testnet.arcscan.app/address/0xC2F1dceB5E75ba7d926Cc0Ce37284C5236178ba4) |
| **PaymentScheduler** | `0x14553fF66fB3883C87d6ACa3830bE126586D7d4b` | [Arcscan Link](https://testnet.arcscan.app/address/0x14553fF66fB3883C87d6ACa3830bE126586D7d4b) |
| **USDC (ERC-20)** | `0x3600000000000000000000000000000000000000` | [Arcscan Link](https://testnet.arcscan.app/token/0x3600000000000000000000000000000000000000) |
| **EURC (ERC-20)** | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | [Arcscan Link](https://testnet.arcscan.app/token/0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a) |

---

## ⚡ Why Arc Network?

1. **Native USDC Fee Model**: On Arc, gas fees are paid in native USDC, removing multi-currency token management friction for automated corporate treasury and payroll systems.
2. **Deterministic & Ultra-Low Gas**: Automated recurring payments become economically viable due to Arc's predictable, sub-cent execution costs.
3. **Sub-second Finality**: Enables Keeper bots to execute time-locked settlement steps (Lock → Swap → Deliver) atomically without front-running risks.

---

## 📐 System Architecture & Workflow

```
FlowFX/
├── contracts/               — Solidity Smart Contracts & Foundry Suite
│   ├── src/
│   │   ├── FXPool.sol              — Fixed-rate USDC/EURC swap vault (0.3% fee spread)
│   │   └── PaymentScheduler.sol    — Timelocked order scheduling & settlement engine
│   ├── test/                       — Unit & Reentrancy tests (100% pass)
│   └── script/Deploy.s.sol         — Deployment script
├── keeper/                  — Automated Execution Bot
│   └── src/executor.ts             — Node.js / Ethers bot scanning & executing due orders
├── frontend/                — Next.js 14 App Router Web Application
│   ├── app/page.tsx                — Instant Swap UI (Real-time RPC balances & rate)
│   ├── app/schedule/page.tsx       — Schedule Automated Payment Form
│   └── app/orders/page.tsx         — On-Chain Live Orders Dashboard
└── README.md
```

---

## 🛠️ Local Installation & Development Commands

### 1. Smart Contracts (`contracts/`)
```bash
cd contracts
forge install
forge build
forge test -vvv
```

### 2. Frontend Web App (`frontend/`)
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 3. Keeper Execution Bot (`keeper/`)
```bash
cd keeper
npm install
cp .env.example .env # Set your keeper private key
npx ts-node src/executor.ts
```

---

## ⚠️ Known Limitations & Design Rationale

1. **Fixed-rate AMM**: The current `FXPool` implementation uses a fixed exchange rate (1 USDC = 0.92 EURC, 0.3% fee spread) for hackathon demonstration. A production version would integrate Pyth / Chainlink oracle feeds for real-time FX rates.
2. **Keeper Bot Automation**: The current Keeper bot runs as a lightweight TypeScript node process. Production deployments can transition to decentralized automation networks (e.g. Gelato Network or Chainlink Automation).
3. **Custom FX Pool vs. Generic App Kit Swap**: FlowFX uses a custom dedicated vault (`FXPool`) to allow atomic, time-locked cross-currency settlement combined with approval delegation inside `PaymentScheduler`.

---

## 🚀 Deployment Guide (Vercel & Server Setup)

- **Frontend Deployment**: ONLY the `frontend/` directory is deployed to Vercel or Netlify. Set root directory to `frontend` when configuring Vercel.
- **Keeper Service**: The `keeper/` bot must run separately as a background daemon (e.g., PM2, Docker container, or AWS Lambda cron) to monitor Arc Testnet blocks.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
