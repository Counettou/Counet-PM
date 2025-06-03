#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🔬 TEST WEBSOCKET HELIUS STANDARD - SURVEILLANCE 4 TOKENS
 * Adaptation pour surveiller CHAT, BRIX, INC, MASK simultanément
 */

const HELIUS_API_KEY = "b5bcbd8a-0b1a-41b4-aec3-f6346a6ca62e";
const HELIUS_STANDARD_WSS = `wss://mainnet.helius-rpc.com?api-key=${HELIUS_API_KEY}`;

// Configuration des tokens à surveiller
const TOKENS_TO_WATCH = {
    'CHAT': '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump',
    'BRIX': '5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx', 
    'INC': 'Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA',
    'MASK': '6MQpbiTC2YcogidTmKqMLK82qvE9z5QEm7EP3AEDpump'
};

let ws = null;
let messageCount = 0;
let startTime = Date.now();
let tokenStats = {};

// Initialiser les statistiques pour chaque token
Object.keys(TOKENS_TO_WATCH).forEach(name => {
    tokenStats[name] = {
        messages: 0,
        lastActivity: null,
        accounts: new Set(),
        transactions: []
    };
});

console.log('🚀 SURVEILLANCE HELIUS STANDARD - 4 TOKENS');
console.log('📊 Tokens surveillés:');
Object.entries(TOKENS_TO_WATCH).forEach(([name, address]) => {
    console.log(`   🎯 ${name}: ${address}`);
});
console.log(`📡 Endpoint: ${HELIUS_STANDARD_WSS.replace(HELIUS_API_KEY, 'XXX...XXX')}`);
console.log('⏰ Démarrage du monitoring...\n');

function getTokenNameByAddress(address) {
    for (const [name, addr] of Object.entries(TOKENS_TO_WATCH)) {
        if (addr === address) return name;
    }
    return null;
}

function formatUptime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
}

