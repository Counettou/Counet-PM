#!/usr/bin/env node

import WebSocket from 'ws';

/**
 * 🔬 SCRIPT DE DEBUG RAW HELIUS WEBSOCKET
 * 
 * Ce script se connecte au WebSocket Helius et affiche TOUT ce qu'on reçoit
 * sans aucun traitement, pour analyser les vraies données.
 */

class HeliusRawDebugger {
    constructor() {
        this.HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
        this.HELIUS_WSS_ENDPOINT = `wss://mainnet.helius-rpc.com/?api-key=${this.HELIUS_API_KEY}`;
        this.HELIUS_HTTP_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${this.HELIUS_API_KEY}`;
        
        this.ws = null;
        this.messageId = 1;
        this.messageCount = 0;
        this.subscriptions = new Map();
        
        console.log('🔬 HELIUS RAW DEBUGGER INITIALISÉ');
        console.log('📊 Objectif: Capturer TOUTES les données brutes du WebSocket');
        console.log('🎯 Token de test: 5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx (BRIX)');
    }

    async start() {
        console.log('\n🚀 DÉMARRAGE DU DEBUGGER RAW');
        console.log('=====================================');
        
        await this.connectWebSocket();
        
        // Attendre la connexion puis s'abonner au token BRIX
        setTimeout(async () => {
            await this.subscribeToToken('5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx');
        }, 2000);
    }

    async connectWebSocket() {
        try {
            console.log(`🔌 Connexion WebSocket: ${this.HELIUS_WSS_ENDPOINT}`);
            
            this.ws = new WebSocket(this.HELIUS_WSS_ENDPOINT);
            
            this.ws.on('open', () => {
                console.log('✅ WebSocket connecté!');
                console.log('⏰ En attente des messages...\n');
            });

            this.ws.on('message', (data) => {
                this.handleRawMessage(data);
            });

            this.ws.on('error', (error) => {
                console.error('❌ Erreur WebSocket:', error);
            });

            this.ws.on('close', () => {
                console.log('⚠️ WebSocket fermé');
            });

        } catch (error) {
            console.error('❌ Erreur connexion:', error);
        }
    }

    handleRawMessage(data) {
        this.messageCount++;
        
        console.log(`\n🔥 MESSAGE RAW #${this.messageCount}`);
        console.log('='.repeat(80));
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
        console.log(`📏 Taille: ${data.length} bytes`);
        console.log('📄 DONNÉES BRUTES:');
        console.log('-'.repeat(40));
        
        try {
            const message = JSON.parse(data.toString());
            console.log(JSON.stringify(message, null, 2));
            
            // Analyser le type de message
            console.log('\n🔍 ANALYSE DU MESSAGE:');
            console.log('-'.repeat(40));
            
            if (message.result && typeof message.result === 'number') {
                console.log(`✅ Type: CONFIRMATION D'ABONNEMENT`);
                console.log(`📝 Subscription ID: ${message.result}`);
                this.subscriptions.set(message.id, message.result);
            } else if (message.method === 'accountNotification') {
                console.log(`📊 Type: NOTIFICATION DE COMPTE`);
                console.log(`🔢 Subscription: ${message.params.subscription}`);
                console.log(`🎯 Slot: ${message.params.result.context.slot}`);
                
                // Analyser les données du compte
                const accountData = message.params.result.value;
                console.log(`💰 Lamports: ${accountData.lamports}`);
                
                if (accountData.data && accountData.data.parsed) {
                    const tokenInfo = accountData.data.parsed.info;
                    console.log(`🪙 Mint: ${tokenInfo.mint}`);
                    console.log(`👤 Owner: ${tokenInfo.owner}`);
                    console.log(`📊 Amount: ${tokenInfo.tokenAmount?.amount} (${tokenInfo.tokenAmount?.uiAmount})`);
                    console.log(`🔢 Decimals: ${tokenInfo.tokenAmount?.decimals}`);
                }
            } else if (message.method === 'programNotification') {
                console.log(`🔧 Type: NOTIFICATION DE PROGRAMME`);
            } else if (message.error) {
                console.log(`❌ Type: ERREUR`);
                console.log(`📋 Erreur: ${JSON.stringify(message.error)}`);
            } else {
                console.log(`❓ Type: INCONNU`);
            }
            
        } catch (error) {
            console.error('❌ Erreur parsing JSON:', error);
            console.log('📄 Données brutes string:', data.toString());
        }
        
        console.log('='.repeat(80));
    }

    async findTokenAccounts(mint) {
        try {
            console.log(`🔍 Recherche des comptes pour le token: ${mint}`);
            
            const response = await fetch(this.HELIUS_HTTP_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: this.messageId++,
                    method: "getProgramAccounts",
                    params: [
                        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                        {
                            encoding: "jsonParsed",
                            filters: [
                                { dataSize: 165 },
                                {
                                    memcmp: {
                                        offset: 0,
                                        bytes: mint
                                    }
                                }
                            ]
                        }
                    ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.result && data.result.length > 0) {
                    const accounts = data.result
                        .map(account => ({
                            pubkey: account.pubkey,
                            amount: account.account.data.parsed.info.tokenAmount.uiAmount || 0
                        }))
                        .sort((a, b) => b.amount - a.amount)
                        .slice(0, 3);
                    
                    console.log(`📋 ${data.result.length} comptes trouvés pour ${mint}`);
                    accounts.forEach((acc, i) => {
                        console.log(`  ${i+1}. ${acc.pubkey} (${acc.amount} tokens)`);
                    });
                    
                    return accounts;
                }
            }
        } catch (error) {
            console.error(`❌ Erreur recherche comptes: ${error.message}`);
        }
        return [];
    }

    async subscribeToToken(mint) {
        console.log(`\n📡 ABONNEMENT AU TOKEN: ${mint}`);
        console.log('=====================================');
        
        // D'abord trouver les comptes
        const accounts = await this.findTokenAccounts(mint);
        
        if (accounts.length === 0) {
            console.log('❌ Aucun compte trouvé');
            return;
        }

        // S'abonner au plus gros compte
        const mainAccount = accounts[0];
        console.log(`🎯 Abonnement au compte principal: ${mainAccount.pubkey}`);
        
        const subscribeMessage = {
            jsonrpc: "2.0",
            id: this.messageId++,
            method: "accountSubscribe",
            params: [
                mainAccount.pubkey,
                {
                    encoding: "jsonParsed",
                    commitment: "confirmed"
                }
            ]
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(subscribeMessage));
            console.log(`✅ Message d'abonnement envoyé`);
            console.log(`📄 Message:`, JSON.stringify(subscribeMessage, null, 2));
        } else {
            console.log('❌ WebSocket pas connecté');
        }
    }

    stop() {
        console.log('\n🛑 ARRÊT DU DEBUGGER');
        console.log(`📊 Total messages reçus: ${this.messageCount}`);
        
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Démarrage du debugger
const heliusDebugger = new HeliusRawDebugger();
await heliusDebugger.start();

// Gestion de l'arrêt
process.on('SIGINT', () => {
    console.log('\n🛑 Signal d\'arrêt reçu...');
    heliusDebugger.stop();
    setTimeout(() => process.exit(0), 1000);
});

console.log('\n💡 Appuyez sur Ctrl+C pour arrêter le debugger'); 