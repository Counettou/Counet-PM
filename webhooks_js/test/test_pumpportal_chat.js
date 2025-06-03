#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🔬 TEST PUMPPORTAL WEBSOCKET - TOKEN CHAT
 * Test complet des fonctionnalités PumpPortal pour surveillance token
 */

const CHAT_MINT = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';

let ws = null;
let messageCount = 0;
let startTime = Date.now();

console.log('🚀 TEST PUMPPORTAL - SURVEILLANCE TOKEN CHAT');
console.log(`🎯 Token CHAT: ${CHAT_MINT}`);
console.log(`📡 Endpoint: wss://pumpportal.fun/api/data`);
console.log('⚡ API Data GRATUITE de PumpPortal');
console.log('⏰ Démarrage du monitoring...\n');

function connectWebSocket() {
    ws = new WebSocket('wss://pumpportal.fun/api/data');

    ws.on('open', () => {
        console.log('✅ WebSocket PumpPortal connecté!');
        
        // S'abonner aux trades du token CHAT
        const subscribeTokenTrade = {
            method: "subscribeTokenTrade",
            keys: [CHAT_MINT]
        };
        
        ws.send(JSON.stringify(subscribeTokenTrade));
        console.log('📡 Abonnement aux TRADES du token CHAT envoyé');
        
        // S'abonner aux nouveaux tokens (pour comparaison)
        const subscribeNewToken = {
            method: "subscribeNewToken"
        };
        
        ws.send(JSON.stringify(subscribeNewToken));
        console.log('📡 Abonnement aux NOUVEAUX TOKENS envoyé');
        
        // S'abonner aux migrations
        const subscribeMigration = {
            method: "subscribeMigration"
        };
        
        ws.send(JSON.stringify(subscribeMigration));
        console.log('📡 Abonnement aux MIGRATIONS envoyé\n');
    });

    ws.on('message', (data) => {
        messageCount++;
        const message = JSON.parse(data);
        const timestamp = new Date().toLocaleTimeString();
        const uptime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log(`\n=== Message #${messageCount} - ${timestamp} - Uptime: ${uptime}s ===`);
        
        // Identifier le type de message
        if (message.mint) {
            if (message.mint === CHAT_MINT) {
                console.log('🎯 *** TOKEN CHAT DÉTECTÉ! ***');
                console.log(`   💰 Type: ${message.txType || 'Trade'}`);
                console.log(`   🔢 Montant SOL: ${message.solAmount || 'N/A'}`);
                console.log(`   🪙 Montant Token: ${message.tokenAmount || 'N/A'}`);
                console.log(`   💵 Valeur USD: ${message.usdValue || 'N/A'}`);
                console.log(`   📊 Signature: ${message.signature || 'N/A'}`);
                console.log(`   👤 User: ${message.user || 'N/A'}`);
                console.log(`   ⏱️  Timestamp: ${message.timestamp || 'N/A'}`);
                console.log(`   🏊 Pool: ${message.pool || 'N/A'}`);
            } else if (message.txType === 'create') {
                console.log('🆕 Nouveau token créé:');
                console.log(`   🎯 Mint: ${message.mint}`);
                console.log(`   📛 Nom: ${message.name || 'N/A'}`);
                console.log(`   🔤 Symbol: ${message.symbol || 'N/A'}`);
                console.log(`   👤 Creator: ${message.creator || 'N/A'}`);
            } else {
                console.log('📈 Trade autre token:');
                console.log(`   🎯 Mint: ${message.mint}`);
                console.log(`   💰 Type: ${message.txType || 'Trade'}`);
                console.log(`   💵 Valeur USD: ${message.usdValue || 'N/A'}`);
            }
        } else {
            console.log('ℹ️  Autre message:');
            console.log(`   📝 Type: ${typeof message}`);
            console.log(`   📄 Contenu: ${JSON.stringify(message).substring(0, 200)}...`);
        }
        
        // Afficher les données brutes pour debug
        console.log('\n📋 Données brutes:');
        console.log(JSON.stringify(message, null, 2));
    });

    ws.on('error', (error) => {
        console.error(`❌ Erreur WebSocket:`, error.message);
    });

    ws.on('close', (code, reason) => {
        console.log(`⚠️ WebSocket fermé. Code: ${code}, Raison: ${reason}`);
        console.log('🔄 Reconnexion dans 5 secondes...');
        setTimeout(connectWebSocket, 5000);
    });
}

// Gestion des signaux d'arrêt
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du monitoring PumpPortal...');
    const uptime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`📊 Statistiques de session:`);
    console.log(`   ⏱️  Durée: ${uptime}s`);
    console.log(`   📨 Messages reçus: ${messageCount}`);
    console.log(`   📈 Taux: ${(messageCount / (uptime / 60)).toFixed(2)} msg/min`);
    
    if (ws) {
        ws.close();
    }
    process.exit(0);
});

// Démarrer la connexion
connectWebSocket();

// Afficher un statut périodique
setInterval(() => {
    const uptime = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = messageCount > 0 ? (messageCount / (uptime / 60)).toFixed(2) : '0.00';
    console.log(`\n📊 Statut - Uptime: ${uptime}s | Messages: ${messageCount} | Taux: ${rate} msg/min`);
}, 30000); // Toutes les 30 secondes 