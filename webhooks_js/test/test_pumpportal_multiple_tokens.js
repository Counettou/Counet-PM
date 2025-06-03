#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🔬 TEST PUMPPORTAL WEBSOCKET - SURVEILLANCE 4 TOKENS SIMULTANÉS
 * Test pour vérifier la surveillance simultanée de plusieurs tokens avec un seul WebSocket
 */

// Configuration des tokens à surveiller
const TOKENS_TO_WATCH = {
    'CHAT': '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump',
    'BRIX': '5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx', 
    'INC': 'Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA',
    'MASK': '6MQpbiTC2YcogidTmKqMLK82qvE9z5QEm7EP3AEDpump'
};

// Extraction des adresses pour l'abonnement
const TOKEN_ADDRESSES = Object.values(TOKENS_TO_WATCH);

let ws = null;
let messageCount = 0;
let startTime = Date.now();
let tokenStats = {};

// Initialiser les statistiques pour chaque token
Object.keys(TOKENS_TO_WATCH).forEach(name => {
    tokenStats[name] = {
        trades: 0,
        lastActivity: null,
        totalVolumeSol: 0
    };
});

console.log('🚀 TEST PUMPPORTAL - SURVEILLANCE MULTIPLE TOKENS');
console.log('📊 Tokens surveillés:');
Object.entries(TOKENS_TO_WATCH).forEach(([name, address]) => {
    console.log(`   🎯 ${name}: ${address}`);
});
console.log(`📡 Endpoint: wss://pumpportal.fun/api/data`);
console.log(`⚡ API Data GRATUITE de PumpPortal`);
console.log(`🔗 UN SEUL WebSocket pour ${Object.keys(TOKENS_TO_WATCH).length} tokens`);
console.log('⏰ Démarrage du monitoring...\n');

function getTokenNameByAddress(address) {
    for (const [name, addr] of Object.entries(TOKENS_TO_WATCH)) {
        if (addr === address) return name;
    }
    return 'UNKNOWN';
}

function formatUptime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
}

function connectWebSocket() {
    ws = new WebSocket('wss://pumpportal.fun/api/data');

    ws.on('open', () => {
        console.log('✅ WebSocket PumpPortal connecté!');
        
        // S'abonner aux trades de TOUS les tokens en une seule requête
        const subscribeTokens = {
            method: "subscribeTokenTrade",
            keys: TOKEN_ADDRESSES  // Tableau avec les 4 adresses
        };
        
        ws.send(JSON.stringify(subscribeTokens));
        console.log(`📡 Abonnement aux TRADES de ${Object.keys(TOKENS_TO_WATCH).length} tokens envoyé`);
        console.log(`   └─ Tokens: ${Object.keys(TOKENS_TO_WATCH).join(', ')}`);
        
        // S'abonner aux nouveaux tokens (optionnel, pour voir l'activité générale)
        const subscribeNewTokens = {
            method: "subscribeNewToken"
        };
        
        ws.send(JSON.stringify(subscribeNewTokens));
        console.log('📡 Abonnement aux NOUVEAUX TOKENS envoyé');
        
        // S'abonner aux migrations
        const subscribeMigrations = {
            method: "subscribeMigration"
        };
        
        ws.send(JSON.stringify(subscribeMigrations));
        console.log('📡 Abonnement aux MIGRATIONS envoyé\n');
    });

    ws.on('message', (data) => {
        try {
            messageCount++;
            const currentTime = new Date();
            const uptime = (Date.now() - startTime) / 1000;
            
            const message = JSON.parse(data);
            
            console.log(`=== Message #${messageCount} - ${currentTime.toLocaleTimeString()} - Uptime: ${uptime.toFixed(1)}s ===`);
            
            // Vérifier si c'est un message de confirmation d'abonnement
            if (message.message) {
                console.log(`✅ Confirmation: ${message.message}`);
                console.log('');
                return;
            }
            
            // Analyser les différents types de messages
            if (message.mint && TOKEN_ADDRESSES.includes(message.mint)) {
                // Trade détecté pour un de nos tokens surveillés!
                const tokenName = getTokenNameByAddress(message.mint);
                tokenStats[tokenName].trades++;
                tokenStats[tokenName].lastActivity = currentTime;
                
                if (message.solAmount) {
                    tokenStats[tokenName].totalVolumeSol += parseFloat(message.solAmount);
                }
                
                console.log(`🎯 *** TOKEN ${tokenName} DÉTECTÉ! ***`);
                console.log(`   💰 Type: ${message.txType || 'N/A'}`);
                console.log(`   🔢 Montant SOL: ${message.solAmount || 'N/A'}`);
                console.log(`   🪙 Montant Token: ${message.tokenAmount || 'N/A'}`);
                
                if (message.solAmount && message.tokenAmount) {
                    const pricePerToken = parseFloat(message.solAmount) / parseFloat(message.tokenAmount);
                    console.log(`   💲 Prix unitaire: ${pricePerToken.toExponential(4)} SOL/token`);
                }
                
                console.log(`   📊 Market Cap: ${message.marketCapSol || 'N/A'} SOL`);
                console.log(`   📊 Signature: ${message.signature || 'N/A'}`);
                console.log(`   👤 Trader: ${message.traderPublicKey ? message.traderPublicKey.slice(0, 8) + '...' : 'N/A'}`);
                console.log(`   🏊 Pool: ${message.pool || 'N/A'}`);
                
                if (message.tokensInPool && message.solInPool) {
                    console.log(`   💧 Liquidité Pool: ${parseFloat(message.tokensInPool).toLocaleString()} tokens / ${parseFloat(message.solInPool).toFixed(2)} SOL`);
                }
            } 
            else if (message.mint && message.txType === 'create') {
                // Nouveau token créé
                console.log(`🆕 Nouveau token créé:`);
                console.log(`   🎯 Mint: ${message.mint}`);
                console.log(`   📛 Nom: ${message.name || 'N/A'}`);
                console.log(`   🔤 Symbol: ${message.symbol || 'N/A'}`);
                console.log(`   💰 Initial Buy: ${message.initialBuy || 'N/A'} tokens`);
                console.log(`   💵 SOL Amount: ${message.solAmount || 'N/A'} SOL`);
                console.log(`   📊 Market Cap: ${message.marketCapSol || 'N/A'} SOL`);
            }
            else if (message.signature) {
                // Migration ou autre événement
                console.log(`🔄 Événement Migration/Autre:`);
                console.log(`   📊 Signature: ${message.signature}`);
                console.log(`   🎯 Mint: ${message.mint || 'N/A'}`);
            }
            else {
                console.log(`ℹ️  Autre message:`);
                console.log(`   📝 Type: ${typeof message}`);
                console.log(`   📄 Contenu: ${JSON.stringify(message).substring(0, 100)}...`);
            }
            
            console.log('\n📋 Données brutes:');
            console.log(JSON.stringify(message, null, 2));
            console.log('');
            
            // Afficher les statistiques toutes les 10 trades détectés
            const totalTrades = Object.values(tokenStats).reduce((sum, stat) => sum + stat.trades, 0);
            if (totalTrades > 0 && totalTrades % 10 === 0) {
                showTokenStatistics();
            }
            
        } catch (error) {
            console.error('❌ Erreur lors du parsing du message:', error);
            console.log('📄 Message brut:', data.toString());
        }
    });

    ws.on('error', (error) => {
        console.error('❌ Erreur WebSocket:', error);
    });

    ws.on('close', () => {
        console.log('🔌 WebSocket fermé. Tentative de reconnexion dans 5 secondes...');
        setTimeout(connectWebSocket, 5000);
    });
}

