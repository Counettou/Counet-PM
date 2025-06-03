#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🚀 TEST WEBSOCKET HELIUS ENHANCED - TOKEN CHAT
 * Terminal 2: WebSocket Enhanced pour comparaison
 */

const HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
const HELIUS_ENHANCED_WSS = `wss://atlas-mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const CHAT_MINT = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';

let ws = null;
let messageCount = 0;
let startTime = Date.now();

console.log('🚀 TERMINAL 2 - WebSocket ENHANCED Helius');
console.log(`🎯 Token CHAT: ${CHAT_MINT}`);
console.log(`📡 Endpoint: ${HELIUS_ENHANCED_WSS.replace(HELIUS_API_KEY, 'XXX...XXX')}`);
console.log('⏰ Démarrage du monitoring...\n');

function connectWebSocket() {
    ws = new WebSocket(HELIUS_ENHANCED_WSS);

    ws.on('open', () => {
        console.log('✅ WebSocket Enhanced connecté!');
        
        // S'abonner aux transactions impliquant CHAT
        const subscribeMessage = {
            jsonrpc: "2.0",
            id: 1,
            method: "transactionSubscribe",
            params: [
                {
                    mentions: [CHAT_MINT],
                    commitment: "confirmed",
                    encoding: "jsonParsed",
                    transactionDetails: "full",
                    showRewards: true,
                    maxSupportedTransactionVersion: 0
                }
            ]
        };
        
        ws.send(JSON.stringify(subscribeMessage));
        console.log('📡 Abonnement aux transactions CHAT envoyé\n');
    });

    ws.on('message', (data) => {
        messageCount++;
        const now = new Date();
        const timestamp = now.toLocaleTimeString('fr-FR', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            fractionalSecondDigits: 3
        });
        
        try {
            const message = JSON.parse(data.toString());
            
            if (message.method === 'transactionNotification') {
                const transaction = message.params?.result?.transaction;
                const meta = transaction?.meta;
                
                console.log(`🔥 [${timestamp}] ENHANCED - Message #${messageCount}`);
                console.log(`   📊 Slot: ${message.params?.result?.slot || 'N/A'}`);
                console.log(`   💸 Fee: ${meta?.fee || 'N/A'} lamports`);
                
                // Chercher les transferts de tokens CHAT
                if (meta?.postTokenBalances) {
                    const chatTransfers = meta.postTokenBalances.filter(tb => tb.mint === CHAT_MINT);
                    if (chatTransfers.length > 0) {
                        console.log(`   💰 Transferts CHAT détectés: ${chatTransfers.length}`);
                        chatTransfers.forEach((transfer, i) => {
                            console.log(`     ${i+1}. Amount: ${transfer.uiTokenAmount?.uiAmountString || 'N/A'}`);
                        });
                    }
                }
                
                // Signature de la transaction
                if (transaction?.signatures?.length > 0) {
                    console.log(`   🔑 Signature: ${transaction.signatures[0].substring(0, 20)}...`);
                }
                
                console.log('');
            } else if (message.result) {
                console.log(`📋 [${timestamp}] Subscription confirmée: ${message.result}`);
            }
            
        } catch (error) {
            console.log(`❌ [${timestamp}] Erreur parsing: ${error.message}`);
        }
    });

    ws.on('error', (error) => {
        console.error(`❌ Erreur WebSocket: ${error.message}`);
    });

    ws.on('close', (code, reason) => {
        console.log(`⚠️ WebSocket fermé. Code: ${code}, Raison: ${reason}`);
        
        // Reconnexion automatique après 5 secondes
        setTimeout(() => {
            console.log('🔄 Tentative de reconnexion...');
            connectWebSocket();
        }, 5000);
    });
}

// Démarrer la connexion
connectWebSocket();

// Heartbeat simple - plus fréquent pour Enhanced
setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.ping();
    }
}, 60000); // Ping toutes les minutes comme recommandé

// Statistiques toutes les 30 secondes
setInterval(() => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    console.log(`📊 [STATS ENHANCED] Messages: ${messageCount} | Uptime: ${uptime}s`);
}, 30000); 