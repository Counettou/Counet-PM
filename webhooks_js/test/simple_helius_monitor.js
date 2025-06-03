#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🔍 MONITEUR SIMPLE HELIUS WEBSOCKET
 * 
 * Script ultra-simple pour voir exactement ce qu'on reçoit du WebSocket Helius
 * Surveille maintenant plusieurs tokens.
 * S'arrête manuellement avec Ctrl+C.
 */

const HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
const HELIUS_WSS_ENDPOINT = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_HTTP_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Tokens de test
const TARGET_TOKENS = [
    '5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx', // BRIX
    '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump', // chat
    'Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA', // INC
    '6KTefwGvQ4wgmNeobuzhTCKKE55vFoj5dJryAMp8Hau6'  // UselessRWD
];

let messageCount = 0;
let ws = null;
let messageId = 1; // Utilisé pour l'ID des requêtes JSON-RPC

console.log('🔍 MONITEUR SIMPLE HELIUS WEBSOCKET (MULTI-TOKEN)');
console.log('================================================');
console.log(`🎯 Tokens surveillés: ${TARGET_TOKENS.length}`);
TARGET_TOKENS.forEach(token => console.log(`  - ${token}`));
console.log(`🔌 Endpoint: ${HELIUS_WSS_ENDPOINT}`);
console.log('📊 Objectif: Capturer les messages bruts jusqu\'à arrêt manuel (Ctrl+C)\n');

