# Sim Guides

**Official guides and examples for Sim by Dune** — a high-performance, multichain blockchain data API. 📦

🔗 [**Sim Docs**](https://docs.sim.dune.com/)

-----

## 🚀 Why Sim?

Get **fast, normalized on-chain data** across 60+ EVM chains (plus Solana beta). Ideal for wallets, analytics, bots, and AI agents.

-----

## 📚 What's Inside

Step-by-step guides for:

  * **Real-time Multi-chain Wallet** (`wallet-ui/`)
  * **NFT Collectibles Display**
  * **Real-time AI Chat Agent** (`simchat/`)

-----

## ⚡ Quickstart

1.  **Get API Key:** [Sim Dashboard](https://www.google.com/search?q=https://docs.sim.dune.com/guides/api-keys)
2.  **First Call:**
    ```bash
    curl -H "X-Sim-Api-Key: $SIM_API_KEY" https://api.sim.dune.com/v1/evm/balances/0xd8da6...6045
    ```
3.  **Run Examples:**
    ```bash
    git clone https://github.com/duneanalytics/sim-guides
    cd sim-guides/wallet-ui # or simchat
    npm install
    cp .env.template .env # Add API keys
    node server.js        # (for wallet-ui)
    open http://localhost:3001
    ```

-----

## ✅ Best Practices

  * Use **HTTPS**.
  * Keep **API keys secure** (`.env`).
  * Implement **pagination**.
  * Handle **errors/rate limits**.

-----

## 🔗 Learn More

  * **API Reference:** [https://docs.sim.dune.com](https://docs.sim.dune.com)
  * **Code Examples:** See `simchat/` and `wallet-ui/`
  * **Community:** [Open an issue](https://www.google.com/search?q=https://github.com/duneanalytics/sim-guides/issues)
