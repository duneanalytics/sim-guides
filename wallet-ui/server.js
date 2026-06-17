import express from 'express';
import numbro from 'numbro';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { change1h, change6h, change24h, formatSignedPercent } from './utils/prices.js';

// Load environment variables
dotenv.config();
const SIM_API_KEY = process.env.SIM_API_KEY;

if (!SIM_API_KEY) {
    console.error("FATAL ERROR: SIM_API_KEY is not set in your environment variables.");
    process.exit(1);
}

// Set up __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();

// Configure Express settings
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

async function getWalletActivity(walletAddress, limit = 25) { // Default to fetching 25 activities
    if (!walletAddress) return [];

    // The Activity API is currently in beta.
    // We add a 'limit' query parameter to control how many activities are returned.
    const url = `https://api.sim.dune.com/v1/evm/activity/${walletAddress}?limit=${limit}`;

    try {
        const response = await fetch(url, {
            headers: {
                'X-Sim-Api-Key': SIM_API_KEY, // Your API key from .env
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Activity API request failed with status ${response.status}: ${response.statusText}`, errorBody);
            throw new Error(`Activity API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        // The API returns activity items in the 'activity' key of the JSON response.
        return data.activity || []; 
    } catch (error) {
        console.error("Error fetching wallet activity:", error.message);
        return []; // Return empty array on error
    }
}

async function getWalletBalances(walletAddress, { includeHistoricalPrices = false } = {}) {
    if (!walletAddress) return []; // Return empty if no address

    // Construct the query parameters
    // metadata=url,logo fetches token URLs and logo images
    // exclude_spam_tokens filters out known spam tokens
    const queryParts = [
        'metadata=url,logo',
        'exclude_spam_tokens'
    ];

    if (includeHistoricalPrices) {
        queryParts.push('historical_prices=1,6,24');
    }

    const url = `https://api.sim.dune.com/v1/evm/balances/${walletAddress}?${queryParts.join('&')}`;

    try {
        const response = await fetch(url, {
            headers: {
                'X-Sim-Api-Key': SIM_API_KEY, // Your API key from .env
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`API request failed with status ${response.status}: ${response.statusText}`, errorBody);
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();

        // Return formatted values and amounts
        return (data.balances || []).map(token => {
            // 1. Calculate human-readable token amount (defensive)
            const decimalsNum = Number.parseInt(token.decimals);
            const amountRaw = Number.parseFloat(token.amount);
            const hasValidAmount = Number.isFinite(amountRaw) && Number.isFinite(decimalsNum) && decimalsNum >= 0;
            const numericAmount = hasValidAmount ? (amountRaw / Math.pow(10, decimalsNum)) : null;

            // 2. Get numeric USD value (defensive)
            const numericValueUSD = token.value_usd != null ? Number(token.value_usd) : null;

            // 3. Format using numbro only when valid
            const valueUSDFormatted = (numericValueUSD != null && Number.isFinite(numericValueUSD))
                ? numbro(numericValueUSD).format('$0,0.00')
                : null;
            const amountFormatted = (numericAmount != null && Number.isFinite(numericAmount))
                ? numbro(numericAmount).format('0,0.[00]A')
                : null;

            return {
                ...token,
                valueUSDFormatted,
                amountFormatted
            };
        }).filter(token => token.symbol !== 'RTFKT');

    } catch (error) {
        console.error("Error fetching wallet balances:", error.message);
        return []; // Return empty array on error
    }
}

async function getWalletCollectibles(walletAddress, limit = 50) {
    if (!walletAddress) return [];

    const url = `https://api.sim.dune.com/v1/evm/collectibles/${walletAddress}?limit=${limit}`;

    try {
        const response = await fetch(url, {
            headers: {
                'X-Sim-Api-Key': SIM_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Collectibles API request failed with status ${response.status}: ${response.statusText}`, errorBody);
            throw new Error(`Collectibles API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        const collectibles = data.entries || [];

        // Use Sim APIs data directly - no need for external API calls
        return collectibles.map(collectible => {
            return {
                ...collectible,
                // Use collection_name field, fallback to name if not available
                collection_name: collectible.name || `Token #${collectible.token_id}`
            };
        }).filter(collectible => collectible.image_url); // Only show collectibles with images

    } catch (error) {
        console.error("Error fetching wallet collectibles:", error.message);
        return [];
    }
}

// Add our home route
app.get('/', async (req, res) => {
    const { 
        walletAddress = '',
        tab = 'tokens'
    } = req.query;

    let tokens = [];
    let activities = [];
    let collectibles = [];
    let totalWalletUSDValue = 0;
    let errorMessage = null;

    if (walletAddress) {
        try {

            [tokens, activities, collectibles] = await Promise.all([
                getWalletBalances(walletAddress, { includeHistoricalPrices: tab === 'tokens' }),
                getWalletActivity(walletAddress, 25), // Fetching 25 recent activities
                getWalletCollectibles(walletAddress, 50) // Fetching 50 collectibles
            ]);

            // Calculate the total USD value from the fetched tokens
            if (tokens && tokens.length > 0) {
                tokens.forEach(token => {
                    let individualValue = parseFloat(token.value_usd);
                    if (!isNaN(individualValue)) {
                        totalWalletUSDValue += individualValue;
                    }
                });
            }
            
            totalWalletUSDValue = numbro(totalWalletUSDValue).format('$0,0.00');

        } catch (error) {
            console.error("Error in route handler:", error);
            errorMessage = "Failed to fetch wallet data. Please try again.";
            // tokens will remain empty, totalWalletUSDValue will be 0
        }
    }

    res.render('wallet', {
        walletAddress: walletAddress,
        currentTab: tab,
        totalWalletUSDValue: totalWalletUSDValue, // We'll calculate this in the next section
        tokens: tokens,
        activities: activities, // Placeholder for Guide 2
        collectibles: collectibles, // Now populated with actual data
        errorMessage: errorMessage,
        // Helpers for EJS (Tokens tab will use these; other tabs unaffected)
        change1h,
        change6h,
        change24h,
        formatSignedPercent,
        helpers: { change1h, change6h, change24h, formatSignedPercent }
    });
});

app.listen(3001, () => {
    console.log('Server is running on port 3001');
});

// export default app;