function showTokenStatistics() {
    const uptime = (Date.now() - startTime) / 1000;
    console.log('📊 === STATISTIQUES TOKENS ===');
    console.log(`⏱️  Uptime: ${formatUptime(uptime)}`);
    console.log(`📨 Messages totaux reçus: ${messageCount}`);
    console.log(`📈 Taux: ${(messageCount / uptime * 60).toFixed(2)} msg/min\n`);
    
    Object.entries(tokenStats).forEach(([name, stats]) => {
        console.log(`🎯 ${name}:`);
        console.log(`   📊 Trades détectés: ${stats.trades}`);
        console.log(`   💰 Volume total: ${stats.totalVolumeSol.toFixed(6)} SOL`);
        console.log(`   ⏰ Dernière activité: ${stats.lastActivity ? stats.lastActivity.toLocaleTimeString() : 'Aucune'}`);
    });
    console.log('='.repeat(40) + '\n');
}

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du monitoring...');
    showTokenStatistics();
    
    console.log('📊 Résumé final:');
    const uptime = (Date.now() - startTime) / 1000;
    console.log(`   ⏱️  Durée totale: ${formatUptime(uptime)}`);
    console.log(`   📨 Messages reçus: ${messageCount}`);
    console.log(`   📈 Taux moyen: ${(messageCount / uptime * 60).toFixed(2)} msg/min`);
    
    const totalTrades = Object.values(tokenStats).reduce((sum, stat) => sum + stat.trades, 0);
    console.log(`   🎯 Trades détectés: ${totalTrades}`);
    console.log('👋 Merci d\'avoir testé PumpPortal!');
    
    if (ws) {
        ws.close();
    }
    process.exit(0);
});

// Afficher les statistiques toutes les 30 secondes
setInterval(() => {
    const uptime = (Date.now() - startTime) / 1000;
    if (uptime >= 30 && uptime % 30 < 1) {
        console.log(`📊 Statut - Uptime: ${formatUptime(uptime)} | Messages: ${messageCount} | Taux: ${(messageCount / uptime * 60).toFixed(2)} msg/min\n`);
    }
}, 1000);

// Démarrer la connexion
connectWebSocket(); 