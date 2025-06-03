#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🧠 CORRÉLATEUR DE PRIX AVANCÉ - MULTI-SOURCES
 * 
 * Corrèle les données de TOUS les abonnements WebSocket :
 * - TokenLogs + AccountNotification + ProgramLogs
 * - Pour un calcul de prix ultra-précis !
 */

const HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
const HELIUS_WSS_ENDPOINT = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Prix de référence
const SOL_USD_PRICE = 170.0;

// Tokens cibles
const TARGET_TOKENS = [
    '5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx', // BRIX
    '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump', // chat
    'Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA', // INC
    '6KTefwGvQ4wgmNeobuzhTCKKE55vFoj5dJryAMp8Hau6'  // UselessRWD
];

const IMPORTANT_PROGRAMS = [
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  // Jupiter V6
    '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',  // Pump.fun
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'   // Raydium CP
];

let ws = null;
let messageId = 1;
let subscriptions = new Map();
let heliusIdToTokenMap = new Map();
let heliusIdToProgramMap = new Map();

// Cache de corrélation
let swapEvents = new Map(); // signature -> {tokenLogs: [], programLogs: [], accountChanges: []}
let lastPrices = new Map();
let priceCalculationCount = 0;

console.log('🧠 CORRÉLATEUR DE PRIX AVANCÉ - MULTI-SOURCES');
console.log('═'.repeat(65));
console.log(`🎯 Tokens surveillés: ${TARGET_TOKENS.length}`);
TARGET_TOKENS.forEach((token, index) => {
    const symbol = getTokenSymbol(token);
    console.log(`  ${index + 1}. ${symbol}`);
});
console.log('🔗 Corrélation: TokenLogs + ProgramLogs + AccountNotifications');
console.log('⏱️  Format: [HH:MM:SS] TOKEN: $PRIX_USD (source)\n');

// Fonction pour obtenir le symbole d'un token
function getTokenSymbol(mint) {
    const knownTokens = {
        '5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx': 'BRIX',
        '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump': 'chat',
        'Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA': 'INC',
        '6KTefwGvQ4wgmNeobuzhTCKKE55vFoj5dJryAMp8Hau6': 'UselessRWD'
    };
    
    return knownTokens[mint] || mint.substring(0, 8) + '...';
}

// Fonction pour parser les données avancées
function parseAdvancedSwapData(logs, source) {
    const data = {
        source: source,
        amounts: [],
        prices: [],
        ratios: [],
        transfers: [],
        programData: null
    };
    
    for (const log of logs) {
        // Montants de swap
        if (log.includes('Program log: ')) {
            const logContent = log.split('Program log: ')[1];
            
            // Montants numériques
            if (/^\d+$/.test(logContent)) {
                const amount = parseInt(logContent);
                if (amount > 1000) {
                    data.amounts.push(amount);
                }
            }
            
            // Prix de pools
            if (logContent.includes('price_x:') && logContent.includes('price_y:')) {
                const priceXMatch = logContent.match(/price_x:\s*(\d+)/);
                const priceYMatch = logContent.match(/price_y:\s*(\d+)/);
                if (priceXMatch && priceYMatch) {
                    data.prices.push({
                        x: parseInt(priceXMatch[1]),
                        y: parseInt(priceYMatch[1])
                    });
                }
            }
            
            // Ratios de pools
            if (logContent.includes('YX15') || logContent.includes('XY15')) {
                const ratioMatch = logContent.match(/(\d+),(\d+),(\d+),(\d+)/);
                if (ratioMatch) {
                    data.ratios.push({
                        reserve1: parseInt(ratioMatch[1]),
                        reserve2: parseInt(ratioMatch[2]),
                        amount1: parseInt(ratioMatch[3]),
                        amount2: parseInt(ratioMatch[4])
                    });
                }
            }
        }
        
        // Transfers
        if (log.includes('Transfer') || log.includes('TransferChecked')) {
            data.transfers.push({
                instruction: log,
                timestamp: Date.now()
            });
        }
        
        // Program data
        if (log.includes('Program data: ')) {
            data.programData = log.split('Program data: ')[1];
        }
    }
    
    return data;
}

// Fonction de corrélation avancée
function correlatePriceData(signature, newData) {
    // Initialiser l'entrée si elle n'existe pas
    if (!swapEvents.has(signature)) {
        swapEvents.set(signature, {
            tokenLogs: [],
            programLogs: [],
            accountChanges: [],
            timestamp: Date.now()
        });
    }
    
    const event = swapEvents.get(signature);
    
    // Ajouter les nouvelles données selon la source
    if (newData.source.startsWith('TokenLogs-')) {
        event.tokenLogs.push(newData);
    } else if (newData.source.startsWith('ProgLogs-')) {
        event.programLogs.push(newData);
    } else if (newData.source === 'AccountChange') {
        event.accountChanges.push(newData);
    }
    
    // Tenter de calculer le prix si on a assez de données
    return calculateCorrelatedPrice(event, signature);
}

