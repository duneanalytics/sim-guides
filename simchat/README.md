# Sim APIs Chatbot

A chatbot that uses Dune's Sim APIs with OpenAI's function calling feature to answer questions about blockchain data.

## Features

- **Token Balances**: Get realtime token balances for any EVM wallet address across 60+ chains
- **Wallet Activity**: View transaction history including transfers and contract interactions
- **NFT Collections**: Explore NFT collectibles owned by wallet addresses
- **Token Information**: Get detailed metadata and pricing for specific tokens
- **Token Holders**: Discover token distribution across holders
- **Supported Chains**: View all supported EVM chains and their capabilities

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Open your browser** and navigate to `http://localhost:3000`

## Usage

The chatbot can answer questions about blockchain data. Try asking:

- "What are the token balances for 0xd8da6bf26964af9d7eed9e03e53415d37aa96045?"
- "Show me the recent activity for Vitalik's wallet"
- "What NFTs does this address own?"
- "Get token information for USDC"
- "Who are the top holders of this token?"

## API Keys

The application uses hardcoded API keys for demonstration purposes:
- OpenAI API Key: Configured in `index.js`
- Sim API Key: Configured in `index.js`

## Architecture

- **Backend**: Node.js with Express.js
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **AI**: OpenAI GPT-4 with function calling
- **Data**: Dune's Sim APIs for blockchain data

## Function Calling

The chatbot uses OpenAI's function calling feature to:
1. Analyze user queries
2. Determine which Sim API endpoints to call
3. Execute the appropriate API calls
4. Format and present the results to users

## Supported Sim API Endpoints

- `/v1/evm/balances/{address}` - Token balances
- `/v1/evm/activity/{address}` - Wallet activity
- `/v1/evm/collectibles/{address}` - NFT collections
- `/v1/evm/token-info/{token_address}` - Token information
- `/v1/evm/token-holders/{chain_id}/{token_address}` - Token holders
- `/v1/evm/transactions/{address}` - Transaction details
- `/v1/evm/supported-chains` - Supported chains

## Development

For development with auto-restart:
```bash
npm run dev
```
