#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 💰 CALCULATEUR DE PRIX TEMPS RÉEL - PARSER WEBSOCKET
 * 
 * Parse directement les logs WebSocket pour calculer les prix USD
 * SANS requêtes HTTP - tout en temps réel !
 */

const HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
const HELIUS_WSS_ENDPOINT = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Prix de référence
const SOL_USD_PRICE = 170.0;
const STABLECOIN_USD_PRICE = 1.0;

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
let priceCalculationCount = 0;
let lastPrices = new Map();

// Cache pour corréler les données
let pendingSwaps = new Map(); // signature -> swap data
let accountChanges = new Map(); // token -> latest balance change

console.log('💰 CALCULATEUR DE PRIX TEMPS RÉEL - VERSION PARSER');
console.log('═'.repeat(60));
console.log(`🎯 Tokens surveillés: ${TARGET_TOKENS.length}`);
TARGET_TOKENS.forEach((token, index) => {
    const symbol = getTokenSymbol(token);
    console.log(`  ${index + 1}. ${symbol}`);
});
console.log('🔥 Calcul direct depuis les logs WebSocket !');
console.log('⏱️  Format: [HH:MM:SS] TOKEN: $PRIX_USD\n');

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

// Fonction pour parser les montants des swaps depuis les logs
function parseSwapAmounts(logs) {
    const swapData = {
        amounts: [],
        prices: [],
        ratios: [],
        programData: null
    };
    
    for (const log of logs) {
        // Rechercher les montants de swap (formats divers)
        if (log.includes('Program log: ') && /^\d+$/.test(log.split('Program log: ')[1])) {
            const amount = parseInt(log.split('Program log: ')[1]);
            if (amount > 1000) { // Filtrer les petits montants
                swapData.amounts.push(amount);
            }
        }
        
        // Rechercher les prix des pools
        if (log.includes('price_x:') && log.includes('price_y:')) {
            const priceXMatch = log.match(/price_x:\s*(\d+)/);
            const priceYMatch = log.match(/price_y:\s*(\d+)/);
            if (priceXMatch && priceYMatch) {
                swapData.prices.push({
                    x: parseInt(priceXMatch[1]),
                    y: parseInt(priceYMatch[1])
                });
            }
        }
        
        // Rechercher les ratios de pool (format YX15 ou similaire)
        if (log.includes('YX15') || log.includes('XY15')) {
            const ratioMatch = log.match(/(\d+),(\d+),(\d+),(\d+)/);
            if (ratioMatch) {
                swapData.ratios.push({
                    reserve1: parseInt(ratioMatch[1]),
                    reserve2: parseInt(ratioMatch[2]),
                    amount1: parseInt(ratioMatch[3]),
                    amount2: parseInt(ratioMatch[4])
                });
            }
        }
        
        // Rechercher les données de programme encodées
        if (log.includes('Program data: ')) {
            swapData.programData = log.split('Program data: ')[1];
        }
        
        // Rechercher les montants dans les instructions Transfer
        if (log.includes('Transfer') && log.includes('amount:')) {
            const amountMatch = log.match(/amount:\s*(\d+)/);
            if (amountMatch) {
                const amount = parseInt(amountMatch[1]);
                if (amount > 1000) {
                    swapData.amounts.push(amount);
                }
            }
        }
    }
    
    return swapData;
}

