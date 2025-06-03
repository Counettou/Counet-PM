#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🔍 DEBUG RAW WEBSOCKET - AFFICHAGE COMPLET
 * 
 * Affiche TOUT ce qui est reçu du WebSocket sans aucun filtre
 */

class RawWebSocketDebugger {
    constructor() {
        this.HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
        this.HELIUS_STANDARD_WSS = `wss://mainnet.helius-rpc.com?api-key=${this.HELIUS_API_KEY}`;
        
        // Token KITTY mint address - CORRIGÉ avec la vraie adresse active
        this.KITTY_MINT = 'DFfPq2hHbJeunp1F6eNyuyvBHcPpnTqaawn2tAFUpump';
        
        this.ws = null;
        this.messageCount = 0;
        this.startTime = Date.now();
    }

    async start() {
        console.log('🔍 DEBUG RAW WEBSOCKET - MODE COMPLET');
        console.log(`🔗 Endpoint: ${this.HELIUS_STANDARD_WSS}`);
        console.log(`🎯 Token KITTY: ${this.KITTY_MINT}`);
        console.log('📋 Affichage: TOUS LES MESSAGES REÇUS\n');
        
        try {
            this.ws = new WebSocket(this.HELIUS_STANDARD_WSS);
            
            this.ws.on('open', () => {
                console.log('✅ WebSocket RAW connecté!');
                console.log('📤 Abonnement au mint KITTY...\n');
                this.subscribeToKittyMint();
            });

            this.ws.on('message', (data) => {
                this.logRawMessage(data);
            });

            this.ws.on('error', (error) => {
                console.error('❌ ERREUR WebSocket:', error);
            });

            this.ws.on('close', (code, reason) => {
                console.log(`⚠️ WebSocket fermé. Code: ${code}, Raison: ${reason || 'Aucune'}`);
            });

            this.ws.on('ping', () => {
                console.log('🏓 PING reçu du serveur');
            });

            this.ws.on('pong', () => {
                console.log('🏓 PONG reçu du serveur');
            });

        } catch (error) {
            console.error('❌ Erreur connexion:', error);
        }
    }

    subscribeToKittyMint() {
        const subscribeRequest = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "accountSubscribe",
            "params": [
                this.KITTY_MINT,
                {
                    "encoding": "jsonParsed",
                    "commitment": "confirmed"
                }
            ]
        };

        console.log('📤 ENVOI DEMANDE ABONNEMENT:');
        console.log(JSON.stringify(subscribeRequest, null, 2));
        console.log('\n' + '='.repeat(80) + '\n');
        
        this.ws.send(JSON.stringify(subscribeRequest));
    }

    logRawMessage(data) {
        this.messageCount++;
        const timestamp = new Date().toISOString();
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║ 📨 MESSAGE RAW #${this.messageCount.toString().padStart(4)} - ${timestamp.substring(11, 19)} (${uptime}s)   ║
╚═══════════════════════════════════════════════════════════════╝`);
        
        try {
            // Essayer de parser en JSON
            const message = JSON.parse(data.toString());
            
            console.log('📋 TYPE: JSON PARSÉ');
            console.log('📊 CONTENU COMPLET:');
            console.log(JSON.stringify(message, null, 2));
            
            // Analyse du type de message
            if (message.result !== undefined) {
                console.log(`🔍 TYPE DÉTECTÉ: Réponse (result: ${message.result})`);
            } else if (message.method) {
                console.log(`🔍 TYPE DÉTECTÉ: Notification (method: ${message.method})`);
            } else if (message.error) {
                console.log(`🔍 TYPE DÉTECTÉ: Erreur`);
                console.log(`❌ ERREUR: ${JSON.stringify(message.error, null, 2)}`);
            } else {
                console.log('🔍 TYPE DÉTECTÉ: Message inconnu');
            }
            
        } catch (parseError) {
            console.log('📋 TYPE: DONNÉES BRUTES (non-JSON)');
            console.log('📊 CONTENU BRUT:');
            console.log(data.toString());
            console.log(`❌ Erreur parsing JSON: ${parseError.message}`);
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Stats périodiques
        if (this.messageCount % 10 === 0) {
            this.showStats();
        }
    }

    showStats() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const avgMsgPerSec = (this.messageCount / uptime).toFixed(2);
        
        console.log(`
┌─────────────────────────────────────────────────────────────┐
│                    📊 STATS DEBUG RAW                      │
├─────────────────────────────────────────────────────────────┤
│ Uptime               : ${uptime}s                           │
│ Messages reçus       : ${this.messageCount}                              │
│ Moyenne/seconde      : ${avgMsgPerSec} msg/s                        │
│ WebSocket            : 🟢 Actif                            │
│ Mode                 : 🔍 DEBUG COMPLET                    │
└─────────────────────────────────────────────────────────────┘`);
    }

    stop() {
        console.log('\n🛑 Arrêt du debug...');
        
        if (this.ws) {
            this.ws.close();
        }
        
        this.showStats();
        
        console.log(`
🎯 RÉSUMÉ DEBUG:
• Messages totaux reçus: ${this.messageCount}
• Durée du test: ${Math.floor((Date.now() - this.startTime) / 1000)}s
• WebSocket fonctionnel: ${this.messageCount > 0 ? 'OUI' : 'NON'}

💡 Analyse: ${this.messageCount === 0 ? 'Aucun message reçu - Problème de connexion ou token inactif' : 'Messages reçus - Voir logs ci-dessus pour diagnostic'}`);
        
        console.log('✅ Debug terminé');
    }
}

// Gestion des signaux
const debug = new RawWebSocketDebugger();

process.on('SIGINT', () => {
    debug.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    debug.stop();
    process.exit(0);
});

// Démarrer le debug
console.log('⏳ Démarrage du debug en 2 secondes... (Ctrl+C pour arrêter)');
setTimeout(() => {
    debug.start().catch(console.error);
}, 2000); 