function connectWebSocket() {
    ws = new WebSocket(HELIUS_STANDARD_WSS);

    ws.on('open', () => {
        console.log('✅ WebSocket Helius Standard connecté!');
        
        // S'abonner aux comptes SPL Token pour chaque token
        Object.entries(TOKENS_TO_WATCH).forEach(([name, mint], index) => {
            const subscribeMessage = {
                jsonrpc: "2.0",
                id: index + 1,
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
                                    bytes: mint
                                }
                            }
                        ]
                    }
                ]
            };
            
            ws.send(JSON.stringify(subscribeMessage));
            console.log(`📡 Abonnement SPL Token ${name} envoyé (ID: ${index + 1})`);
        });

        // S'abonner aussi aux transactions impliquant ces tokens
        Object.entries(TOKENS_TO_WATCH).forEach(([name, mint], index) => {
            const subscribeTransactions = {
                jsonrpc: "2.0",
                id: index + 10,
                method: "logsSubscribe",
                params: [
                    {
                        mentions: [mint]
                    },
                    {
                        commitment: "confirmed"
                    }
                ]
            };
            
            ws.send(JSON.stringify(subscribeTransactions));
            console.log(`📡 Abonnement LOGS ${name} envoyé (ID: ${index + 10})`);
        });
        
        console.log('\n🎯 Surveillance active pour tous les tokens...\n');
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
            
            // Confirmation des abonnements
            if (message.result && !message.method) {
                console.log(`📋 [${timestamp}] Subscription confirmée: ID ${message.id} -> ${message.result}`);
                return;
            }
            
            // Notifications SPL Token
            if (message.method === 'programNotification') {
                const accountInfo = message.params?.result?.value;
                const slot = message.params?.result?.context?.slot;
                
                if (accountInfo?.data?.parsed?.info?.mint) {
                    const mint = accountInfo.data.parsed.info.mint;
                    const tokenName = getTokenNameByAddress(mint);
                    
                    if (tokenName) {
                        tokenStats[tokenName].messages++;
                        tokenStats[tokenName].lastActivity = now;
                        
                        console.log(`🔥 [${timestamp}] TOKEN ${tokenName} ACTIVITÉ!`);
                        console.log(`   📊 Slot: ${slot}`);
                        console.log(`   💰 Amount: ${accountInfo.data.parsed.info.tokenAmount?.uiAmount || 'N/A'}`);
                        console.log(`   👤 Owner: ${accountInfo.data.parsed.info.owner ? accountInfo.data.parsed.info.owner.slice(0, 8) + '...' : 'N/A'}`);
                        console.log(`   🏦 State: ${accountInfo.data.parsed.info.state || 'N/A'}`);
                        
                        if (accountInfo.data.parsed.info.owner) {
                            tokenStats[tokenName].accounts.add(accountInfo.data.parsed.info.owner);
                        }
                        
                        console.log('');
                    }
                }
            }
            
            // Notifications de logs (transactions)
            else if (message.method === 'logsNotification') {
                const logs = message.params?.result?.value?.logs || [];
                const signature = message.params?.result?.value?.signature;
                
                // Chercher quel token est mentionné dans les logs
                for (const [tokenName, mint] of Object.entries(TOKENS_TO_WATCH)) {
                    if (logs.some(log => log.includes(mint)) || 
                        JSON.stringify(message).includes(mint)) {
                        
                        tokenStats[tokenName].messages++;
                        tokenStats[tokenName].lastActivity = now;
                        tokenStats[tokenName].transactions.push({
                            signature,
                            timestamp: now,
                            logs: logs.slice(0, 3) // Garder seulement les 3 premiers logs
                        });
                        
                        console.log(`🚀 [${timestamp}] TRANSACTION ${tokenName}!`);
                        console.log(`   📝 Signature: ${signature ? signature.slice(0, 8) + '...' : 'N/A'}`);
                        console.log(`   📊 Logs count: ${logs.length}`);
                        
                        if (logs.length > 0) {
                            console.log(`   📄 Premier log: ${logs[0].substring(0, 100)}...`);
                        }
                        console.log('');
                        break;
                    }
                }
            }
            
            // Afficher les statistiques périodiquement
            if (messageCount % 20 === 0) {
                showTokenStatistics();
            }
            
        } catch (error) {
            console.log(`❌ [${timestamp}] Erreur parsing: ${error.message}`);
            console.log(`📄 Message brut: ${data.toString().substring(0, 200)}...`);
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

function showTokenStatistics() {
    const uptime = (Date.now() - startTime) / 1000;
    console.log('\n📊 === STATISTIQUES HELIUS STANDARD ===');
    console.log(`⏱️  Uptime: ${formatUptime(uptime)}`);
    console.log(`📨 Messages totaux reçus: ${messageCount}`);
    console.log(`📈 Taux: ${(messageCount / uptime * 60).toFixed(2)} msg/min\n`);
    
    Object.entries(tokenStats).forEach(([name, stats]) => {
        console.log(`🎯 ${name}:`);
        console.log(`   📊 Messages détectés: ${stats.messages}`);
        console.log(`   👥 Comptes uniques: ${stats.accounts.size}`);
        console.log(`   🚀 Transactions: ${stats.transactions.length}`);
        console.log(`   ⏰ Dernière activité: ${stats.lastActivity ? stats.lastActivity.toLocaleTimeString() : 'Aucune'}`);
    });
    console.log('='.repeat(50) + '\n');
}

// Gestionnaire d'arrêt propre
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du monitoring...');
    showTokenStatistics();
    
    console.log('\n📋 Résumé final:');
    const uptime = (Date.now() - startTime) / 1000;
    console.log(`   ⏱️  Durée totale: ${formatUptime(uptime)}`);
    console.log(`   📨 Messages reçus: ${messageCount}`);
    console.log(`   📈 Taux moyen: ${(messageCount / uptime * 60).toFixed(2)} msg/min`);
    
    // Afficher les dernières transactions pour chaque token
    Object.entries(tokenStats).forEach(([name, stats]) => {
        if (stats.transactions.length > 0) {
            console.log(`\n🚀 Dernières transactions ${name}:`);
            stats.transactions.slice(-3).forEach((tx, index) => {
                console.log(`   ${index + 1}. ${tx.signature ? tx.signature.slice(0, 12) + '...' : 'N/A'} à ${tx.timestamp.toLocaleTimeString()}`);
            });
        }
    });
    
    console.log('\n👋 Merci d\'avoir testé Helius Standard!');
    
    if (ws) {
        ws.close();
    }
    process.exit(0);
});

// Démarrer la connexion
connectWebSocket();

// Heartbeat pour maintenir la connexion
setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.ping();
    }
}, 30000);

// Statistiques automatiques toutes les 60 secondes
setInterval(() => {
    showTokenStatistics();
}, 60000); 