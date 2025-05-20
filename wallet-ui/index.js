import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import ejs from 'ejs';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const SIM_API_KEY = process.env.SIM_API_KEY;
const DUNE_API_BASE_URL = 'https://api.dune.com/api';
const DEFAULT_CHAIN_IDS = 'all'; // Ethereum, Polygon, Base, Arbitrum, Optimism
const DEFAULT_ACTIVITY_LIMIT = 20; // Number of activities per page

if (!SIM_API_KEY) {
    console.error("FATAL ERROR: SIM_API_KEY is not set in your environment variables.");
    process.exit(1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Makes a request to the Dune SIM API.
 * @param {string} endpoint - The API endpoint path (e.g., /echo/v1/balances/evm/0x123)
 * @param {object} params - Query parameters as an object.
 * @returns {Promise<object>} - The JSON response from the API.
 * @throws {Error} - If the API request fails.
 */
async function callSimApi(endpoint, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = `${DUNE_API_BASE_URL}${endpoint}${queryParams ? '?' + queryParams : ''}`;
    console.log(`Calling SIM API: ${url}`); // For debugging

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'X-Sim-Api-Key': SIM_API_KEY,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`SIM API Error (${response.status}): ${errorBody}`);
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }
    return response.json();
}

/**
 * Fetches and processes token balances for a given address and chains.
 * @param {string} walletAddress
 * @param {string} chainIdsString - Comma-separated string of chain IDs.
 * @returns {Promise<object>} - Object containing formatted tokens and total USD value.
 */
async function getWalletBalances(walletAddress, chainIdsString) {
    try {
        // For balances, we might want to fetch all or a large limit if not paginating tokens list for now
        const data = await callSimApi(`/echo/v1/balances/evm/${walletAddress}`, {
            chain_ids: chainIdsString,
            metadata: "url,logo",
            exclude_spam_tokens: "true",
            limit: 1000
        });

        let totalValue = 0;
        const formattedTokens = data.balances ? data.balances.map(token => {
            totalValue += parseFloat(token.value_usd || 0);

            let balanceFormatted = token.amount;
            if (token.amount && typeof token.decimals === 'number') {
                try {
                    const rawAmount = BigInt(token.amount);
                    const divisor = BigInt(10 ** token.decimals);
                    const integerPart = rawAmount / divisor;
                    const fractionalPart = rawAmount % divisor;
                    balanceFormatted = integerPart.toString();
                    if (token.decimals > 0 && fractionalPart > 0) {
                        balanceFormatted += '.' + fractionalPart.toString().padStart(token.decimals, '0').replace(/0+$/, '');
                    }
                } catch (e) {
                    console.warn("Could not format balance for token:", token.symbol, e);
                }
            }

            return {
                ...token,
                symbol: token.symbol || 'N/A',
                name: token.name || 'Unknown Token',
                chainName: token.chain || 'Unknown Chain',
                balanceFormatted: balanceFormatted,
                priceUSDFormatted: token.price_usd != null ? `$${parseFloat(token.price_usd).toFixed(2)}` : 'N/A',
                usdValueFormatted: token.value_usd != null ? `$${parseFloat(token.value_usd).toFixed(2)}` : '$0.00',
                tokenUrl: token.token_metadata?.url || null,
                tokenLogo: token.token_metadata?.logo || null
            };
        }) : [];

        return {
            tokens: formattedTokens,
            totalWalletUSDValue: `$${totalValue.toFixed(2)}`
        };
    } catch (error) {
        console.error("Error in getWalletBalances:", error.message);
        return { tokens: [], totalWalletUSDValue: '$0.00', error: error.message };
    }
}

/**
 * Fetches and processes wallet activity.
 * @param {string} walletAddress
 * @param {string} activityOffset - The offset for pagination from SIM API.
 * @returns {Promise<object>} - Object containing formatted activities and next offset.
 */
