#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🔍 ANALYSEUR DE DONNÉES BRUTES - HELIUS WEBSOCKET
 * 
 * Affiche TOUTES les données brutes reçues lors des swaps
 * Pour comprendre exactement ce qu'on reçoit du WebSocket
 */

const HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
const HELIUS_WSS_ENDPOINT = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_HTTP_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Constantes pour le calcul de prix USD
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const SOL_USD_PRICE = 170.0;
const STABLECOIN_USD_PRICE = 1.0;

// Tokens de test
const TARGET_TOKENS = [
    '5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx', // BRIX
    '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump', // chat
    'Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA', // INC
    '6KTefwGvQ4wgmNeobuzhTCKKE55vFoj5dJryAMp8Hau6'  // UselessRWD
];

const processedTransactions = new Set();
let ws = null;
let messageId = 1;
let subscriptions = new Map();
let heliusIdToTokenMap = new Map();
let priceUpdateCount = 0;
let lastPrices = new Map(); // Pour stocker les derniers prix connus
let swapDetectionCount = 0;
let subscriptionConfirmations = 0;

console.log('🔍 ANALYSEUR DE DONNÉES BRUTES - SWAPS WEBSOCKET');
console.log('═'.repeat(60));
console.log(`🎯 Tokens surveillés: ${TARGET_TOKENS.length}`);
TARGET_TOKENS.forEach((token, index) => {
    const symbol = getTokenSymbol(token);
    console.log(`  ${index + 1}. ${symbol}`);
});
console.log('📊 Objectif: Afficher TOUTES les données brutes des swaps');
console.log('🔄 Connexion WebSocket en cours...\n');

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

// Fonctions de prix supprimées - on analyse juste les données brutes

// Fonctions de calcul de prix supprimées - on affiche juste les données brutes

// Fonction pour s'abonner aux logs des tokens cibles uniquement
function setupTokenLogsSubscriptions() {
    console.log('📡 Configuration des abonnements WebSocket...');
    
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
            console.log(`📡 Abonnement envoyé pour ${getTokenSymbol(tokenMint)}`);
        }
    });
}

// Fonction principale
async function startRawDataAnalysis() {
    console.log('🚀 Connexion au WebSocket Helius...');
    ws = new WebSocket(HELIUS_WSS_ENDPOINT);
    
    ws.on('open', async () => {
        console.log('✅ WebSocket connecté! Démarrage surveillance...\n');
        setupTokenLogsSubscriptions();
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
                    subscriptionConfirmations++;
                    console.log(`✅ Abonnement confirmé: ${getTokenSymbol(originalSubscriptionDetails.mint)} (ID: ${heliusSubscriptionId})`);
                    
                    if (subscriptionConfirmations === TARGET_TOKENS.length) {
                        console.log('🎯 Tous les abonnements confirmés! En attente de swaps...\n');
                    }
                }
            }
            // Traiter les notifications de logs
            else if (message.method === 'logsNotification') {
                const heliusSubscriptionId = message.params?.subscription;
                const logs = message.params?.result?.value?.logs;
                const signature = message.params?.result?.value?.signature;
                const error = message.params?.result?.value?.err;
                
                if (logs && heliusSubscriptionId && !error) {
                    const targetToken = heliusIdToTokenMap.get(heliusSubscriptionId);
                    
                    if (targetToken) {
                        const hasSwap = logs.some(log => 
                            log.includes('swap') || 
                            log.includes('Swap') || 
                            log.includes('Route') ||
                            log.includes('Sell') ||
                            log.includes('Buy') ||
                            log.includes('AMM') ||
                            log.includes('Trade')
                        );
                        
                        if (hasSwap) {
                            swapDetectionCount++;
                            const time = new Date().toLocaleTimeString('fr-FR');
                            console.log(`\n🔄 [${time}] SWAP #${swapDetectionCount} détecté pour ${getTokenSymbol(targetToken)}`);
                            console.log(`📄 Signature: ${signature}`);
                            console.log(`🔍 DONNÉES BRUTES COMPLÈTES:`);
                            console.log('═'.repeat(80));
                            
                            // Afficher toutes les données du message
                            console.log(`📊 Message complet:`);
                            console.log(JSON.stringify(message, null, 2));
                            
                            console.log(`\n📝 Logs détaillés (${logs.length} lignes):`);
                            logs.forEach((log, index) => {
                                const num = (index + 1).toString().padStart(2, ' ');
                                console.log(`${num}. ${log}`);
                            });
                            
                            console.log('═'.repeat(80));
                            console.log(`✅ Fin des données brutes pour SWAP #${swapDetectionCount}\n`);
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
        console.log(`  - Abonnements confirmés: ${subscriptionConfirmations}`);
        console.log(`  - Swaps détectés: ${swapDetectionCount}`);
        console.log(`  - Prix mis à jour: ${priceUpdateCount}`);
    });
}

// Affichage périodique des statistiques et derniers prix
setInterval(() => {
    const time = new Date().toLocaleTimeString('fr-FR');
    console.log(`\n📊 [${time}] Statistiques:`);
    console.log(`  - Abonnements: ${subscriptionConfirmations}/${TARGET_TOKENS.length}`);
    console.log(`  - Swaps détectés: ${swapDetectionCount}`);
    console.log(`  - Prix mis à jour: ${priceUpdateCount}`);
    
    if (lastPrices.size > 0) {
        console.log(`🏷️ Derniers prix connus:`);
        for (const [mint, price] of lastPrices) {
            const symbol = getTokenSymbol(mint);
            console.log(`  - ${symbol}: $${price.toFixed(8)}`);
        }
    }
    console.log('');
}, 60000); // Toutes les minutes

// Gestion Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du moniteur de prix...');
    console.log(`📊 Statistiques finales:`);
    console.log(`  - Abonnements confirmés: ${subscriptionConfirmations}`);
    console.log(`  - Swaps détectés: ${swapDetectionCount}`);
    console.log(`  - Prix mis à jour: ${priceUpdateCount}`);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    
    setTimeout(() => {
        console.log('✅ Moniteur arrêté!');
        process.exit(0);
    }, 1000);
});

// Démarrage
startRawDataAnalysis().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
}); 