// Fonction pour trouver les comptes du token
async function findTokenAccounts(mint) {
    try {
        console.log(`🔍 Recherche des comptes pour ${mint.substring(0, 8)}...`);
        
        const response = await fetch(HELIUS_HTTP_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: `findAccount-${mint}-${messageId++}`, // ID unique pour la requête
                method: "getProgramAccounts",
                params: [
                    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                    {
                        encoding: "jsonParsed",
                        filters: [
                            { dataSize: 165 },
                            { memcmp: { offset: 0, bytes: mint } }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();
        if (data.result && data.result.length > 0) {
            const accounts = data.result
                .map(acc => ({
                    pubkey: acc.pubkey,
                    amount: acc.account.data.parsed.info.tokenAmount.uiAmount || 0
                }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 1); // Prendre le plus gros compte seulement
            
            if (accounts.length > 0) {
                console.log(`✅ Compte principal pour ${mint.substring(0,8)}: ${accounts[0].pubkey} (${accounts[0].amount} tokens)`);
                return accounts[0];
            }
        }
        console.log(`⚠️ Aucun compte trouvé pour ${mint.substring(0,8)}`);
    } catch (error) {
        console.error(`❌ Erreur recherche comptes pour ${mint.substring(0,8)}: ${error.message}`);
    }
    return null;
}

// Fonction pour s'abonner à un compte
function subscribeToAccount(accountPubkey, mint) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.log(`❌ WebSocket non ouvert. Impossible de s'abonner à ${accountPubkey} pour ${mint.substring(0,8)}`);
        return;
    }
    
    const subscribeMessage = {
        jsonrpc: "2.0",
        id: `subscribe-${mint}-${messageId++}`, // ID unique pour l'abonnement
        method: "accountSubscribe",
        params: [
            accountPubkey,
            { encoding: "jsonParsed", commitment: "confirmed" }
        ]
    };
    
    console.log(`📡 Envoi de l'abonnement pour ${mint.substring(0,8)} (compte: ${accountPubkey})...`);
    console.log('📄 Message envoyé:', JSON.stringify(subscribeMessage, null, 1));
    ws.send(JSON.stringify(subscribeMessage));
}


// Fonction principale
async function startMonitoring() {
    console.log('🚀 DÉMARRAGE DU MONITORING MULTI-TOKEN...\n');
    
    console.log('🔌 Connexion au WebSocket Helius...');
    ws = new WebSocket(HELIUS_WSS_ENDPOINT);
    
    ws.on('open', async () => {
        console.log('✅ WebSocket connecté!\n');
        
        // S'abonner à chaque token
        for (const tokenMint of TARGET_TOKENS) {
            const account = await findTokenAccounts(tokenMint);
            if (account) {
                subscribeToAccount(account.pubkey, tokenMint);
            } else {
                console.log(`🚫 Impossible de s'abonner au token ${tokenMint.substring(0,8)} (compte non trouvé).`);
            }
            // Petit délai pour ne pas surcharger l'API ou le WebSocket avec trop de requêtes simultanées
            await new Promise(resolve => setTimeout(resolve, 200)); 
        }
        
        console.log('\n⏰ Attente des messages... (Ctrl+C pour arrêter)\n');
    });
    
    ws.on('message', (data) => {
        messageCount++;
        
        console.log(`\n🔥 ========== MESSAGE RAW #${messageCount} ==========`);
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
        console.log(`📏 Taille: ${data.length} bytes`);
        console.log('\n📄 DONNÉES BRUTES COMPLÈTES:');
        console.log('─'.repeat(50));
        
        // Afficher le JSON formaté
        try {
            const message = JSON.parse(data.toString());
            console.log(JSON.stringify(message, null, 2));
            
            // Analyse rapide du type
            let subscriptionId = message.id || (message.params ? message.params.subscription : null);

            if (message.result && typeof message.result === 'number') {
                console.log(`\n✅ TYPE: Confirmation d'abonnement (ID JSON-RPC: ${message.id}, Sub ID Helius: ${message.result})`);
            } else if (message.method === 'accountNotification') {
                console.log(`\n📊 TYPE: Notification de compte (Sub ID Helius: ${message.params.subscription})`);
                console.log(`🎯 Slot: ${message.params.result.context.slot}`);
                
                if (message.params.result.value.data?.parsed?.info) {
                    const info = message.params.result.value.data.parsed.info;
                    console.log(`💰 Lamports: ${message.params.result.value.lamports}`);
                    console.log(`👤 Owner: ${info.owner}`);
                    if (info.mint) console.log(`🌿 Mint du compte notifié: ${info.mint}`);

                    if (info.tokenAmount) {
                        const tokenAmount = info.tokenAmount;
                        console.log(`🪙 Token Amount: ${tokenAmount.amount} (${tokenAmount.uiAmount})`);
                        console.log(`🔢 Decimals: ${tokenAmount.decimals}`);
                    }
                }
            } else if (message.error) {
                console.log(`\n❌ TYPE: Erreur Helius (ID JSON-RPC: ${message.id})`);
                console.log(`Message d'erreur: ${message.error.message} (Code: ${message.error.code})`);
            } else {
                console.log(`\n❓ TYPE: Autre (${message.method || 'réponse sans méthode'}) (ID JSON-RPC: ${message.id})`);
            }
            
        } catch (error) {
            console.log('❌ Erreur parsing JSON, données string:');
            console.log(data.toString());
        }
        
        console.log('='.repeat(60));
        
    });
    
    ws.on('error', (error) => {
        console.error('\n❌ Erreur WebSocket:', error.message);
    });
    
    ws.on('close', () => {
        console.log('\n⚠️ WebSocket fermé');
        console.log(`📊 Total messages reçus: ${messageCount}`);
        console.log('🔄 Si l\'arrêt n\'est pas volontaire, relancer le script si nécessaire.');
    });
}

// Gestion Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt manuel (Ctrl+C)...');
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('🔌 Fermeture de la connexion WebSocket...');
        ws.close();
    }
    // Laisser le temps au message de fermeture de s'afficher
    setTimeout(() => {
        console.log('\n✅ MONITORING TERMINÉ MANUELLEMENT!');
        process.exit(0);
    }, 1000);
});

// Démarrage
startMonitoring().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
});

console.log('\n💡 Appuyez sur Ctrl+C pour arrêter manuellement le monitoring.'); 