async function getWalletActivity(walletAddress, activityOffset = null) {
    try {
        const params = { limit: DEFAULT_ACTIVITY_LIMIT };
        if (activityOffset) {
            params.offset = activityOffset;
        }
        const data = await callSimApi(`/echo/beta/activity/evm/${walletAddress}`, params);

        const formattedActivities = data.activity ? data.activity.map(act => {
            const assetSymbol = act.token_metadata?.symbol || act.asset_type?.toUpperCase() || 'N/A';
            let amountFormatted = act.value;
             if (act.value && act.token_metadata?.decimals != null) {
                try {
                    const rawAmount = BigInt(act.value);
                    const divisor = BigInt(10 ** act.token_metadata.decimals);
                    const integerPart = rawAmount / divisor;
                    const fractionalPart = rawAmount % divisor;
                    amountFormatted = integerPart.toString();
                    if (act.token_metadata.decimals > 0 && fractionalPart > 0) {
                        amountFormatted += '.' + fractionalPart.toString().padStart(act.token_metadata.decimals, '0').replace(/0+$/, '');
                    }
                } catch (e) { /*  use raw value */ }
            }

            const partyAddress = act.type === 'receive' ? act.from : act.to;
            const partyAddressShort = partyAddress ? `${partyAddress.substring(0, 6)}...${partyAddress.substring(partyAddress.length - 4)}` : 'N/A';

            return {
                ...act,
                type: act.type || 'unknown', // e.g. receive, send, call
                directionLabel: act.type ? act.type.charAt(0).toUpperCase() + act.type.slice(1) : 'Unknown',
                assetSymbol: assetSymbol,
                partyLabel: act.type === 'receive' ? 'From' : (act.type === 'send' ? 'To' : (act.to ? 'To' : 'Contract')),
                partyAddressShort: partyAddressShort,
                timestampFormatted: act.block_time ? new Date(act.block_time).toLocaleString() : 'N/A',
                amountPrefix: act.type === 'receive' ? '+' : (act.type === 'send' ? '-' : ''),
                amountFormatted: amountFormatted,
                usdValueFormattedAtTime: act.value_usd != null ? `$${parseFloat(act.value_usd).toFixed(2)}` : 'N/A'
            };
        }) : [];

        return {
            activities: formattedActivities,
            nextActivityOffset: data.next_offset || null, // For pagination
            error: null
        };
    } catch (error) {
        console.error("Error in getWalletActivity:", error.message);
        return { activities: [], nextActivityOffset: null, error: error.message };
    }
}


// --- Main Route ---
app.get('/', async (req, res) => {
    const {
        walletAddress, // User input
        chainIds = DEFAULT_CHAIN_IDS, // User input or default
        tab = 'tokens', // From query param, defaults to 'tokens'
        activity_offset // For activity pagination
    } = req.query;

    let viewData = {
        walletAddress: walletAddress || '', // Pass back for pre-filling form
        chainIds: chainIds,
        currentTab: tab,
        totalWalletUSDValue: '$0.00',
        tokens: [],
        activities: [],
        nextActivityOffset: null,
        errorMessage: null
    };

    if (walletAddress) {
        try {
            // Fetch balances and total value regardless of tab, as total value is always shown
            const balanceData = await getWalletBalances(walletAddress, chainIds);
            if (balanceData.error) throw new Error(`Balances Error: ${balanceData.error}`);
            viewData.tokens = balanceData.tokens;
            viewData.totalWalletUSDValue = balanceData.totalWalletUSDValue;

            // Fetch activity only if activity tab or if needed for other purposes
            // For now, let's assume activity is primarily for its tab
            // if (tab === 'activity' || some_other_condition) {
            const activityData = await getWalletActivity(walletAddress, activity_offset);
            if (activityData.error) throw new Error(`Activity Error: ${activityData.error}`);
            viewData.activities = activityData.activities;
            viewData.nextActivityOffset = activityData.nextActivityOffset;
            // }

            // Note: Collectibles are not implemented, so no data fetching for that.

        } catch (error) {
            console.error("Error fetching wallet data:", error.message);
            viewData.errorMessage = error.message || "Failed to fetch wallet data.";
            // Reset data on error to avoid showing stale info with an error message
            viewData.tokens = [];
            viewData.activities = [];
            viewData.totalWalletUSDValue = '$0.00';
        }
    }

    // If no walletAddress, EJS template will show placeholders or "Enter address" messages
    console.log('viewData', viewData);

    res.render('index', viewData);
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`SIM Wallet Dashboard server running on http://localhost:${PORT}`);
    console.log(`Using chains: ${DEFAULT_CHAIN_IDS} by default.`);
});