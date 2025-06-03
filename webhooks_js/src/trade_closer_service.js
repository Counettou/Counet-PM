/**
 * Service de Fermeture de Trades - COUNET PM
 * 
 * Permet de fermer des positions directement depuis l'interface
 * en convertissant les tokens en SOL via Jupiter API
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import { VersionedTransaction } from '@solana/web3.js';
import { warmedQuotesCache } from './optimized_sell_service.js';

// Cache simple en mémoire pour les soldes
const balanceCache = new Map();
const CACHE_DURATION_MS = 2000; // 2 secondes

// Constantes pour les quotes pré-calculés ("chauds") - cache importé depuis OptimizedSellService
const WARMED_QUOTE_REFRESH_INTERVAL_MS = 10000; // 10 secondes
const WARMED_QUOTE_VALIDITY_MS = 15000; // Un quote chaud est valide 15s
const WARMED_QUOTE_PERCENTAGES = [25, 50, 100]; // Pourcentages à pré-calculer
// Seuil de différence de solde pour invalider un quote chaud (exprimé en pourcentage)
const WARMED_QUOTE_BALANCE_DEVIATION_THRESHOLD_PERCENT = 1;

class TradeCloserService {
    constructor(heliusRpcUrl, positionManager) {
        this.heliusRpcUrl = heliusRpcUrl;
        this.jupiterApiUrl = 'https://quote-api.jup.ag/v6';
        this.positionManager = positionManager;
        this.cache = new Map(); // Cache quotes Jupiter (30s)
        this.isProcessing = new Set(); // Éviter doubles transactions
        
        // Configuration
        this.config = {
            maxPriorityFee: 5000000,      // 0.005 SOL max
            defaultSlippage: 150,         // 1.5%
            quoteCacheTime: 30000,        // 30 secondes
            maxRetries: 3,
            timeoutMs: 15000              // 15 secondes timeout
        };

        // Circuit Breaker Jupiter
        this.jupiterCircuit = {
            isOpen: false,
            failureCount: 0,
            lastFailureTime: null,
            cooldownPeriods: [30000, 60000, 120000, 300000], // 30s, 1m, 2m, 5m
            maxFailures: 3
        };

        // Statistiques
        this.stats = {
            totalCloses: 0,
            successfulCloses: 0,
            failedCloses: 0,
            jupiterErrors: 0,
            heliusErrors: 0,
            avgProcessingTime: 0,
            warmedQuotesCount: 0 // Nouvelle stat
        };
        
        console.log('🔄 TradeCloserService initialisé');
        this.startQuoteWarmer(); // Démarrer le processus de pré-calcul
    }

    /**
     * Obtenir un quote pour fermer une position
     * @param {string} mint - Adresse du token à vendre
     * @param {string} userPublicKey - Clé publique utilisateur
     * @returns {Object} Quote avec détails du swap
     */
    async getCloseQuote(mint, userPublicKey, sellPercentage = 100) {
        const startTime = Date.now();
        
        try {
            // Vérifier circuit breaker Jupiter
            if (this.isJupiterCircuitOpen()) {
                throw new Error('Service Jupiter temporairement indisponible (trop d\'erreurs)');
            }

            // Éviter double processing
            if (this.isProcessing.has(mint)) {
                throw new Error('Position déjà en cours de fermeture');
            }

            // Valider le pourcentage
            if (sellPercentage < 1 || sellPercentage > 100) {
                throw new Error('Pourcentage de vente invalide (1-100%)');
            }

            // Récupérer et valider le solde réel du portefeuille
            const realBalance = await this.validateCloseRequest(mint, userPublicKey);
            
            // Convertir en unités de base (généralement 6 ou 9 décimales selon le token)
            const balanceInBaseUnits = await this.getTokenBalanceInBaseUnits(mint);
            
            // Calculer le montant à vendre selon le pourcentage
            const amountToSell = Math.floor(balanceInBaseUnits.rawAmount * (sellPercentage / 100));
            
            console.log(`📊 Vente ${sellPercentage}% pour ${mint.substring(0, 8)}... (${amountToSell} unités)`);

            // Cache check avec pourcentage
            const cacheKey = `${mint}_${amountToSell}_${sellPercentage}`;
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.config.quoteCacheTime) {
                    console.log(`📋 Quote cache hit pour ${mint.substring(0, 8)}... (${sellPercentage}%)`);
                    return cached.quote;
                }
            }

            // Obtenir quote Jupiter pour le montant partiel
            const quote = await this.getJupiterQuote(mint, amountToSell);
            
            // Cache quote
            this.cache.set(cacheKey, {
                quote,
                timestamp: Date.now()
            });

            // Construire transaction
            const transaction = await this.buildSwapTransaction(quote, userPublicKey);
            
            const processingTime = Date.now() - startTime;
            console.log(`✅ Quote généré pour ${mint.substring(0, 8)}... (${sellPercentage}%) en ${processingTime}ms`);
            
            return {
                quote,
                transaction,
                estimatedSOL: (parseInt(quote.outAmount) / 1e9).toFixed(6),
                estimatedUSD: ((parseInt(quote.outAmount) / 1e9) * 170).toFixed(2), // Approximation SOL price
                slippage: (quote.slippageBps / 100).toFixed(1),
                route: quote.routePlan?.map(step => step.swapInfo?.label).filter(Boolean).join(' → ') || 'Direct',
                priceImpact: quote.priceImpactPct || 'N/A',
                fees: quote.platformFee ? `${(parseInt(quote.platformFee.amount) / 1e9).toFixed(6)} SOL` : '~0.001 SOL',
                tokenAmount: realBalance * (sellPercentage / 100),
                tokenMint: mint,
                sellPercentage: sellPercentage,
                quoteGenerationTime: processingTime
            };

        } catch (error) {
            this.stats.failedCloses++;
            if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                this.handleJupiterFailure('Rate Limit');
            }
            console.error(`❌ Erreur génération quote pour ${mint.substring(0, 8)}... (${sellPercentage}%):`, error.message);
            throw error;
        }
    }

    /**
     * Construire transaction de fermeture
     * @param {Object} quote - Quote Jupiter
     * @param {string} userPublicKey - Clé publique utilisateur
     * @returns {Object} Transaction sérialisée prête pour signature
     */
    async buildCloseTransaction(quote, userPublicKey) {
        try {
            const response = await fetch(`${this.jupiterApiUrl}/swap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteResponse: quote,
                    userPublicKey: userPublicKey,
                    dynamicComputeUnitLimit: true,
                    dynamicSlippage: { maxBps: this.config.defaultSlippage },
                    prioritizationFeeLamports: {
                        priorityLevelWithMaxLamports: {
                            maxLamports: this.config.maxPriorityFee,
                            priorityLevel: "high"
                        }
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Jupiter swap error: ${response.status} - ${errorText}`);
            }

            const { swapTransaction } = await response.json();
            return swapTransaction;

        } catch (error) {
            if (error.message.includes('429')) {
                this.handleJupiterFailure('Swap API Rate Limit');
            }
            throw error;
        }
    }

    /**
     * Exécuter fermeture de position
     * @param {string} mint - Token à fermer
     * @param {string} signedTransaction - Transaction signée (base64)
     * @param {number} sellPercentage - Pourcentage vendu (pour logging)
     * @returns {Object} Résultat de l'exécution avec timing détaillé
     */
    async executeClose(mint, signedTransaction, sellPercentage = 100) {
        const timings = {
            start: Date.now(),
            submitStart: null,
            submitEnd: null,
            confirmationStart: null,
            confirmationEnd: null,
            updateStart: null,
            updateEnd: null,
            total: null
        };
        
        try {
            this.isProcessing.add(mint);
            this.stats.totalCloses++;

            console.log(`🔄 Exécution fermeture ${sellPercentage}% pour ${mint.substring(0, 8)}...`);

            // Soumettre transaction via Helius
            timings.submitStart = Date.now();
            const result = await this.submitTransaction(signedTransaction);
            timings.submitEnd = Date.now();
            
            if (result.error) {
                throw new Error(`Transaction failed: ${result.error.message}`);
            }

            const signature = result.result;
            console.log(`📤 Transaction soumise: ${signature} (${timings.submitEnd - timings.submitStart}ms)`);

            // Attendre confirmation
            timings.confirmationStart = Date.now();
            const confirmation = await this.waitForConfirmation(signature);
            timings.confirmationEnd = Date.now();
            
            if (confirmation.err) {
                throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.err)}`);
            }

            console.log(`⏱️ Confirmation reçue en ${timings.confirmationEnd - timings.confirmationStart}ms`);

            // Mettre à jour position
            timings.updateStart = Date.now();
            await this.updatePositionAfterClose(mint, signature, confirmation);
            timings.updateEnd = Date.now();
            
            // Nettoyer cache
            this.clearCacheForMint(mint);
            
            // Calculer timing total
            timings.total = Date.now() - timings.start;
            
            // Statistiques
            this.stats.successfulCloses++;
            this.updateProcessingTimeStats(timings.total);
            
            console.log(`✅ Position ${mint.substring(0, 8)}... fermée (${sellPercentage}%) avec succès en ${timings.total}ms`);
            
            return {
                success: true,
                signature,
                sellPercentage,
                timings: {
                    total: timings.total,
                    submission: timings.submitEnd - timings.submitStart,
                    confirmation: timings.confirmationEnd - timings.confirmationStart,
                    update: timings.updateEnd - timings.updateStart,
                    breakdown: `Submit: ${timings.submitEnd - timings.submitStart}ms | Confirm: ${timings.confirmationEnd - timings.confirmationStart}ms | Update: ${timings.updateEnd - timings.updateStart}ms`
                },
                explorerUrl: `https://solscan.io/tx/${signature}`
            };

        } catch (error) {
            this.stats.failedCloses++;
            timings.total = Date.now() - timings.start;
            console.error(`❌ Erreur fermeture ${mint.substring(0, 8)}... (${sellPercentage}%):`, error.message);
            
            return {
                success: false,
                error: error.message,
                sellPercentage,
                timings: {
                    total: timings.total,
                    submission: timings.submitEnd ? timings.submitEnd - timings.submitStart : null,
                    confirmation: timings.confirmationEnd ? timings.confirmationEnd - timings.confirmationStart : null,
                    update: timings.updateEnd ? timings.updateEnd - timings.updateStart : null
                }
            };
        } finally {
            this.isProcessing.delete(mint);
        }
    }

    /**
     * Obtenir quote Jupiter pour swap token vers SOL
     */
    async getJupiterQuote(inputMint, amount) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
            const response = await fetch(
                `${this.jupiterApiUrl}/quote?` +
                `inputMint=${inputMint}&` +
                `outputMint=So11111111111111111111111111111111111111112&` + // SOL
                `amount=${Math.floor(amount)}&` +
                `slippageBps=${this.config.defaultSlippage}&` +
                `restrictIntermediateTokens=true`,
                { 
                    signal: controller.signal,
                    headers: { 'User-Agent': 'COUNET-PM/1.0' }
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(`HTTP 429: Too Many Requests`);
                }
                const errorText = await response.text();
                throw new Error(`Jupiter quote error: ${response.status} - ${errorText}`);
            }

            const quote = await response.json();
            
            // Reset circuit breaker on success
            this.resetJupiterCircuitBreaker();
            
            return quote;

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.message.includes('429')) {
                this.handleJupiterFailure('Quote API Rate Limit');
            }
            throw error;
        }
    }

    /**
     * Construire transaction de swap via Jupiter
     */
    async buildSwapTransaction(quote, userPublicKey) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
            const response = await fetch(`${this.jupiterApiUrl}/swap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    quoteResponse: quote,
                    userPublicKey: userPublicKey,
                    dynamicComputeUnitLimit: true,
                    dynamicSlippage: { maxBps: this.config.defaultSlippage },
                    prioritizationFeeLamports: {
                        priorityLevelWithMaxLamports: {
                            maxLamports: this.config.maxPriorityFee,
                            priorityLevel: "high"
                        }
                    }
                })
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(`HTTP 429: Too Many Requests`);
                }
                const errorText = await response.text();
                throw new Error(`Jupiter swap error: ${response.status} - ${errorText}`);
            }

            const { swapTransaction } = await response.json();
            return swapTransaction;

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Soumettre transaction via Helius RPC
     */
    async submitTransaction(signedTransaction) {
        try {
            const response = await fetch(this.heliusRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'sendTransaction',
                    params: [
                        signedTransaction,
                        { 
                            skipPreflight: false,
                            maxRetries: this.config.maxRetries,
                            preflightCommitment: 'confirmed'
                        }
                    ]
                })
            });

            if (!response.ok) {
                this.stats.heliusErrors++;
                throw new Error(`Helius RPC error: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            this.stats.heliusErrors++;
            throw error;
        }
    }

    /**
     * Attendre confirmation de transaction
     */
    async waitForConfirmation(signature, maxAttempts = 30) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await fetch(this.heliusRpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getSignatureStatuses',
                        params: [[signature]]
                    })
                });

                const result = await response.json();
                const status = result.result?.value?.[0];

                if (status) {
                    if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
                        return status;
                    }
                    if (status.err) {
                        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
                    }
                }

                // Attendre avant le prochain check
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                if (attempt === maxAttempts - 1) {
                    throw new Error(`Timeout waiting for confirmation: ${error.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        throw new Error('Transaction confirmation timeout');
    }

    /**
     * Récupérer le solde réel du token depuis le portefeuille
     */
    async getTokenBalance(mint, userPublicKey) {
        console.log(`🔍 Récupération solde réel pour ${mint.substring(0, 8)}... depuis wallet ${userPublicKey.substring(0, 8)}...`);
        
        try {
            const response = await fetch(this.heliusRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTokenAccountsByOwner',
                    params: [
                        userPublicKey,
                        { mint: mint },
                        { encoding: 'jsonParsed' }
                    ]
                })
            });

            const result = await response.json();
            
            if (result.error) {
                throw new Error(`RPC Error: ${result.error.message}`);
            }

            const tokenAccounts = result.result?.value || [];
            
            if (tokenAccounts.length === 0) {
                console.log(`⚠️ Aucun compte token trouvé pour ${mint.substring(0, 8)}...`);
                return 0;
            }

            // Additionner tous les comptes du token (au cas où il y en aurait plusieurs)
            let totalBalance = 0;
            for (const account of tokenAccounts) {
                const balance = account.account.data.parsed.info.tokenAmount.uiAmount || 0;
                totalBalance += balance;
                console.log(`💰 Compte token trouvé: ${balance} tokens`);
            }

            console.log(`✅ Solde total récupéré: ${totalBalance} tokens`);
            return totalBalance;

        } catch (error) {
            console.error(`❌ Erreur récupération solde: ${error.message}`);
            throw error;
        }
    }

    /**
     * Valider demande de fermeture avec solde réel
     */
    async validateCloseRequest(mint, userPublicKey) {
        // Récupérer le solde réel du wallet
        const realBalance = await this.getTokenBalance(mint, userPublicKey);
        
        if (realBalance <= 0) {
            throw new Error(`Aucun token ${mint.substring(0, 8)}... dans votre portefeuille (solde: ${realBalance})`);
        }
        
        console.log(`✅ Validation OK: ${realBalance} tokens disponibles pour la vente`);
        return realBalance;
    }

    /**
     * Mettre à jour position après fermeture
     */
    async updatePositionAfterClose(mint, signature, confirmation) {
        try {
            // Récupérer la transaction pour obtenir les détails exacts
            const txDetails = await this.getTransactionDetails(signature);
            
            // Mettre à jour la position via le PositionManager directement
            if (this.positionManager.positionsData && this.positionManager.positionsData[mint]) {
                const position = this.positionManager.positionsData[mint];
                position.status = 'CLOSED';
                position.closedAt = new Date().toISOString();
                position.closeTransaction = {
                    signature,
                    timestamp: new Date().toISOString(),
                    solReceived: txDetails.solReceived || 0,
                    method: 'Trade Closer Service'
                };
                
                // Calculer P&L final si pas déjà fait
                if (!position.finalPnL && position.totalInvested) {
                    position.finalPnL = (txDetails.solReceived || 0) - position.totalInvested;
                }
                
                // Sauvegarder
                await this.positionManager.savePositions();
                
                console.log(`💾 Position ${mint.substring(0, 8)}... mise à jour et sauvegardée`);
            } else {
                console.log(`⚠️ Position ${mint.substring(0, 8)}... non trouvée dans les données locales pour mise à jour`);
            }
        } catch (error) {
            console.error(`⚠️ Erreur mise à jour position ${mint.substring(0, 8)}...:`, error.message);
        }
    }

    /**
     * Nettoyer cache pour un mint
     */
    clearCacheForMint(mint) {
        // Nettoyer tous les caches liés à ce mint
        for (const [key, value] of this.cache.entries()) {
            if (key.startsWith(mint)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Obtenir statut d'une transaction
     */
    async getTransactionStatus(signature) {
        try {
            const response = await fetch(this.heliusRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTransaction',
                    params: [
                        signature,
                        {
                            encoding: 'json',
                            commitment: 'confirmed',
                            maxSupportedTransactionVersion: 0
                        }
                    ]
                })
            });

            const result = await response.json();
            return result.result;

        } catch (error) {
            console.error('Erreur récupération statut transaction:', error);
            return null;
        }
    }

    async getTransactionDetails(signature) {
        try {
            const txInfo = await this.getTransactionStatus(signature);
            if (!txInfo) return { solReceived: 0 };

            // Analyser les logs pour extraire le SOL reçu
            // Logique simplifiée - à améliorer selon le format des logs Jupiter
            const solReceived = this.extractSolReceivedFromLogs(txInfo.meta?.logMessages || []);
            
            return { solReceived };
        } catch (error) {
            console.error('Erreur analyse transaction:', error);
            return { solReceived: 0 };
        }
    }

    extractSolReceivedFromLogs(logs) {
        // Logique simplifiée pour extraire le SOL reçu des logs
        // À adapter selon le format exact des logs Jupiter
        for (const log of logs) {
            if (log.includes('Swap completed')) {
                // Extraire montant des logs
                const match = log.match(/received (\d+\.?\d*) SOL/);
                if (match) {
                    return parseFloat(match[1]);
                }
            }
        }
        return 0;
    }

    /**
     * Statistiques du service
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalCloses > 0 ? 
                ((this.stats.successfulCloses / this.stats.totalCloses) * 100).toFixed(1) + '%' : '0%',
            jupiterCircuitOpen: this.isJupiterCircuitOpen(),
            cacheSize: this.cache.size,
            processingPositions: this.isProcessing.size,
            warmedQuotesCount: this.stats.warmedQuotesCount
        };
    }

    /**
     * Nettoyer cache expiré
     */
    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.config.quoteCacheTime) {
                this.cache.delete(key);
            }
        }
    }

    // Circuit Breaker Jupiter
    isJupiterCircuitOpen() {
        if (!this.jupiterCircuit.isOpen) return false;
        
        const now = Date.now();
        const cooldownIndex = Math.min(this.jupiterCircuit.failureCount - 1, this.jupiterCircuit.cooldownPeriods.length - 1);
        const cooldownPeriod = this.jupiterCircuit.cooldownPeriods[cooldownIndex];
        
        if (now - this.jupiterCircuit.lastFailureTime > cooldownPeriod) {
            console.log(`🔄 Circuit breaker Jupiter: tentative de récupération après ${cooldownPeriod}ms`);
            this.jupiterCircuit.isOpen = false;
            return false;
        }
        
        return true;
    }

    handleJupiterFailure(reason = 'Unknown') {
        this.stats.jupiterErrors++;
        this.jupiterCircuit.failureCount++;
        this.jupiterCircuit.lastFailureTime = Date.now();
        
        if (this.jupiterCircuit.failureCount >= this.jupiterCircuit.maxFailures) {
            this.jupiterCircuit.isOpen = true;
            const cooldownIndex = Math.min(this.jupiterCircuit.failureCount - 1, this.jupiterCircuit.cooldownPeriods.length - 1);
            const cooldownPeriod = this.jupiterCircuit.cooldownPeriods[cooldownIndex];
            
            console.log(`🚨 Circuit breaker Jupiter OUVERT: ${reason} (cooldown: ${cooldownPeriod}ms)`);
        }
    }

    resetJupiterCircuitBreaker() {
        if (this.jupiterCircuit.failureCount > 0) {
            console.log(`✅ Circuit breaker Jupiter: récupération réussie`);
        }
        this.jupiterCircuit.isOpen = false;
        this.jupiterCircuit.failureCount = 0;
        this.jupiterCircuit.lastFailureTime = null;
    }

    updateProcessingTimeStats(processingTime) {
        if (this.stats.successfulCloses === 1) {
            this.stats.avgProcessingTime = processingTime;
        } else {
            this.stats.avgProcessingTime = 
                (this.stats.avgProcessingTime * (this.stats.successfulCloses - 1) + processingTime) / 
                this.stats.successfulCloses;
        }
    }

    /**
     * Récupère le solde exact d'un token en unités de base
     * @param {string} mint - Adresse du token mint
     * @returns {Object} Informations complètes sur le solde
     */
    async getTokenBalanceInBaseUnits(mint) {
        try {
            // Récupérer la clé privée depuis l'environnement
            const PRIVATE_KEY = process.env.PRIVATE_KEY;
            if (!PRIVATE_KEY) {
                throw new Error('PRIVATE_KEY non trouvée dans les variables d\'environnement');
            }

            // Créer le keypair depuis la clé privée
            const secretKey = bs58.decode(PRIVATE_KEY);
            const keypair = Keypair.fromSecretKey(secretKey);
            const userPublicKey = keypair.publicKey.toString();

            // Vérifier le cache d'abord
            const cacheKey = `${mint}-${userPublicKey}`;
            if (balanceCache.has(cacheKey)) {
                const cachedData = balanceCache.get(cacheKey);
                if (Date.now() - cachedData.timestamp < CACHE_DURATION_MS) {
                    console.log(`💰 Solde récupéré du cache pour ${mint.substring(0, 8)}...`);
                    return cachedData.data;
                } else {
                    balanceCache.delete(cacheKey); // Expiré
                }
            }

            console.log(`🔍 Récupération solde exact pour ${mint.substring(0, 8)}... wallet ${userPublicKey.substring(0, 8)}...`);

            // Utiliser l'API Helius pour obtenir les informations du token account
            const response = await fetch(this.heliusRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'balance-check',
                    method: 'getTokenAccountsByOwner',
                    params: [
                        userPublicKey,
                        { mint: mint },
                        { encoding: 'jsonParsed' }
                    ]
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(`Erreur RPC: ${data.error.message}`);
            }

            const tokenAccounts = data.result?.value || [];
            
            if (tokenAccounts.length === 0) {
                console.log(`⚠️ Aucun token account trouvé pour ${mint}`);
                return {
                    balance: 0,
                    rawAmount: 0,
                    decimals: 0,
                    address: null
                };
            }

            // Prendre le premier token account (normalement il n'y en a qu'un par mint)
            const tokenAccount = tokenAccounts[0];
            const parsedInfo = tokenAccount.account.data.parsed.info;
            
            const rawAmount = parseInt(parsedInfo.tokenAmount.amount);
            const decimals = parsedInfo.tokenAmount.decimals;
            const balance = rawAmount / Math.pow(10, decimals);

            console.log(`💰 Solde trouvé: ${balance} tokens (${rawAmount} unités brutes, ${decimals} décimales)`);

            const resultData = {
                balance: balance,
                rawAmount: rawAmount,
                decimals: decimals,
                address: tokenAccount.pubkey
            };

            // Mettre en cache le résultat
            balanceCache.set(cacheKey, { timestamp: Date.now(), data: resultData });

            return resultData;

        } catch (error) {
            console.error(`❌ Erreur récupération solde:`, error.message);
            throw error;
        }
    }

    /**
     * Obtient un quote optimisé pour la fermeture avec montant exact et slippage dynamique
     * @param {string} mint - Adresse du token mint
     * @param {string} userPublicKey - Clé publique de l'utilisateur
     * @param {string} exactAmount - Montant exact en unités brutes
     * @param {number} decimals - Nombre de décimales du token
     * @param {number} retryAttempt - Numéro de la tentative (pour ajustement des paramètres)
     * @returns {Object} Quote optimisé avec transaction
     */
    async getOptimizedCloseQuote(mint, exactAmount, decimals, retryAttempt = 0) {
        try {
            // Récupérer la clé privée depuis l'environnement
            const PRIVATE_KEY = process.env.PRIVATE_KEY;
            if (!PRIVATE_KEY) {
                throw new Error('PRIVATE_KEY non trouvée dans les variables d\'environnement');
            }

            // Créer le keypair depuis la clé privée
            const secretKey = bs58.decode(PRIVATE_KEY);
            const keypair = Keypair.fromSecretKey(secretKey);
            const userPublicKey = keypair.publicKey.toString();

            console.log(`📋 Quote optimisé ${retryAttempt > 0 ? `(retry ${retryAttempt}) ` : ''}pour ${exactAmount} unités de ${mint.substring(0, 8)}...`);

            // Calcul du slippage dynamique basé sur les retry
            let slippagePercent = 1.5; // Base: 1.5%
            if (retryAttempt > 0) {
                slippagePercent = Math.min(1.5 + (retryAttempt * 0.5), 3.0); // Max 3%
                console.log(`🔄 Slippage augmenté à ${slippagePercent}% pour retry ${retryAttempt}`);
            }

            const slippageBps = Math.floor(slippagePercent * 100); // Convertir en basis points

            const quoteParams = new URLSearchParams({
                inputMint: mint,
                outputMint: 'So11111111111111111111111111111111111111112', // WSOL
                amount: exactAmount.toString(),
                slippageBps: slippageBps.toString(),
                onlyDirectRoutes: 'false',
                asLegacyTransaction: 'false'
            });

            console.log(`📡 Requête Jupiter quote: ${exactAmount} unités, slippage ${slippagePercent}%`);
            
            const response = await fetch(`https://quote-api.jup.ag/v6/quote?${quoteParams}`);

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit Jupiter dépassé');
                } else if (response.status >= 500) {
                    throw new Error('Erreur serveur Jupiter');
                }
                throw new Error(`Erreur HTTP ${response.status}`);
            }

            const quoteData = await response.json();

            if (!quoteData || quoteData.error) {
                throw new Error(quoteData?.error || 'Quote invalide');
            }

            // Calculer les estimations
            const outAmountLamports = parseInt(quoteData.outAmount);
            const estimatedSOL = outAmountLamports / 1e9;
            const estimatedUSD = estimatedSOL * 220; // Prix SOL approximatif

            // Obtenir la transaction de swap
            const swapParams = {
                quoteResponse: quoteData,
                userPublicKey: userPublicKey,
                wrapAndUnwrapSol: true,
                useSharedAccounts: true,
                feeAccount: undefined,
                prioritizationFeeLamports: 500000 // 0.0005 SOL en priorité
            };

            console.log(`🔄 Obtention transaction de swap...`);
            const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(swapParams)
            });

            if (!swapResponse.ok) {
                throw new Error(`Erreur swap: ${swapResponse.status}`);
            }

            const swapData = await swapResponse.json();

            if (!swapData.swapTransaction) {
                throw new Error('Transaction de swap non trouvée');
            }

            const route = this.extractRoute(quoteData);

            return {
                estimatedSOL: estimatedSOL.toFixed(6),
                estimatedUSD: estimatedUSD.toFixed(2),
                slippage: slippagePercent,
                route: route,
                fees: '~0.0005 SOL',
                transaction: swapData.swapTransaction,
                quoteData: quoteData
            };

        } catch (error) {
            console.error(`❌ Erreur quote optimisé:`, error.message);
            throw error;
        }
    }

    /**
     * Exécute une fermeture optimisée avec retry automatique
     * @param {string} mint - Adresse du token mint
     * @param {string} signedTransaction - Transaction signée en base64
     * @param {number} retryAttempt - Numéro de la tentative
     * @param {string} expectedAmount - Montant attendu pour validation
     * @returns {Object} Résultat de l'exécution
     */
    async executeOptimizedClose(mint, signedTransaction, retryAttempt = 0, expectedAmount = null) {
        const startTime = Date.now();
        
        try {
            console.log(`🚀 Exécution optimisée ${retryAttempt > 0 ? `(retry ${retryAttempt}) ` : ''}pour ${mint.substring(0, 8)}...`);
            
            // Validation préliminaire
            if (!signedTransaction || typeof signedTransaction !== 'string') {
                throw new Error('Transaction signée invalide');
            }
            
            // Soumettre la transaction avec paramètres optimisés
            const signature = await this.submitOptimizedTransaction(signedTransaction, retryAttempt);
            
            if (!signature) {
                throw new Error('Échec de soumission de la transaction');
            }
            
            console.log(`📡 Transaction soumise: ${signature}`);
            
            // Attendre la confirmation avec timeout adapté au retry
            const confirmationTimeout = 30 + (retryAttempt * 10); // 30s + 10s par retry
            const confirmation = await this.waitForConfirmation(signature, confirmationTimeout);
            
            if (!confirmation || confirmation.err) {
                throw new Error(`Échec de confirmation: ${JSON.stringify(confirmation?.err || 'unknown')}`);
            }
            
            console.log(`✅ Transaction confirmée: ${signature}`);
            
            // Obtenir les détails de la transaction
            const transactionDetails = await this.getTransactionDetails(signature);
            
            // Extraire le montant SOL reçu des logs
            const solReceived = this.extractSolReceivedFromLogs(transactionDetails?.meta?.logMessages || []);
            
            // Mettre à jour la position après fermeture
            await this.updatePositionAfterClose(mint, signature, confirmation);
            
            // Nettoyer le cache pour ce mint
            this.clearCacheForMint(mint);
            
            const processingTime = Date.now() - startTime;
            this.updateProcessingTimeStats(processingTime);
            
            // URL de l'explorateur
            const explorerUrl = `https://solscan.io/tx/${signature}`;
            
            this.stats.successfulCloses++;
            console.log(`🎉 Fermeture optimisée réussie en ${processingTime}ms: ${solReceived || 'N/A'} SOL reçus`);
            
            return {
                success: true,
                signature: signature,
                explorerUrl: explorerUrl,
                solReceived: solReceived,
                confirmationStatus: 'finalized',
                processingTime: processingTime,
                retryAttempt: retryAttempt,
                blockHeight: confirmation.context?.slot || null,
                transactionDetails: transactionDetails
            };
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            console.error(`❌ Erreur exécution optimisée (${processingTime}ms):`, error.message);
            this.stats.errors++;
            
            return {
                success: false,
                error: error.message,
                processingTime: processingTime,
                retryAttempt: retryAttempt,
                errorType: this.classifyError(error.message)
            };
        }
    }

    /**
     * Soumet une transaction avec paramètres optimisés
     * @param {string} signedTransaction - Transaction signée en base64
     * @param {number} retryAttempt - Numéro de la tentative
     * @returns {string} Signature de la transaction
     */
    async submitOptimizedTransaction(signedTransaction, retryAttempt = 0) {
        try {
            // Décoder et obtenir un blockhash frais
            const transactionBuffer = Buffer.from(signedTransaction, 'base64');
            
            // Paramètres optimisés pour la soumission
            const submitOptions = {
                skipPreflight: false, // Faire la simulation pour éviter les erreurs
                maxRetries: 5 + retryAttempt, // Plus de retries si retry
                preflightCommitment: 'confirmed'
            };
            
            console.log(`📡 Soumission avec options: ${JSON.stringify(submitOptions)}`);
            
            // Soumettre via RPC Helius
            const response = await fetch(this.heliusRpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'sendTransaction',
                    params: [
                        signedTransaction,
                        {
                            encoding: 'base64',
                            ...submitOptions
                        }
                    ]
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(`RPC error: ${result.error.message || JSON.stringify(result.error)}`);
            }
            
            return result.result;
            
        } catch (error) {
            console.error('❌ Erreur soumission optimisée:', error.message);
            throw error;
        }
    }

    /**
     * Extrait la route du quote Jupiter
     * @param {Object} quoteResponse - Réponse du quote Jupiter
     * @returns {string} Description de la route
     */
    extractRoute(quoteResponse) {
        try {
            if (!quoteResponse.routePlan || !Array.isArray(quoteResponse.routePlan)) {
                return 'Direct';
            }
            
            const dexes = quoteResponse.routePlan.map(step => {
                const swapInfo = step.swapInfo;
                if (swapInfo && swapInfo.label) {
                    return swapInfo.label;
                }
                return 'Unknown';
            });
            
            return dexes.length > 0 ? dexes.join(' → ') : 'Direct';
            
        } catch (error) {
            console.error('Erreur extraction route:', error.message);
            return 'Jupiter optimisé';
        }
    }

    /**
     * Classifie le type d'erreur pour un meilleur handling
     * @param {string} errorMessage - Message d'erreur
     * @returns {string} Type d'erreur
     */
    classifyError(errorMessage) {
        const message = errorMessage.toLowerCase();
        
        if (message.includes('block height exceeded') || message.includes('blockhash')) {
            return 'BLOCKHASH_EXPIRED';
        }
        if (message.includes('insufficient lamports') || message.includes('insufficient funds')) {
            return 'INSUFFICIENT_FUNDS';
        }
        if (message.includes('rate limit') || message.includes('429')) {
            return 'RATE_LIMIT';
        }
        if (message.includes('slippage') || message.includes('price impact')) {
            return 'SLIPPAGE_EXCEEDED';
        }
        if (message.includes('simulation failed') || message.includes('preflight')) {
            return 'SIMULATION_FAILED';
        }
        if (message.includes('could not find any route')) {
            return 'NO_ROUTE_FOUND';
        }
        
        return 'UNKNOWN';
    }

    // === NOUVELLE MÉTHODE: Exécution avec signature automatique ===
    async executeOptimizedCloseWithAutoSign(mint, sellPercentage, /* exactAmount, decimals */ retryAttempt = 0) {
        try {
            console.log(`🚀 Début exécution automatique ${retryAttempt > 0 ? `(retry ${retryAttempt}) ` : ''}pour ${mint.substring(0, 8)}... ${sellPercentage}%`);

            const PRIVATE_KEY = process.env.PRIVATE_KEY;
            if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY non trouvée');
            const secretKey = bs58.decode(PRIVATE_KEY);
            const keypair = Keypair.fromSecretKey(secretKey);

            const currentBalanceInfo = await this.getTokenBalanceInBaseUnits(mint);
            if (!currentBalanceInfo || currentBalanceInfo.rawAmount <= 0) {
                return { success: true, message: 'Aucun token à vendre', solReceived: 0, signature: null };
            }

            const amountToSellNow = Math.floor(currentBalanceInfo.rawAmount * (sellPercentage / 100));
            if (amountToSellNow <= 0) {
                 return { success: true, message: 'Montant à vendre nul', solReceived: 0, signature: null };
            }

            let quoteToUse;
            let transactionToSign;
            let estimatedSOLFromQuote = 0;

            const warmedQuoteKey = `${mint}-${sellPercentage}`;
            if (warmedQuotesCache.has(warmedQuoteKey)) {
                const warmedQuote = warmedQuotesCache.get(warmedQuoteKey);
                const amountDeviation = Math.abs(amountToSellNow - warmedQuote.originalRawAmountUsedForQuote) / warmedQuote.originalRawAmountUsedForQuote * 100;
                
                if (Date.now() - warmedQuote.timestamp < WARMED_QUOTE_VALIDITY_MS && 
                    amountDeviation <= WARMED_QUOTE_BALANCE_DEVIATION_THRESHOLD_PERCENT) {
                    console.log(`✅ Utilisation du quote chaud pour ${warmedQuoteKey} (déviation solde: ${amountDeviation.toFixed(2)}%)`);
                    transactionToSign = warmedQuote.swapTransaction;
                    quoteToUse = warmedQuote.quoteData; // Garder le quoteData pour les infos
                    estimatedSOLFromQuote = parseFloat(quoteToUse.outAmount) / Math.pow(10, 9); // Recalculer à partir du quoteData.outAmount
                } else {
                    console.log(`⚠️ Quote chaud pour ${warmedQuoteKey} non pertinent (expiré ou déviation solde: ${amountDeviation.toFixed(2)}%). Recalcul...`);
                }
            }

            if (!transactionToSign) {
                console.log(`🔄 Pas de quote chaud pertinent, calcul à la volée pour ${mint} ${sellPercentage}%...`);
                const liveQuoteResult = await this.getOptimizedCloseQuote(
                    mint, 
                    amountToSellNow, 
                    currentBalanceInfo.decimals, 
                    retryAttempt
                );
                if (!liveQuoteResult || !liveQuoteResult.transaction) {
                    throw new Error('Échec de récupération du quote à la volée');
                }
                transactionToSign = liveQuoteResult.transaction;
                quoteToUse = liveQuoteResult.quoteData;
                estimatedSOLFromQuote = parseFloat(liveQuoteResult.estimatedSOL); 
            }

            const transactionBuffer = Buffer.from(transactionToSign, 'base64');
            const transaction = VersionedTransaction.deserialize(transactionBuffer);
            console.log(`✍️ Signature de la transaction...`);
            transaction.sign([keypair]);
            const serializedTransaction = transaction.serialize();
            const base64Transaction = Buffer.from(serializedTransaction).toString('base64');

            // Soumission ET confirmation
            const submissionResult = await this.executeClose(mint, base64Transaction, sellPercentage); 
            // On réutilise executeClose qui contient déjà la logique de soumission, waitForConfirmation, et updatePosition

            if (submissionResult.success) {
                 return {
                    success: true,
                    message: 'Transaction confirmée',
                    signature: submissionResult.signature,
                    solReceived: submissionResult.solReceived || estimatedSOLFromQuote, // Utiliser le SOL reçu réel si disponible
                    explorerUrl: submissionResult.explorerUrl,
                    timings: submissionResult.timings,
                    retryAttempt: retryAttempt
                };
            } else {
                throw new Error(submissionResult.error || 'Échec de soumission/confirmation de la transaction');
            }

        } catch (error) {
            console.error(`❌ Erreur exécution automatique ${mint} ${sellPercentage}%:`, error.message);
            const errorType = this.classifyError(error.message);
            return {
                success: false,
                error: error.message,
                errorType: errorType,
                retryAttempt: retryAttempt,
                retryRecommended: (errorType === 'BLOCKHASH_EXPIRED' || errorType === 'RATE_LIMIT' || errorType === 'SIMULATION_FAILED') && retryAttempt < (this.config.maxRetries || 3)
            };
        }
    }

    // NOUVELLES MÉTHODES POUR LE QUOTE WARMING
    startQuoteWarmer() {
        console.log('🔥 Démarrage du service de pré-calcul des quotes (Quote Warmer)...');
        // Nettoyer le cache des quotes "chauds" immédiatement, puis toutes les N secondes
        this.cleanWarmedQuotesCache(); 
        setInterval(() => this.cleanWarmedQuotesCache(), WARMED_QUOTE_REFRESH_INTERVAL_MS / 2); 

        // Lancer le premier cycle de pré-calcul
        this.warmUpAllQuotesCycle();

        // Planifier les cycles suivants
        setInterval(() => {
            this.warmUpAllQuotesCycle();
        }, WARMED_QUOTE_REFRESH_INTERVAL_MS);
    }

    cleanWarmedQuotesCache() {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [key, cachedQuote] of warmedQuotesCache.entries()) {
            if (now - cachedQuote.timestamp > WARMED_QUOTE_VALIDITY_MS) {
                warmedQuotesCache.delete(key);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            console.log(`🧹 Nettoyage de ${cleanedCount} quotes chauds expirés.`);
        }
        this.stats.warmedQuotesCount = warmedQuotesCache.size;
    }

    async warmUpAllQuotesCycle() {
        // Logs de cycle supprimés pour réduire la verbosité
        // console.log(`🔥 Cycle de pré-calcul des quotes en cours...`);
        const summary = this.positionManager.getPositionsSummary();
        const openPositions = summary.positions
            .filter(position => position.status === 'OPEN' && position.currentBalance > 0)
            .map(position => position.mint);
            
        if (!openPositions || openPositions.length === 0) {
            // console.log('ℹ️ Aucun token ouvert à pré-calculer.');
            this.stats.warmedQuotesCount = warmedQuotesCache.size;
            return;
        }

        for (const mint of openPositions) {
            try {
                // Récupérer le solde actuel une seule fois pour ce mint
                const balanceInfo = await this.getTokenBalanceInBaseUnits(mint);
                if (!balanceInfo || balanceInfo.rawAmount <= 0) {
                    // console.log(`ℹ️ Aucun solde pour ${mint} lors du pré-calcul.`);
                    continue;
                }

                for (const percentage of WARMED_QUOTE_PERCENTAGES) {
                    const cacheKey = `${mint}-${percentage}`;
                    const amountToSell = Math.floor(balanceInfo.rawAmount * (percentage / 100));

                    if (amountToSell <= 0) continue;

                    // Vérifier si un quote chaud récent et valide existe déjà pour éviter de surcharger Jupiter
                    if (warmedQuotesCache.has(cacheKey)) {
                        const existingWarmedQuote = warmedQuotesCache.get(cacheKey);
                        if (Date.now() - existingWarmedQuote.timestamp < WARMED_QUOTE_REFRESH_INTERVAL_MS / 2) { // Si plus jeune que la moitié de l'intervalle
                            // console.log(`Skipping warm-up for ${cacheKey}, recent quote exists.`);
                            continue;
                        }
                    }

                    console.log(`♨️ Pré-calcul du quote pour ${mint.substring(0,4)}... ${percentage}% (${amountToSell} unités)`);
                    
                    // Note: On utilise getOptimizedCloseQuote ici, mais il faudrait peut-être une version interne 
                    // qui ne fait que le strict minimum pour le warming (quote + transaction)
                    // et qui ne gère pas les retries de la même manière.
                    const quoteResult = await this.getOptimizedCloseQuote(
                        mint,
                        amountToSell, 
                        balanceInfo.decimals,
                        0 // retryAttempt = 0 pour le warming
                    );

                    if (quoteResult && quoteResult.transaction) {
                        warmedQuotesCache.set(cacheKey, {
                            quoteData: quoteResult.quoteData, // La réponse complète de /quote
                            swapTransaction: quoteResult.transaction, // La transaction de /swap
                            timestamp: Date.now(),
                            originalRawAmountUsedForQuote: amountToSell,
                            inputMint: mint,
                            outputMint: 'So11111111111111111111111111111111111111112',
                            percentage: percentage,
                            decimals: balanceInfo.decimals
                        });
                        // console.log(`✅ Quote pré-calculé et stocké pour ${cacheKey}`);
                    } else {
                        // console.log(`⚠️ Échec du pré-calcul pour ${cacheKey}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 500)); // Petit délai pour ne pas spammer Jupiter
                }
            } catch (error) {
                console.error(`❌ Erreur lors du pré-calcul pour ${mint}: ${error.message}`);
            }
        }
        this.stats.warmedQuotesCount = warmedQuotesCache.size;
        // console.log(`🔥 Cycle de pré-calcul terminé. ${warmedQuotesCache.size} quotes chauds disponibles.`);
    }
}

export default TradeCloserService; 