#!/usr/bin/env node

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

/**
 * 🚀 TEST WEBSOCKET HELIUS - MONITORING TEMPS RÉEL
 * 
 * Test des WebSockets Solana natifs via Helius (GRATUIT)
 * Pour surveiller les prix des positions ouvertes en temps réel
 */

// Configuration Helius
const HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
const HELIUS_WSS_ENDPOINT = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_HTTP_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Tokens à surveiller (depuis positions ouvertes)
const TOKENS_TO_WATCH = [
    'EytLgZytPSwzMizHbyC2Y8Et1wwqriywWoouvgfHpump', // Position 1
    '6KTefwGvQ4wgmNeobuzhTCKKE55vFoj5dJryAMp8Hau6'  // Position 2
];

// Variables globales
let ws = null;
let subscriptions = new Map();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let heartbeatInterval = null;
let priceHistory = new Map();
let startTime = Date.now();

/**
 * Classe pour gérer le monitoring WebSocket
 */
class HeliusWebSocketMonitor {
    constructor() {
        this.isConnected = false;
        this.messageId = 1;
        this.lastPrices = new Map();
        this.stats = {
            totalMessages: 0,
            priceUpdates: 0,
            errors: 0,
            startTime: Date.now()
        };
    }

    /**
     * Initialiser la connexion WebSocket
     */
    async init() {
        console.log('🚀 Démarrage du monitoring WebSocket Helius...\n');
        console.log(`📡 Endpoint: ${HELIUS_WSS_ENDPOINT.replace(HELIUS_API_KEY, 'XXX...XXX')}`);
        console.log(`🎯 Tokens à surveiller: ${TOKENS_TO_WATCH.length}`);
        console.log('┌─────────────────────────────────────────────────────────┐');
        
        TOKENS_TO_WATCH.forEach((token, index) => {
            console.log(`│ ${index + 1}. ${token.substring(0, 8)}...${token.substring(token.length - 8)} │`);
        });
        console.log('└─────────────────────────────────────────────────────────┘\n');

        await this.connect();
    }

    /**
     * Établir la connexion WebSocket
     */
    async connect() {
        try {
            ws = new WebSocket(HELIUS_WSS_ENDPOINT);

            ws.on('open', () => {
                console.log('✅ Connexion WebSocket établie!');
                this.isConnected = true;
                reconnectAttempts = 0;
                this.startHeartbeat();
                this.subscribeToTokens();
            });

            ws.on('message', (data) => {
                this.handleMessage(data);
            });

            ws.on('error', (error) => {
                console.error('❌ Erreur WebSocket:', error.message);
                this.stats.errors++;
            });

            ws.on('close', (code, reason) => {
                console.log(`⚠️ Connexion fermée. Code: ${code}, Raison: ${reason}`);
                this.isConnected = false;
                this.stopHeartbeat();
                this.attemptReconnect();
            });

        } catch (error) {
            console.error('❌ Erreur connexion:', error);
            this.attemptReconnect();
        }
    }

