// Node.js Express server
import express from 'express';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Set up __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Sim API key
const SIM_API_KEY = process.env.SIM_API_KEY;

// Session storage - in production, use Redis or a database
const sessions = new Map();

// Clean up old sessions (older than 1 hour)
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [sessionId, session] of sessions.entries()) {
        if (session.lastActivity < oneHourAgo) {
            sessions.delete(sessionId);
        }
    }
}, 10 * 60 * 1000); // Clean up every 10 minutes

// System prompt
const SYSTEM_PROMPT = `You are a helpful assistant that can answer questions about blockchain data using Dune's Sim APIs. You have access to various functions that can fetch real-time blockchain data including:

- Token balances for wallets across 60+ EVM chains
- Transaction activity and history
- NFT collections and collectibles
- Token metadata and pricing information
- Token holder distributions
- Supported blockchain networks

When users ask about blockchain data, wallet information, token details, or transaction history, use the appropriate functions to fetch real-time data. Always provide clear, helpful explanations of the data you retrieve.

For wallet addresses, you can analyze balances, activity, NFTs, and transactions. For tokens, you can get metadata, pricing, and holder information. Always format responses in a user-friendly way and explain what the data means.

Keep your responses concise and focused. When presenting large datasets, summarize the key findings rather than listing every detail.`;