// Fonction pour calculer le prix USD depuis les données de swap
function calculateUSDPriceFromSwapData(swapData, targetMint) {
    try {
        // Méthode 1: Utiliser les ratios de pool si disponibles
        if (swapData.ratios.length > 0) {
            const ratio = swapData.ratios[0];
            if (ratio.amount1 > 0 && ratio.amount2 > 0) {
                // Calculer le prix basé sur le ratio
                const price = (ratio.amount2 / ratio.amount1) * SOL_USD_PRICE;
                if (price > 0 && price < 10) { // Filtrer les prix aberrants
                    return price;
                }
            }
        }
        
        // Méthode 2: Utiliser les prix de pool
        if (swapData.prices.length > 0) {
            const priceInfo = swapData.prices[0];
            if (priceInfo.x > 0 && priceInfo.y > 0) {
                const price = (priceInfo.x / priceInfo.y) * SOL_USD_PRICE / 1000000; // Ajuster selon les décimales
                if (price > 0 && price < 10) {
                    return price;
                }
            }
        }
        
        // Méthode 3: Utiliser les montants simples
        if (swapData.amounts.length >= 2) {
            const amount1 = swapData.amounts[0];
            const amount2 = swapData.amounts[1];
            const price = (amount2 / amount1) * SOL_USD_PRICE / 1000000000; // Ajuster les décimales
            if (price > 0 && price < 10) {
                return price;
            }
        }
        
        // Méthode 4: Estimer le prix avec un seul montant (moins précis)
        if (swapData.amounts.length === 1) {
            const amount = swapData.amounts[0];
            // Pour chat, essayons différentes estimations basées sur l'historique
            if (targetMint === '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump') {
                // Chat semble avoir des montants autour de 426 milliards
                // Essai d'estimation basée sur la taille du pool
                const estimatedPrice = (amount / 1000000000000) * SOL_USD_PRICE / 100000;
                if (estimatedPrice > 0 && estimatedPrice < 1) {
                    return estimatedPrice;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error(`❌ Erreur calcul prix: ${error.message}`);
        return null;
    }
}

// Fonction pour traiter les changements de compte
function processAccountChange(accountData, tokenMint) {
    if (accountData.mint === tokenMint) {
        const balance = accountData.tokenAmount.uiAmount;
        const previousBalance = accountChanges.get(tokenMint);
        
        if (previousBalance && Math.abs(balance - previousBalance.balance) > 1000) {
            console.log(`📊 Changement ${getTokenSymbol(tokenMint)}: ${previousBalance.balance.toFixed(2)} → ${balance.toFixed(2)}`);
        }
        
        accountChanges.set(tokenMint, {
            balance: balance,
            timestamp: Date.now()
        });
    }
}

// Fonction pour s'abonner aux logs et comptes
function setupSubscriptions() {
    console.log('📡 Configuration des abonnements optimisés...');
    
    // Abonnements aux logs des tokens cibles
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
    
    // Abonnements aux programmes DEX
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
    
    console.log(`✅ ${subscriptions.size} abonnements envoyés`);
}

// Fonction principale
async function startRealtimePriceParser() {
    console.log('🚀 Connexion au WebSocket Helius...');
    ws = new WebSocket(HELIUS_WSS_ENDPOINT);
    
    ws.on('open', async () => {
        console.log('✅ WebSocket connecté! Démarrage surveillance...\n');
        setupSubscriptions();
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            // Gérer les confirmations d'abonnement
            if (message.result && typeof message.result === 'number') {
                const clientRequestId = message.id;
                const heliusSubscriptionId = message.result;
                const originalSubscriptionDetails = subscriptions.get(clientRequestId);
                
                if (originalSubscriptionDetails && originalSubscriptionDetails.mint) {
                    heliusIdToTokenMap.set(heliusSubscriptionId, originalSubscriptionDetails.mint);
                    console.log(`✅ Abonnement confirmé: ${getTokenSymbol(originalSubscriptionDetails.mint)}`);
                }
            }
            // Traiter les notifications de logs
            else if (message.method === 'logsNotification') {
                const heliusSubscriptionId = message.params?.subscription;
                const logs = message.params?.result?.value?.logs;
                const signature = message.params?.result?.value?.signature;
                const error = message.params?.result?.value?.err;
                
                if (logs && !error && heliusSubscriptionId) {
                    const targetToken = heliusIdToTokenMap.get(heliusSubscriptionId);
                    
                    if (targetToken) {
                        // Détecter les swaps
                        const hasSwap = logs.some(log => 
                            log.includes('Swap') || 
                            log.includes('Buy') || 
                            log.includes('Sell') ||
                            log.includes('Route')
                        );
                        
                        if (hasSwap) {
                            console.log(`🔄 Swap détecté pour ${getTokenSymbol(targetToken)}`);
                            
                            // Parser les données de swap
                            const swapData = parseSwapAmounts(logs);
                            const priceUSD = calculateUSDPriceFromSwapData(swapData, targetToken);
                            
                            if (priceUSD && priceUSD > 0) {
                                priceCalculationCount++;
                                lastPrices.set(targetToken, priceUSD);
                                const time = new Date().toLocaleTimeString('fr-FR');
                                const tokenSymbol = getTokenSymbol(targetToken);
                                console.log(`💰 [${time}] ${tokenSymbol}: $${priceUSD.toFixed(8)}`);
                            } else {
                                console.log(`⚠️ Prix non calculable pour ${getTokenSymbol(targetToken)}`);
                                // Afficher les données pour debug
                                if (swapData.amounts.length > 0) {
                                    console.log(`📊 Montants: ${swapData.amounts.join(', ')}`);
                                }
                                if (swapData.prices.length > 0) {
                                    console.log(`📊 Prix: ${JSON.stringify(swapData.prices)}`);
                                }
                            }
                        }
                    }
                }
            }
            // Traiter les notifications de comptes
            else if (message.method === 'accountNotification') {
                const accountData = message.params?.result?.value?.data?.parsed?.info;
                if (accountData && accountData.mint && TARGET_TOKENS.includes(accountData.mint)) {
                    processAccountChange(accountData, accountData.mint);
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
        console.log(`  - Prix calculés: ${priceCalculationCount}`);
        console.log(`  - Derniers prix:`);
        for (const [mint, price] of lastPrices) {
            const symbol = getTokenSymbol(mint);
            console.log(`    - ${symbol}: $${price.toFixed(8)}`);
        }
    });
}

// Affichage périodique des statistiques
setInterval(() => {
    if (lastPrices.size > 0) {
        const time = new Date().toLocaleTimeString('fr-FR');
        console.log(`\n📊 [${time}] Résumé des prix:`);
        for (const [mint, price] of lastPrices) {
            const symbol = getTokenSymbol(mint);
            console.log(`  - ${symbol}: $${price.toFixed(8)}`);
        }
        console.log(`🔥 Total prix calculés: ${priceCalculationCount}\n`);
    }
}, 60000); // Toutes les minutes

// Gestion Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du calculateur de prix...');
    console.log(`📊 Statistiques finales:`);
    console.log(`  - Prix calculés: ${priceCalculationCount}`);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    
    setTimeout(() => {
        console.log('✅ Calculateur arrêté!');
        process.exit(0);
    }, 1000);
});

// Démarrage
startRealtimePriceParser().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
}); 