    /**
     * S'abonner aux changements des comptes tokens SPL
     */
    async subscribeToTokens() {
        console.log('📡 Abonnement aux tokens...\n');

        for (const tokenMint of TOKENS_TO_WATCH) {
            try {
                // Récupérer les informations du token d'abord
                const tokenInfo = await this.getTokenInfo(tokenMint);
                console.log(`🔍 Token ${tokenMint.substring(0, 8)}... : ${tokenInfo?.symbol || 'Unknown'}`);

                // S'abonner au programme SPL Token pour ce mint
                const subscribeMessage = {
                    jsonrpc: "2.0",
                    id: this.messageId++,
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
                                        bytes: tokenMint
                                    }
                                }
                            ]
                        }
                    ]
                };

                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(subscribeMessage));
                    console.log(`✅ Abonnement envoyé pour ${tokenMint.substring(0, 8)}...`);
                }

            } catch (error) {
                console.error(`❌ Erreur abonnement token ${tokenMint.substring(0, 8)}...:`, error.message);
            }
        }

        console.log('\n🎯 Monitoring en cours... (Ctrl+C pour arrêter)\n');
        this.displayHeader();
    }

    /**
     * Récupérer les informations d'un token via RPC
     */
    async getTokenInfo(tokenMint) {
        try {
            const response = await fetch(HELIUS_HTTP_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "getAsset",
                    params: [tokenMint]
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.result && data.result.content) {
                    return {
                        symbol: data.result.content.metadata?.symbol || 'Unknown',
                        name: data.result.content.metadata?.name || 'Unknown Token'
                    };
                }
            }
        } catch (error) {
            console.log(`⚠️ Impossible de récupérer les infos pour ${tokenMint.substring(0, 8)}...`);
        }
        return null;
    }

    /**
     * Traiter les messages WebSocket reçus
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            this.stats.totalMessages++;

            // Message de confirmation d'abonnement
            if (message.result && typeof message.result === 'number') {
                const subscriptionId = message.result;
                console.log(`📝 Abonnement confirmé - ID: ${subscriptionId}`);
                subscriptions.set(message.id, subscriptionId);
                return;
            }

            // Notification de changement de programme
            if (message.method === 'programNotification') {
                this.handleTokenUpdate(message.params);
                return;
            }

            // Autres messages
            if (message.error) {
                console.error('❌ Erreur reçue:', message.error);
                this.stats.errors++;
            }

        } catch (error) {
            console.error('❌ Erreur parsing message:', error.message);
            this.stats.errors++;
        }
    }

    /**
     * Traiter les mises à jour de tokens
     */
    handleTokenUpdate(params) {
        try {
            const result = params.result;
            const accountInfo = result.value.account;
            const pubkey = result.value.pubkey;
            
            if (accountInfo.data && accountInfo.data.parsed) {
                const parsedData = accountInfo.data.parsed;
                
                // Vérifier si c'est un compte de token
                if (parsedData.type === 'account' && parsedData.info) {
                    const tokenInfo = parsedData.info;
                    const mint = tokenInfo.mint;
                    const amount = tokenInfo.tokenAmount?.uiAmount || 0;
                    
                    // Ne traiter que les tokens qu'on surveille
                    if (TOKENS_TO_WATCH.includes(mint)) {
                        this.stats.priceUpdates++;
                        this.displayTokenUpdate(mint, amount, pubkey);
                        
                        // Sauvegarder l'historique
                        if (!priceHistory.has(mint)) {
                            priceHistory.set(mint, []);
                        }
                        priceHistory.get(mint).push({
                            timestamp: Date.now(),
                            amount: amount,
                            account: pubkey,
                            slot: result.context.slot
                        });
                    }
                }
            }

        } catch (error) {
            console.error('❌ Erreur traitement update:', error.message);
        }
    }

    /**
     * Afficher l'en-tête du monitoring
     */
    displayHeader() {
        console.log('┌─────────────────────────────────────────────────────────────────────────────────┐');
        console.log('│                           🚀 MONITORING TEMPS RÉEL                            │');
        console.log('├─────────────────────────────────────────────────────────────────────────────────┤');
        console.log('│ Heure    │ Token        │ Montant         │ Compte                       │ Slot   │');
        console.log('├─────────────────────────────────────────────────────────────────────────────────┤');
    }

    /**
     * Afficher une mise à jour de token
     */
    displayTokenUpdate(mint, amount, account) {
        const time = new Date().toLocaleTimeString('fr-FR');
        const tokenShort = mint.substring(0, 8) + '...';
        const accountShort = account.substring(0, 20) + '...';
        const amountFormatted = amount.toLocaleString('fr-FR', { maximumFractionDigits: 6 });
        
        console.log(`│ ${time} │ ${tokenShort.padEnd(12)} │ ${amountFormatted.padEnd(15)} │ ${accountShort.padEnd(28)} │ ${new Date().getTime().toString().slice(-6)} │`);
    }

    /**
     * Démarrer le heartbeat
     */
    startHeartbeat() {
        heartbeatInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        }, 30000); // Ping toutes les 30 secondes
    }

    /**
     * Arrêter le heartbeat
     */
    stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    /**
     * Tentative de reconnexion
     */
    attemptReconnect() {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            
            console.log(`🔄 Tentative de reconnexion ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} dans ${delay/1000}s...`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.log('❌ Nombre maximum de tentatives de reconnexion atteint');
            process.exit(1);
        }
    }

    /**
     * Afficher les statistiques
     */
    displayStats() {
        const uptime = Date.now() - this.stats.startTime;
        const uptimeSeconds = Math.floor(uptime / 1000);
        
        console.log('\n┌─────────────────────────────────────────────────────────────┐');
        console.log('│                       📊 STATISTIQUES                      │');
        console.log('├─────────────────────────────────────────────────────────────┤');
        console.log(`│ Temps de fonctionnement : ${uptimeSeconds}s                              │`);
        console.log(`│ Messages reçus         : ${this.stats.totalMessages}                                  │`);
        console.log(`│ Mises à jour prix      : ${this.stats.priceUpdates}                                  │`);
        console.log(`│ Erreurs                : ${this.stats.errors}                                  │`);
        console.log(`│ Tokens surveillés      : ${TOKENS_TO_WATCH.length}                                  │`);
        console.log(`│ Abonnements actifs     : ${subscriptions.size}                                  │`);
        console.log('└─────────────────────────────────────────────────────────────┘\n');
    }

    /**
     * Nettoyer et fermer
     */
    cleanup() {
        console.log('\n🛑 Arrêt du monitoring...');
        
        this.stopHeartbeat();
        
        if (ws) {
            ws.close();
        }
        
        this.displayStats();
        
        // Sauvegarder l'historique
        if (priceHistory.size > 0) {
            const historyFile = `logs/websocket_history_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            try {
                fs.writeFileSync(historyFile, JSON.stringify(Object.fromEntries(priceHistory), null, 2));
                console.log(`💾 Historique sauvegardé: ${historyFile}`);
            } catch (error) {
                console.error('❌ Erreur sauvegarde:', error.message);
            }
        }
        
        console.log('✅ Nettoyage terminé');
        process.exit(0);
    }
}

// Initialisation
const monitor = new HeliusWebSocketMonitor();

// Gestion des signaux de fermeture
process.on('SIGINT', () => monitor.cleanup());
process.on('SIGTERM', () => monitor.cleanup());

// Affichage périodique des stats
setInterval(() => {
    if (monitor.isConnected) {
        monitor.displayStats();
    }
}, 60000); // Toutes les minutes

// Démarrage
monitor.init().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
}); 