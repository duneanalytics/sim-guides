# sim Real-Time Wallet UI

A modern, accessible, and responsive wallet interface for viewing crypto assets and transactions. This example demonstrates a simple integration with Dune's sim APIs to build a basic wallet user interface.

To read the full guide, visit [https://docs.sim.dune.com/evm/wallet-ui](https://docs.sim.dune.com/evm/wallet-ui).

## Features

- 💰 View total wallet balance
- 🪙 List and track token balances
- 📊 View transaction history
- 🖼️ NFT/Collectibles support (coming soon)
- 🌙 Dark mode by default
- 📱 Responsive design

## Prerequisites

- Node.js >= 18.0.0
- A Dune API key

## Getting Started

1. Clone the repository
2. Navigate to the wallet-ui directory:
   ```bash
   cd wallet-ui
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up your environment:
   ```bash
   # Copy the template file
   cp .env.template .env
   
   # Open .env in your preferred editor and add your Dune API key
   # Replace 'your_api_key_here' with your actual Dune API key
   ```

## Project Structure

```
wallet-ui/
├── index.ejs          # Main HTML template
├── styles/
│   └── main.css       # Styles and theme variables
├── js/
│   └── main.js        # JavaScript functionality
└── README.md          # Documentation
```
