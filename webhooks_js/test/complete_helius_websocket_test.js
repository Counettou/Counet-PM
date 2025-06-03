#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🔬 TEST COMPLET EXPLORATION WEBSOCKET HELIUS - TOUS TYPES ACTIFS
 * 
 * Ce script active TOUS les types d'abonnements WebSocket Helius standards
 * disponibles dans ce fichier pour une exploration maximale des données.
 * 
 * 🎯 OBJECTIF :
 * - Se concentrer UNIQUEMENT sur le token "chat" (5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump).
 * - Collecter les données brutes de TOUS les abonnements WebSocket possibles.
 * - Analyser si les données reçues (d'un ou plusieurs WebSockets) sont suffisantes 
 *   pour calculer le prix du token "chat" en temps réel SANS AUCUNE REQUÊTE HTTP.
 * 
 * 🔥 CONFIGURATION ACTUELLE :
 * - ZÉRO requête HTTP : Toutes les fonctions utilisant fetch() ont été supprimées ou commentées.
 * - Token Cible UNIQUE : "chat" (5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump).
 * - TOUS les abonnements WebSocket suivants sont ACTIFS :
 *   - programSubscribe (sur les DEX importants, sans SPL Token)
 *   - logsSubscribe (sur les DEX importants et sur le token "chat")
 *   - slotSubscribe
 *   - slotsUpdatesSubscribe
 *   - blockSubscribe (ATTENTION: volume de données très élevé !)
 *   - rootSubscribe
 *   - voteSubscribe
 * - accountSubscribe est DÉSACTIVÉ (nécessiterait un appel HTTP pour trouver les comptes ou une liste manuelle).
 * 
 * 📊 ANALYSE ATTENDUE :
 * - Examiner les logs produits, en particulier lors des swaps détectés pour "chat".
 * - Identifier si des messages WebSocket contiennent les montants échangés et les mints des tokens 
 *   (similaire à ce que fourniraient preTokenBalances/postTokenBalances d'une requête getTransaction).
 * - Le script affichera des informations détaillées pour les messages pertinents.
 */

const HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
const HELIUS_WSS_ENDPOINT = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_HTTP_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Constantes pour le calcul de prix USD
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const SOL_USD_PRICE = 170.0; // Prix approximatif SOL/USD
const STABLECOIN_USD_PRICE = 1.0; // Prix des stablecoins

// Cache pour éviter de traiter la même transaction plusieurs fois
const processedTransactions = new Set();

// Tokens de test
const TARGET_TOKENS = [
    '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump' // chat
];

// Programmes importants pour les swaps (SPL Token retiré car trop de volume inutile)
const IMPORTANT_PROGRAMS = [
    // 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token - COMMENTÉ: génère trop de volume inutile
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  // Jupiter V6
    '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',  // Pump.fun
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'   // Raydium CP
];

let messageCount = 0;
let ws = null;
let messageId = 1;
let subscriptions = new Map(); // Pour tracker les abonnements
let heliusIdToNameMap = new Map(); // Pour mapper l'ID d'abonnement Helius au nom de l'abonnement

console.log('🔬 TEST COMPLET WEBSOCKET HELIUS - TOUS LES TYPES');
console.log('='.repeat(60));
console.log(`🎯 Tokens testés: ${TARGET_TOKENS.length}`);
TARGET_TOKENS.forEach(token => console.log(`  - ${token}`));
console.log(`🔌 Endpoint: ${HELIUS_WSS_ENDPOINT}`);
console.log('📊 Objectif: Tester TOUS les types de WebSocket Helius standard\n');

// Fonction générique pour envoyer un abonnement
function sendSubscription(method, params, subscriptionName) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.log(`❌ WebSocket non ouvert. Impossible d'envoyer ${subscriptionName}`);
        return;
    }
    
    const subscribeMessage = {
        jsonrpc: "2.0",
        id: `${method}-${subscriptionName}-${messageId++}`,
        method: method,
        params: params
    };
    
    console.log(`📡 Envoi: ${subscriptionName}...`);
    console.log(`📄 Params:`, JSON.stringify(params, null, 1));
    ws.send(JSON.stringify(subscribeMessage));
    
    subscriptions.set(subscribeMessage.id, {
        method: method,
        name: subscriptionName,
        params: params
    });
}

