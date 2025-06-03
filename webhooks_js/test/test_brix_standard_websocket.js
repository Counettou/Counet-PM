#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🔬 TEST WEBSOCKET HELIUS STANDARD - TOKEN CHAT
 * Terminal 1: WebSocket standard pour comparaison
 */

const HELIUS_API_KEY = "b5bcbd8a-0b1a-41b4-aec3-f6346a6ca62e";
const HELIUS_STANDARD_WSS = `wss://mainnet.helius-rpc.com?api-key=${HELIUS_API_KEY}`;
const CHAT_MINT = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';

let ws = null;
let messageCount = 0;
let startTime = Date.now();

console.log('🚀 TERMINAL 1 - WebSocket STANDARD Helius');
console.log(`🎯 Token CHAT: ${CHAT_MINT}`);
console.log(`📡 Endpoint: ${HELIUS_STANDARD_WSS.replace(HELIUS_API_KEY, 'XXX...XXX')}`);
console.log('⏰ Démarrage du monitoring...\n');

function connectWebSocket() {
    ws = new WebSocket(HELIUS_STANDARD_WSS);

    ws.on('open', () => {
        console.log('✅ WebSocket Standard connecté!');
        
        // S'abonner aux comptes du token CHAT
        const subscribeMessage = {
            jsonrpc: "2.0",
            id: 1,
            method: "programSubscribe",
            params: [
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token Program
                {
                    encoding: "jsonParsed",
                    commitment: "confirmed",
                    filters: [
                        {
                            memcmp: {
                                offset: 0,
                                bytes: CHAT_MINT
                            }
                        }
                    ]
                }
            ]
        };
        
        ws.send(JSON.stringify(subscribeMessage));
        console.log('📡 Abonnement aux comptes SPL Token CHAT envoyé\n');
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
            
            if (message.method === 'programNotification') {
                const accountInfo = message.params?.result?.value;
                
                console.log(`🟢 [${timestamp}] STANDARD - Message #${messageCount}`);
                console.log(`   📊 Account: ${message.params?.result?.context?.slot || 'N/A'}`);
                
                if (accountInfo?.data?.parsed?.info?.mint === CHAT_MINT) {
                    console.log(`   💰 Token CHAT détecté!`);
                    console.log(`   🔢 Amount: ${accountInfo.data.parsed.info.tokenAmount?.uiAmount || 'N/A'}`);
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

// Heartbeat simple
setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.ping();
    }
}, 30000);

// Statistiques toutes les 30 secondes
setInterval(() => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    console.log(`📊 [STATS STANDARD] Messages: ${messageCount} | Uptime: ${uptime}s`);
}, 30000); 