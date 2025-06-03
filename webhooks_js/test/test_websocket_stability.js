#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🧪 TEST DE STABILITÉ WEBSOCKET HELIUS
 * 
 * Surveille la connexion WebSocket pendant 5 minutes pour vérifier 
 * qu'elle ne se déconnecte plus après 20 secondes
 */

class WebSocketStabilityTest {
    constructor() {
        this.HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
        this.HELIUS_WSS_ENDPOINT = `wss://mainnet.helius-rpc.com/?api-key=${this.HELIUS_API_KEY}`;
        
        this.ws = null;
        this.startTime = Date.now();
        this.pingCount = 0;
        this.pongCount = 0;
        this.reconnectCount = 0;
        this.lastPingTime = null;
        this.isRunning = false;
        
        this.stats = {
            connectionTime: 0,
            totalPings: 0,
            totalPongs: 0,
            avgLatency: 0,
            maxLatency: 0,
            disconnections: 0
        };
    }

    async start() {
        console.log('🧪 TEST DE STABILITÉ WEBSOCKET HELIUS');
        console.log('⏱️  Durée: 5 minutes');
        console.log('🎯 Objectif: Vérifier absence de déconnexion après 20s\n');
        
        this.isRunning = true;
        this.startTime = Date.now();
        await this.connect();
        
        // Arrêt automatique après 5 minutes
        setTimeout(() => {
            this.stop();
        }, 5 * 60 * 1000);
    }

    async connect() {
        try {
            console.log(`🔌 Connexion WebSocket... (Tentative ${this.reconnectCount + 1})`);
            
            this.ws = new WebSocket(this.HELIUS_WSS_ENDPOINT, {
                pingInterval: 15000,
                pongTimeout: 10000,
                handshakeTimeout: 30000,
            });
            
            this.ws.on('open', () => {
                const connectTime = Date.now();
                console.log(`✅ WebSocket connecté! (${connectTime - this.startTime}ms depuis démarrage)`);
                this.stats.connectionTime = connectTime;
                this.startHeartbeat();
            });

            this.ws.on('pong', () => {
                this.pongCount++;
                this.stats.totalPongs++;
                
                if (this.lastPingTime) {
                    const latency = Date.now() - this.lastPingTime;
                    this.stats.avgLatency = (this.stats.avgLatency + latency) / 2;
                    this.stats.maxLatency = Math.max(this.stats.maxLatency, latency);
                    
                    console.log(`💓 Pong ${this.pongCount} - Latence: ${latency}ms`);
                }
            });

            this.ws.on('error', (error) => {
                console.error(`❌ Erreur WebSocket: ${error.message}`);
            });

            this.ws.on('close', (code, reason) => {
                const uptime = Math.floor((Date.now() - this.stats.connectionTime) / 1000);
                console.log(`⚠️ WebSocket fermé après ${uptime}s - Code: ${code}, Raison: ${reason || 'Aucune'}`);
                this.stats.disconnections++;
                
                if (this.isRunning) {
                    this.reconnectCount++;
                    console.log(`🔄 Reconnexion dans 3s... (${this.reconnectCount})`);
                    setTimeout(() => {
                        if (this.isRunning) {
                            this.connect();
                        }
                    }, 3000);
                }
            });

        } catch (error) {
            console.error('❌ Erreur connexion:', error);
        }
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.lastPingTime = Date.now();
                this.pingCount++;
                this.stats.totalPings++;
                
                this.ws.ping();
                console.log(`📡 Ping ${this.pingCount} envoyé`);
            }
        }, 15000);
    }

    stop() {
        console.log('\n🛑 Arrêt du test...');
        this.isRunning = false;
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        if (this.ws) {
            this.ws.close();
        }
        
        this.printReport();
    }

    printReport() {
        const totalTime = Math.floor((Date.now() - this.startTime) / 1000);
        const uptimePercentage = this.stats.connectionTime > 0 ? 
            Math.round(((Date.now() - this.stats.connectionTime) / (Date.now() - this.startTime)) * 100) : 0;

        console.log('\n┌─────────────────────────────────────────────────────────────┐');
        console.log('│                    📊 RAPPORT DE STABILITÉ                 │');
        console.log('├─────────────────────────────────────────────────────────────┤');
        console.log(`│ Durée totale         : ${totalTime}s                              │`);
        console.log(`│ Pings envoyés        : ${this.stats.totalPings}                                   │`);
        console.log(`│ Pongs reçus          : ${this.stats.totalPongs}                                   │`);
        console.log(`│ Latence moyenne      : ${Math.round(this.stats.avgLatency)}ms                             │`);
        console.log(`│ Latence max          : ${this.stats.maxLatency}ms                             │`);
        console.log(`│ Déconnexions         : ${this.stats.disconnections}                                   │`);
        console.log(`│ Reconnexions         : ${this.reconnectCount}                                   │`);
        console.log(`│ Uptime               : ${uptimePercentage}%                               │`);
        console.log('└─────────────────────────────────────────────────────────────┘');
        
        if (this.stats.disconnections === 0) {
            console.log('🎉 SUCCÈS! Aucune déconnexion détectée');
        } else if (this.stats.disconnections === 1 && totalTime > 240) {
            console.log('✅ ACCEPTABLE: Une seule déconnexion sur 4+ minutes');
        } else {
            console.log('⚠️ PROBLÈME: Déconnexions multiples détectées');
        }
        
        process.exit(0);
    }
}

// Démarrage du test
const test = new WebSocketStabilityTest();
test.start();

// Gestion des signaux d'arrêt
process.on('SIGINT', () => {
    console.log('\n🛑 Signal d\'arrêt reçu...');
    test.stop();
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Signal de terminaison reçu...');
    test.stop();
}); 