// Function definitions for OpenAI function calling
const functions = [
    {
        type: "function",
        function: {
            name: "get_token_balances",
            description: "Get realtime token balances for an EVM wallet address across multiple chains. Returns native and ERC20 token balances with USD values.",
            parameters: {
                type: "object",
                properties: {
                    address: {
                        type: "string",
                        description: "The wallet address to get balances for (e.g., 0xd8da6bf26964af9d7eed9e03e53415d37aa96045)"
                    },
                    exclude_spam_tokens: {
                        type: "boolean",
                        description: "Whether to exclude spam tokens from results",
                        default: true
                    }
                },
                required: ["address"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_wallet_activity",
            description: "Get chronologically ordered transaction activity for an EVM wallet including transfers, contract interactions, and decoded function calls.",
            parameters: {
                type: "object",
                properties: {
                    address: {
                        type: "string",
                        description: "The wallet address to get activity for"
                    },
                    limit: {
                        type: "number",
                        description: "Maximum number of activities to return (default: 25)",
                        default: 25
                    }
                },
                required: ["address"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_nft_collectibles",
            description: "Get NFT collectibles (ERC721 and ERC1155) owned by an EVM wallet address.",
            parameters: {
                type: "object",
                properties: {
                    address: {
                        type: "string",
                        description: "The wallet address to get NFTs for"
                    },
                    limit: {
                        type: "number",
                        description: "Maximum number of collectibles to return (default: 50)",
                        default: 50
                    }
                },
                required: ["address"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_token_info",
            description: "Get detailed metadata and pricing information for a specific token on EVM chains.",
            parameters: {
                type: "object",
                properties: {
                    token_address: {
                        type: "string",
                        description: "The token contract address or 'native' for native tokens"
                    },
                    chain_ids: {
                        type: "string",
                        description: "Chain IDs to search on (e.g., '1,137,8453' or 'all')",
                        default: "all"
                    }
                },
                required: ["token_address"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_token_holders",
            description: "Get token holders for a specific ERC20 or ERC721 token, ranked by wallet value.",
            parameters: {
                type: "object",
                properties: {
                    chain_id: {
                        type: "number",
                        description: "The chain ID where the token exists (e.g., 1 for Ethereum)"
                    },
                    token_address: {
                        type: "string",
                        description: "The token contract address"
                    },
                    limit: {
                        type: "number",
                        description: "Maximum number of holders to return (default: 100)",
                        default: 100
                    }
                },
                required: ["chain_id", "token_address"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_transactions",
            description: "Get detailed transaction information for an EVM wallet address.",
            parameters: {
                type: "object",
                properties: {
                    address: {
                        type: "string",
                        description: "The wallet address to get transactions for"
                    },
                    limit: {
                        type: "number",
                        description: "Maximum number of transactions to return (default: 25)",
                        default: 25
                    }
                },
                required: ["address"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_supported_chains",
            description: "Get list of all supported EVM chains and their capabilities.",
            parameters: {
                type: "object",
                properties: {},
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_svm_token_balances",
            description: "Get token balances for a Solana (SVM) address. Returns native and SPL token balances with USD values.",
            parameters: {
                type: "object",
                properties: {
                    address: {
                        type: "string",
                        description: "The Solana wallet address to get balances for (e.g., DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK)"
                    },
                    limit: {
                        type: "number",
                        description: "Maximum number of balances to return (default: 100)",
                        default: 100
                    },
                    chains: {
                        type: "string",
                        description: "Comma-separated list of chains to include, or 'all' for all supported chains",
                        default: "all"
                    }
                },
                required: ["address"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_svm_token_metadata",
            description: "Get metadata for a Solana token mint address.",
            parameters: {
                type: "object",
                properties: {
                    mint: {
                        type: "string",
                        description: "The Solana token mint address (e.g., So11111111111111111111111111111111111111112)"
                    }
                },
                required: ["mint"],
                additionalProperties: false
            }
        }
    }
];

// Function implementations
async function get_token_balances(address, exclude_spam_tokens = true) {
    try {
        const queryParams = new URLSearchParams({
            'metadata': 'url,logo'
        });
        
        if (exclude_spam_tokens) {
            queryParams.append('exclude_spam_tokens', 'true');
        }

        const response = await fetch(`https://api.sim.dune.com/v1/evm/balances/${address}?${queryParams}`, {
            headers: {
                'X-Sim-Api-Key': SIM_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();

        return JSON.stringify(data);
    } catch (error) {
        return JSON.stringify({ error: error.message });
    }
}

async function get_wallet_activity(address, limit = 25) {
    try {
        const response = await fetch(`https://api.sim.dune.com/v1/evm/activity/${address}?limit=${Math.min(limit, 10)}`, {
            headers: {
                'X-Sim-Api-Key': SIM_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();

        return JSON.stringify(data);
    } catch (error) {
        return JSON.stringify({ error: error.message });
    }
}

async function get_nft_collectibles(address, limit = 50) {
    try {
        const response = await fetch(`https://api.sim.dune.com/v1/evm/collectibles/${address}?limit=${Math.min(limit, 10)}`, {
            headers: {
                'X-Sim-Api-Key': SIM_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();

        return JSON.stringify(data);
    } catch (error) {
        return JSON.stringify({ error: error.message });
    }
}

async function get_token_info(token_address, chain_ids = 'all') {
    try {
        const response = await fetch(`https://api.sim.dune.com/v1/evm/token-info/${token_address}?chain_ids=${chain_ids}`, {
            headers: {
                'X-Sim-Api-Key': SIM_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("what is data", data);
        return JSON.stringify(data);
    } catch (error) {
        return JSON.stringify({ error: error.message });
    }
}

async function get_token_holders(chain_id, token_address, limit = 100) {
    try {
        const response = await fetch(`https://api.sim.dune.com/v1/evm/token-holders/${chain_id}/${token_address}?limit=${Math.min(limit, 10)}`, {
            headers: {
                'X-Sim-Api-Key': SIM_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();

        return JSON.stringify(data);
    } catch (error) {
        return JSON.stringify({ error: error.message });
    }
}

async function get_transactions(address, limit = 25) {
    try {
        const response = await fetch(`https://api.sim.dune.com/v1/evm/transactions/${address}?limit=${Math.min(limit, 10)}`, {
            headers: {
                'X-Sim-Api-Key': SIM_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();

        return JSON.stringify(data);
    } catch (error) {
        return JSON.stringify({ error: error.message });
    }
}

async function get_supported_chains() {
    try {
        const response = await fetch('https://api.sim.dune.com/v1/evm/supported-chains', {
            headers: {
                'X-Sim-Api-Key': SIM_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        return JSON.stringify(data);
    } catch (error) {
        return JSON.stringify({ error: error.message });
    }
}

async function get_svm_token_balances(address, limit = 100, chains = 'all') {
    try {
        const queryParams = new URLSearchParams();
        if (chains) queryParams.append('chains', chains);
        if (limit) queryParams.append('limit', Math.min(limit, 20));
        const response = await fetch(`https://api.sim.dune.com/beta/svm/balances/${address}?${queryParams}`,
            {
                headers: {
                    'X-Sim-Api-Key': SIM_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }
        const data = await response.json();

        return JSON.stringify(data);
    } catch (error) {
        return JSON.stringify({ error: error.message });
    }
}

async function get_svm_token_metadata(mint) {
    try {
        const response = await fetch(`https://api.sim.dune.com/beta/svm/token-metadata/${mint}`,
            {
                headers: {
                    'X-Sim-Api-Key': SIM_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }
        const data = await response.json();

        return JSON.stringify(data);
    } catch (error) {
        return JSON.stringify({ error: error.message });
    }
}

// Function router
async function callFunction(name, args) {
    switch (name) {
        case 'get_token_balances':
            return await get_token_balances(args.address, args.exclude_spam_tokens);
        case 'get_wallet_activity':
            return await get_wallet_activity(args.address, args.limit);
        case 'get_nft_collectibles':
            return await get_nft_collectibles(args.address, args.limit);
        case 'get_token_info':
            return await get_token_info(args.token_address, args.chain_ids);
        case 'get_token_holders':
            return await get_token_holders(args.chain_id, args.token_address, args.limit);
        case 'get_transactions':
            return await get_transactions(args.address, args.limit);
        case 'get_supported_chains':
            return await get_supported_chains();
        case 'get_svm_token_balances':
            return await get_svm_token_balances(args.address, args.limit, args.chains);
        case 'get_svm_token_metadata':
            return await get_svm_token_metadata(args.mint);
        default:
            return JSON.stringify({ error: `Unknown function: ${name}` });
    }
}

// Get or create session
function getSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            messages: [{ role: "system", content: SYSTEM_PROMPT }],
            lastActivity: Date.now()
        });
    }
    
    const session = sessions.get(sessionId);
    session.lastActivity = Date.now();
    
    // Keep only recent messages to prevent token overflow
    if (session.messages.length > 20) {
        // Keep system message and last 10 exchanges (20 messages)
        session.messages = [
            session.messages[0], // system message
            ...session.messages.slice(-19) // last 19 messages
        ];
    }
    
    return session;
}

// Chat endpoint
app.post('/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Use provided sessionId or generate a new one
        const currentSessionId = sessionId || crypto.randomUUID();
        const session = getSession(currentSessionId);
        
        // Add user message to session
        session.messages.push({ role: "user", content: message });

        // Call OpenAI with function calling
        const response = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: session.messages,
            tools: functions,
            tool_choice: "auto",
            max_tokens: 32768 // Limit response tokens
        });

        let assistantMessage = response.choices[0].message;
        
        // Handle function calls
        if (assistantMessage.tool_calls) {
            // Add assistant message with tool calls to session
            session.messages.push(assistantMessage);
            
            // Execute each function call
            for (const toolCall of assistantMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                console.log(`Calling function: ${functionName} with args:`, functionArgs);
                
                const functionResult = await callFunction(functionName, functionArgs);
                
                // Add function result to session
                session.messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: functionResult
                });
            }
            
            // Get final response from OpenAI
            const finalResponse = await openai.chat.completions.create({
                model: "gpt-4.1-mini",
                messages: session.messages,
                tools: functions,
                tool_choice: "auto",
                max_tokens: 32768 // Limit response tokens
            });
            
            assistantMessage = finalResponse.choices[0].message;
        }

        // Add assistant response to session
        session.messages.push(assistantMessage);

        res.json({ 
            message: assistantMessage.content,
            sessionId: currentSessionId,
            function_calls: assistantMessage.tool_calls || []
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            error: 'An error occurred while processing your request',
            details: error.message 
        });
    }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// export default app;