// 1️⃣ ACCOUNT SUBSCRIBE - Surveiller les comptes de tokens
async function setupAccountSubscriptions() {
    console.log('\n🔹 === ACCOUNT SUBSCRIPTIONS ===');
    
    for (const tokenMint of TARGET_TOKENS) {
        const accounts = await findTokenAccounts(tokenMint);
        for (const account of accounts) {
            sendSubscription(
                "accountSubscribe",
                [account.pubkey, { encoding: "jsonParsed", commitment: "confirmed" }],
                `Account-${tokenMint.substring(0,8)}-${account.pubkey.substring(0,8)}`
            );
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// 2️⃣ PROGRAM SUBSCRIBE - Surveiller les programmes de swap
function setupProgramSubscriptions() {
    console.log('\n🔹 === PROGRAM SUBSCRIPTIONS ===');
    
    IMPORTANT_PROGRAMS.forEach(programId => {
        sendSubscription(
            "programSubscribe",
            [programId, { encoding: "jsonParsed", commitment: "confirmed" }],
            `Program-${programId.substring(0,8)}`
        );
    });
}

// 3️⃣ LOGS SUBSCRIBE - Surveiller les logs de swaps 
function setupLogsSubscriptions() {
    console.log('\n🔹 === LOGS SUBSCRIPTIONS ===');
    
    // Logs pour les programmes de swap
    IMPORTANT_PROGRAMS.forEach(programId => {
        sendSubscription(
            "logsSubscribe",
            [{ mentions: [programId] }, { commitment: "confirmed" }],
            `Logs-${programId.substring(0,8)}`
        );
    });
    
    // Logs pour nos tokens spécifiques
    TARGET_TOKENS.forEach(tokenMint => {
        sendSubscription(
            "logsSubscribe",
            [{ mentions: [tokenMint] }, { commitment: "confirmed" }],
            `TokenLogs-${tokenMint.substring(0,8)}`
        );
    });
}

// 4️⃣ SLOT SUBSCRIBE - Surveiller les slots
function setupSlotSubscriptions() {
    console.log('\n🔹 === SLOT SUBSCRIPTIONS ===');
    
    sendSubscription(
        "slotSubscribe",
        [],
        "SlotUpdates"
    );
}

// 5️⃣ SLOTS UPDATES SUBSCRIBE - Mises à jour détaillées des slots
function setupSlotsUpdatesSubscriptions() {
    console.log('\n🔹 === SLOTS UPDATES SUBSCRIPTIONS ===');
    
    sendSubscription(
        "slotsUpdatesSubscribe",
        [],
        "SlotsUpdatesDetailed"
    );
}

// 6️⃣ BLOCK SUBSCRIBE - Surveiller les blocs (attention: beaucoup de données!)
function setupBlockSubscriptions() {
    console.log('\n🔹 === BLOCK SUBSCRIPTIONS ===');
    
    sendSubscription(
        "blockSubscribe",
        ["all", { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
        "BlockUpdates"
    );
}

// 7️⃣ ROOT SUBSCRIBE - Surveiller les racines
function setupRootSubscriptions() {
    console.log('\n🔹 === ROOT SUBSCRIPTIONS ===');
    
    sendSubscription(
        "rootSubscribe",
        [],
        "RootUpdates"
    );
}

// 8️⃣ VOTE SUBSCRIBE - Surveiller les votes
function setupVoteSubscriptions() {
    console.log('\n🔹 === VOTE SUBSCRIPTIONS ===');
    
    sendSubscription(
        "voteSubscribe",
        [],
        "VoteUpdates"
    );
}

// Fonction pour obtenir le symbole d'un token (simplifié)
function getTokenSymbol(mint) {
    const knownTokens = {
        '5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx': 'BRIX',
        '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump': 'chat',
        'Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA': 'INC',
        '6KTefwGvQ4wgmNeobuzhTCKKE55vFoj5dJryAMp8Hau6': 'UselessRWD'
    };
    
    return knownTokens[mint] || mint.substring(0, 8) + '...';
}

// Fonction pour analyser les messages reçus
function analyzeMessage(message) {
    let analysis = "";
    
    if (message.result && typeof message.result === 'number') { // C'est une confirmation d'abonnement
        const clientRequestId = message.id;
        const heliusSubscriptionId = message.result;
        const originalSubscriptionDetails = subscriptions.get(clientRequestId);
        
        if (originalSubscriptionDetails) {
            analysis = `✅ CONFIRMATION: ${originalSubscriptionDetails.name} (Sub ID: ${heliusSubscriptionId})`;
            heliusIdToNameMap.set(heliusSubscriptionId, originalSubscriptionDetails.name); // Stocker la correspondance
        } else {
            // Ce cas devrait être rare si toutes les demandes d'abonnement sont suivies
            analysis = `✅ CONFIRMATION (requête ID inconnue ${clientRequestId}): Sub ID ${heliusSubscriptionId}`;
        }
        
    } else if (message.method) { // C'est une notification d'un abonnement existant
        const heliusSubscriptionId = message.params?.subscription;
        let sourcePrefix = "";
        if (heliusSubscriptionId) {
            const subscriptionName = heliusIdToNameMap.get(heliusSubscriptionId);
            if (subscriptionName) {
                sourcePrefix = `[${subscriptionName}] `;
            } else {
                // Si le nom n'est pas trouvé (ne devrait pas arriver si la confirmation a été traitée), afficher au moins l'ID
                sourcePrefix = `[SubID: ${heliusSubscriptionId}] `;
            }
        }

        switch(message.method) {
            case 'accountNotification':
                analysis = `${sourcePrefix}📊 ACCOUNT: Slot ${message.params?.result?.context?.slot}`;
                if (message.params?.result?.value?.data?.parsed?.info?.mint) {
                    const mint = message.params.result.value.data.parsed.info.mint;
                    // Utilise le nom du token s'il est dans TARGET_TOKENS, sinon l'adresse mint (raccourcie)
                    let tokenDisplayName = mint.substring(0,8);
                    const targetTokenEntry = TARGET_TOKENS.find(t => t === mint);
                    if (targetTokenEntry) {
                        // Utilise le nom du token s'il est dans TARGET_TOKENS, sinon l'adresse mint (raccourcie)
                        const knownToken = TARGET_TOKENS.includes(mint);
                        if(knownToken) tokenDisplayName = `${mint.substring(0,4)}..${mint.substring(mint.length-4)}`;

                    }
                    analysis += ` | Token: ${tokenDisplayName}`;
                    if (message.params.result.value.data.parsed.info.tokenAmount) {
                        analysis += ` | Amount: ${message.params.result.value.data.parsed.info.tokenAmount.uiAmount}`;
                    }
                }
                break;
                
            case 'programNotification':
                analysis = `${sourcePrefix}🔧 PROGRAM: Slot ${message.params?.result?.context?.slot}`;
                break;
                
            case 'logsNotification':
                analysis = `${sourcePrefix}📝 LOGS: Slot ${message.params?.result?.context?.slot}`;
                if (message.params?.result?.value?.logs) {
                    const logs = message.params.result.value.logs;
                    const swapLog = logs.find(log => log.includes('swap') || log.includes('Swap'));
                    if (swapLog) {
                        analysis += ` | 🔄 SWAP DETECTED!`;
                        
                        // Détecter si c'est un swap impliquant nos tokens cibles
                        const signature = message.params.result.value.signature;
                        if (signature && sourcePrefix.includes('TokenLogs-')) {
                            // Extraire le mint du token depuis le nom de l'abonnement
                            const subscriptionName = heliusIdToNameMap.get(heliusSubscriptionId);
                            if (subscriptionName && subscriptionName.startsWith('TokenLogs-')) {
                                // Trouver le token cible correspondant
                                const targetToken = TARGET_TOKENS.find(token => 
                                    subscriptionName.includes(token.substring(0, 8))
                                );
                                
                                if (targetToken) {
                                    // L'appel à fetchTransactionDetailsAndCalcUSDPrice (HTTP) est SUPPRIMÉ
                                    console.log(`[INFO] Swap détecté pour ${getTokenSymbol(targetToken)} via logs. Signature: ${signature}`);
                                }
                            }
                        }
                    }
                }
                break;
                
            case 'slotNotification':
                analysis = `${sourcePrefix}⏱️ SLOT: ${message.params?.result?.slot} | Parent: ${message.params?.result?.parent}`;
                break;
                
            case 'slotsUpdatesNotification':
                analysis = `${sourcePrefix}⏰ SLOT UPDATE: ${message.params?.result?.slot} | Type: ${message.params?.result?.type}`;
                break;
                
            case 'blockNotification':
                analysis = `${sourcePrefix}🧱 BLOCK: Slot ${message.params?.result?.context?.slot} | Txs: ${message.params?.result?.value?.block?.transactions?.length || 0}`;
                break;
                
            case 'rootNotification':
                analysis = `${sourcePrefix}🌳 ROOT: ${message.params?.result}`;
                break;
                
            case 'voteNotification':
                analysis = `${sourcePrefix}🗳️ VOTE: Slot ${message.params?.result?.votePubkey}`;
                break;
                
            default:
                analysis = `${sourcePrefix}❓ OTHER: ${message.method}`;
        }
        
    } else if (message.error) {
        analysis = `❌ ERROR: ${message.error.message} (Code: ${message.error.code})`;
    } else {
        analysis = `❓ UNKNOWN MESSAGE TYPE`;
    }
    
    return analysis;
}

// Fonction principale
async function startCompleteMonitoring() {
    console.log('🚀 DÉMARRAGE DU TEST COMPLET WEBSOCKET HELIUS...\n');
    
    console.log('🔌 Connexion au WebSocket Helius...');
    ws = new WebSocket(HELIUS_WSS_ENDPOINT);
    
    ws.on('open', async () => {
        console.log('✅ WebSocket connecté!\n');
        
        try {
            // Setup tous les types d'abonnements
            // await setupAccountSubscriptions(); // COMMENTÉ car findTokenAccounts (HTTP) a été supprimé
            // await new Promise(resolve => setTimeout(resolve, 500));
            
            setupProgramSubscriptions();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setupLogsSubscriptions();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setupSlotSubscriptions(); 
            await new Promise(resolve => setTimeout(resolve, 200));
            
            setupSlotsUpdatesSubscriptions(); 
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // ATTENTION: Block subscribe génère BEAUCOUP de données - décommenter avec précaution
            setupBlockSubscriptions();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            setupRootSubscriptions(); 
            await new Promise(resolve => setTimeout(resolve, 200));
            
            setupVoteSubscriptions(); 
            
            console.log('\n⏰ Tous les abonnements envoyés! Attente des messages...');
            console.log(`📊 Total abonnements: ${subscriptions.size}`);
            console.log('💡 Appuyez sur Ctrl+C pour arrêter\n');
            
        } catch (error) {
            console.error('❌ Erreur lors du setup des abonnements:', error.message);
        }
    });
    
    ws.on('message', (data) => {
        messageCount++;
        
        try {
            const message = JSON.parse(data.toString());
            const analysis = analyzeMessage(message);
            
            // Affichage compact pour ne pas être submergé
            console.log(`\n🔥 MSG #${messageCount} [${new Date().toISOString().substr(11,12)}] | ${data.length}b`);
            console.log(`📊 ${analysis}`);
            
            // Affichage détaillé pour les messages importants
            if (analysis.includes('SWAP DETECTED') || 
                analysis.includes('ACCOUNT') && analysis.includes('Token:') ||
                analysis.includes('ERROR')) {
                console.log('─'.repeat(50));
                console.log(JSON.stringify(message, null, 2));
                console.log('─'.repeat(50));
            }
            
        } catch (error) {
            console.log(`❌ Erreur parsing MSG #${messageCount}:`, error.message);
            console.log('Raw data:', data.toString().substring(0, 200) + '...');
        }
    });
    
    ws.on('error', (error) => {
        console.error('\n❌ Erreur WebSocket:', error.message);
    });
    
    ws.on('close', () => {
        console.log('\n⚠️ WebSocket fermé');
        console.log(`📊 Total messages reçus: ${messageCount}`);
        console.log(`📡 Total abonnements créés: ${subscriptions.size}`);
    });
}

// Gestion Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt manuel (Ctrl+C)...');
    console.log(`📊 STATISTIQUES FINALES:`);
    console.log(`  - Messages reçus: ${messageCount}`);
    console.log(`  - Abonnements créés: ${subscriptions.size}`);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('🔌 Fermeture de la connexion WebSocket...');
        ws.close();
    }
    
    setTimeout(() => {
        console.log('\n✅ TEST COMPLET TERMINÉ!');
        process.exit(0);
    }, 1000);
});

// Démarrage
startCompleteMonitoring().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
});

console.log('\n💡 Ce test va créer de NOMBREUX abonnements WebSocket.');
console.log('💡 Appuyez sur Ctrl+C pour arrêter quand vous aurez assez de données.'); 