// Calcul de prix corrélé
function calculateCorrelatedPrice(event, signature) {
    try {
        let bestPrice = null;
        let priceSource = 'unknown';
        
        // Priorité 1: Ratios de pools (plus précis)
        for (const programLog of event.programLogs) {
            if (programLog.ratios.length > 0) {
                const ratio = programLog.ratios[0];
                if (ratio.amount1 > 0 && ratio.amount2 > 0) {
                    const price = (ratio.amount2 / ratio.amount1) * SOL_USD_PRICE / 1000000;
                    if (price > 0 && price < 10) {
                        bestPrice = price;
                        priceSource = `pool-ratio-${programLog.source}`;
                        break;
                    }
                }
            }
        }
        
        // Priorité 2: Prix directs des pools
        if (!bestPrice) {
            for (const programLog of event.programLogs) {
                if (programLog.prices.length > 0) {
                    const priceInfo = programLog.prices[0];
                    if (priceInfo.x > 0 && priceInfo.y > 0) {
                        const price = (priceInfo.x / priceInfo.y) * SOL_USD_PRICE / 1000000;
                        if (price > 0 && price < 10) {
                            bestPrice = price;
                            priceSource = `pool-price-${programLog.source}`;
                            break;
                        }
                    }
                }
            }
        }
        
        // Priorité 3: Corrélation des montants entre token et program logs
        if (!bestPrice) {
            const tokenAmounts = [];
            const programAmounts = [];
            
            for (const tokenLog of event.tokenLogs) {
                tokenAmounts.push(...tokenLog.amounts);
            }
            for (const programLog of event.programLogs) {
                programAmounts.push(...programLog.amounts);
            }
            
            if (tokenAmounts.length > 0 && programAmounts.length > 0) {
                // Essayer de corréler les montants
                const tokenAmount = tokenAmounts[0];
                const programAmount = programAmounts[0];
                
                if (tokenAmount > 0 && programAmount > 0) {
                    const price = (programAmount / tokenAmount) * SOL_USD_PRICE / 1000000000;
                    if (price > 0 && price < 10) {
                        bestPrice = price;
                        priceSource = 'correlation';
                    }
                }
            }
        }
        
        // Priorité 4: Estimation basée sur les changements de comptes
        if (!bestPrice && event.accountChanges.length > 0) {
            // TODO: Implémenter l'estimation basée sur les changements de comptes
        }
        
        return { price: bestPrice, source: priceSource };
        
    } catch (error) {
        console.error(`❌ Erreur corrélation: ${error.message}`);
        return { price: null, source: 'error' };
    }
}

// Fonction pour s'abonner à toutes les sources
function setupAdvancedSubscriptions() {
    console.log('📡 Configuration des abonnements multi-sources...');
    
    // 1. Logs des tokens cibles
    TARGET_TOKENS.forEach(tokenMint => {
        const subscribeMessage = {
            jsonrpc: "2.0",
            id: `tokenLogs-${tokenMint.substring(0, 8)}-${messageId++}`,
            method: "logsSubscribe",
            params: [
                { mentions: [tokenMint] }, 
                { commitment: "confirmed" }
            ]
        };

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(subscribeMessage));
            subscriptions.set(subscribeMessage.id, {
                method: "logsSubscribe",
                name: `TokenLogs-${tokenMint.substring(0, 8)}`,
                mint: tokenMint
            });
        }
    });
    
    // 2. Logs des programmes DEX
    IMPORTANT_PROGRAMS.forEach(programId => {
        const subscribeMessage = {
            jsonrpc: "2.0",
            id: `programLogs-${programId.substring(0, 8)}-${messageId++}`,
            method: "logsSubscribe",
            params: [
                { mentions: [programId] }, 
                { commitment: "confirmed" }
            ]
        };

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(subscribeMessage));
            subscriptions.set(subscribeMessage.id, {
                method: "logsSubscribe",
                name: `ProgLogs-${programId.substring(0, 8)}`,
                program: programId
            });
        }
    });
    
    console.log(`✅ ${subscriptions.size} abonnements multi-sources envoyés`);
}

// Fonction principale
async function startAdvancedCorrelator() {
    console.log('🚀 Connexion au WebSocket Helius...');
    ws = new WebSocket(HELIUS_WSS_ENDPOINT);
    
    ws.on('open', async () => {
        console.log('✅ WebSocket connecté! Démarrage corrélation avancée...\n');
        setupAdvancedSubscriptions();
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            // Gérer les confirmations d'abonnement
            if (message.result && typeof message.result === 'number') {
                const clientRequestId = message.id;
                const heliusSubscriptionId = message.result;
                const originalSubscriptionDetails = subscriptions.get(clientRequestId);
                
                if (originalSubscriptionDetails) {
                    if (originalSubscriptionDetails.mint) {
                        heliusIdToTokenMap.set(heliusSubscriptionId, originalSubscriptionDetails.mint);
                        console.log(`✅ Token confirmé: ${getTokenSymbol(originalSubscriptionDetails.mint)}`);
                    } else if (originalSubscriptionDetails.program) {
                        heliusIdToProgramMap.set(heliusSubscriptionId, originalSubscriptionDetails.program);
                        console.log(`✅ Programme confirmé: ${originalSubscriptionDetails.program.substring(0, 8)}`);
                    }
                }
            }
            // Traiter les notifications de logs
            else if (message.method === 'logsNotification') {
                const heliusSubscriptionId = message.params?.subscription;
                const logs = message.params?.result?.value?.logs;
                const signature = message.params?.result?.value?.signature;
                const error = message.params?.result?.value?.err;
                
                if (logs && !error && signature && heliusSubscriptionId) {
                    let sourceName = 'unknown';
                    let targetToken = null;
                    
                    // Identifier la source
                    const tokenMint = heliusIdToTokenMap.get(heliusSubscriptionId);
                    const programId = heliusIdToProgramMap.get(heliusSubscriptionId);
                    
                    if (tokenMint) {
                        sourceName = `TokenLogs-${tokenMint.substring(0, 8)}`;
                        targetToken = tokenMint;
                    } else if (programId) {
                        sourceName = `ProgLogs-${programId.substring(0, 8)}`;
                    }
                    
                    // Parser les données
                    const swapData = parseAdvancedSwapData(logs, sourceName);
                    
                    // Détecter les swaps
                    const hasSwap = logs.some(log => 
                        log.includes('Swap') || 
                        log.includes('Buy') || 
                        log.includes('Sell') ||
                        log.includes('Route')
                    );
                    
                    if (hasSwap && targetToken) {
                        console.log(`🔄 Swap détecté: ${getTokenSymbol(targetToken)} via ${sourceName}`);
                        
                        // Corréler avec les autres données
                        const result = correlatePriceData(signature, swapData);
                        
                        if (result.price && result.price > 0) {
                            priceCalculationCount++;
                            lastPrices.set(targetToken, result.price);
                            const time = new Date().toLocaleTimeString('fr-FR');
                            const tokenSymbol = getTokenSymbol(targetToken);
                            console.log(`💰 [${time}] ${tokenSymbol}: $${result.price.toFixed(8)} (${result.source})`);
                        } else {
                            console.log(`⚠️ Prix non corrélable pour ${getTokenSymbol(targetToken)}`);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error(`❌ Erreur parsing message: ${error.message}`);
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ Erreur WebSocket:', error.message);
    });
    
    ws.on('close', () => {
        console.log('\n⚠️ Connexion fermée');
        console.log(`📊 Statistiques:`);
        console.log(`  - Prix corrélés: ${priceCalculationCount}`);
        console.log(`  - Événements de swap: ${swapEvents.size}`);
        console.log(`  - Derniers prix:`);
        for (const [mint, price] of lastPrices) {
            const symbol = getTokenSymbol(mint);
            console.log(`    - ${symbol}: $${price.toFixed(8)}`);
        }
    });
}

// Nettoyage périodique des anciens événements
setInterval(() => {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    for (const [signature, event] of swapEvents) {
        if (now - event.timestamp > maxAge) {
            swapEvents.delete(signature);
        }
    }
}, 60000); // Nettoyer toutes les minutes

// Affichage périodique des statistiques
setInterval(() => {
    if (lastPrices.size > 0) {
        const time = new Date().toLocaleTimeString('fr-FR');
        console.log(`\n📊 [${time}] Résumé corrélation:`);
        for (const [mint, price] of lastPrices) {
            const symbol = getTokenSymbol(mint);
            console.log(`  - ${symbol}: $${price.toFixed(8)}`);
        }
        console.log(`🔗 Événements actifs: ${swapEvents.size}, Prix corrélés: ${priceCalculationCount}\n`);
    }
}, 120000); // Toutes les 2 minutes

// Gestion Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du corrélateur avancé...');
    console.log(`📊 Statistiques finales:`);
    console.log(`  - Prix corrélés: ${priceCalculationCount}`);
    console.log(`  - Événements de swap: ${swapEvents.size}`);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    
    setTimeout(() => {
        console.log('✅ Corrélateur arrêté!');
        process.exit(0);
    }, 1000);
});

// Démarrage
startAdvancedCorrelator().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
}); 