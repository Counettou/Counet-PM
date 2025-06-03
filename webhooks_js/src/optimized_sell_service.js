import bs58 from 'bs58';
import { Keypair, VersionedTransaction } from '@solana/web3.js';

// Cache pour les soldes actuels des tokens
const balanceCache = new Map();
const BALANCE_CACHE_DURATION_MS = 2000; // 2 secondes

// Cache pour les quotes pré-calculés ("chauds") - PARTAGÉ entre services
export const warmedQuotesCache = new Map();
const WARMED_QUOTE_REFRESH_INTERVAL_MS = 10000; // 10 secondes
const WARMED_QUOTE_VALIDITY_MS = 15000; // Un quote chaud est valide 15s
const WARMED_QUOTE_PERCENTAGES = [25, 50, 100]; // Pourcentages à pré-calculer
const WARMED_QUOTE_BALANCE_DEVIATION_THRESHOLD_PERCENT = 1; // 1%

class OptimizedSellService {
    constructor(heliusRpcUrl, positionManager) {
        this.heliusRpcUrl = heliusRpcUrl;
        this.positionManager = positionManager;
        this.isWarming = new Set(); // Éviter les doublons de chauffage
        this.warmingIntervals = new Map(); // Stockage des intervalles par mint
        
        console.log('🚀 OptimizedSellService initialisé');
    }

    /**
     * Démarre le chauffage automatique des quotes pour un token donné
     */
    startWarmingForToken(mint) {
        if (this.warmingIntervals.has(mint)) {
            console.log(`⚡ Chauffage déjà actif pour token ${mint.substring(0, 8)}`);
            return;
        }

        console.log(`🔥 Démarrage du chauffage pour token ${mint.substring(0, 8)}`);
        
        // Chauffage immédiat
        this.warmQuotesForToken(mint);
        
        // Chauffage périodique
        const interval = setInterval(() => {
            this.warmQuotesForToken(mint);
        }, WARMED_QUOTE_REFRESH_INTERVAL_MS);
        
        this.warmingIntervals.set(mint, interval);
    }

    /**
     * Arrête le chauffage pour un token
     */
    stopWarmingForToken(mint) {
        const interval = this.warmingIntervals.get(mint);
        if (interval) {
            clearInterval(interval);
            this.warmingIntervals.delete(mint);
            console.log(`❄️ Chauffage arrêté pour token ${mint.substring(0, 8)}`);
        }
    }

    /**
     * Pré-calcule et met en cache les quotes pour tous les pourcentages d'un token
     */
    async warmQuotesForToken(mint) {
        if (this.isWarming.has(mint)) {
            return; // Éviter les appels concurrents
        }

        this.isWarming.add(mint);
        
        try {
            // Récupérer le solde actuel
            const currentBalance = await this.getTokenBalanceInBaseUnits(mint);
            if (!currentBalance || currentBalance.rawAmount === '0') {
                console.log(`⚠️ Pas de solde pour token ${mint.substring(0, 8)}, arrêt du chauffage`);
                return;
            }

            // Pré-calculer les quotes pour chaque pourcentage
            for (const percentage of WARMED_QUOTE_PERCENTAGES) {
                try {
                    const sellAmount = this.calculateSellAmount(currentBalance.rawAmount, percentage);
                    const quote = await this.getOptimizedCloseQuote(mint, sellAmount);
                    
                    if (quote) {
                        const cacheKey = `${mint}_${percentage}`;
                        warmedQuotesCache.set(cacheKey, {
                            quote,
                            timestamp: Date.now(),
                            originalBalance: currentBalance.rawAmount,
                            percentage,
                            sellAmount
                        });
                        
                        // Logs de chauffage supprimés pour réduire la verbosité
            // console.log(`🔥 Quote ${percentage}% chauffé pour ${mint.substring(0, 8)} (${sellAmount} tokens)`);
                    }
                } catch (error) {
                    console.error(`❌ Erreur chauffage ${percentage}% pour ${mint.substring(0, 8)}:`, error.message);
                }
            }
        } catch (error) {
            console.error(`❌ Erreur générale chauffage pour ${mint.substring(0, 8)}:`, error.message);
        } finally {
            this.isWarming.delete(mint);
        }
    }

    /**
     * Récupère le solde d'un token avec cache intelligent
     */
    async getTokenBalanceInBaseUnits(mint) {
        const cacheKey = `balance_${mint}`;
        const cached = balanceCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_DURATION_MS) {
            return cached.data;
        }

        try {
            const PRIVATE_KEY = process.env.PRIVATE_KEY;
            if (!PRIVATE_KEY) {
                throw new Error('PRIVATE_KEY non trouvée dans les variables d\'environnement');
            }

            const secretKey = bs58.decode(PRIVATE_KEY);
            const keypair = Keypair.fromSecretKey(secretKey);
            const walletAddress = keypair.publicKey.toString();

            const response = await fetch(this.heliusRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'balance-check',
                    method: 'getTokenAccountsByOwner',
                    params: [
                        walletAddress,
                        { mint: mint },
                        { encoding: 'jsonParsed' }
                    ]
                })
            });

            const data = await response.json();
            
            if (data.result && data.result.value.length > 0) {
                const tokenAccount = data.result.value[0];
                const balance = tokenAccount.account.data.parsed.info;
                
                const result = {
                    rawAmount: balance.tokenAmount.amount,
                    uiAmount: balance.tokenAmount.uiAmount,
                    decimals: balance.tokenAmount.decimals
                };
                
                // Mettre en cache
                balanceCache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });
                
                return result;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Erreur récupération solde:', error.message);
            return null;
        }
    }

    /**
     * Calcule le montant à vendre pour un pourcentage donné
     */
    calculateSellAmount(rawAmount, percentage) {
        const sellAmount = Math.floor((parseInt(rawAmount) * percentage) / 100);
        return sellAmount.toString();
    }

    /**
     * Récupère un quote optimisé de Jupiter
     */
    async getOptimizedCloseQuote(inputMint, amount) {
        try {
            const jupiterUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=So11111111111111111111111111111111111111112&amount=${amount}&slippageBps=5000`; // 50% slippage fixe
            
            const response = await fetch(jupiterUrl);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Jupiter API error: ${data.error}`);
            }
            
            return data;
        } catch (error) {
            console.error('❌ Erreur récupération quote Jupiter:', error.message);
            throw error;
        }
    }

    /**
     * Exécute une vente ultra-rapide en utilisant les quotes pré-calculés
     */
    async executeOptimizedSell(mint, percentage) {
        const startTime = Date.now();
        console.log(`⚡ DÉBUT vente optimisée ${percentage}% pour ${mint.substring(0, 8)}`);

        try {
            // ÉTAPE 1: Récupérer le quote chaud (< 10ms)
            const cacheKey = `${mint}_${percentage}`;
            const warmedQuote = warmedQuotesCache.get(cacheKey);
            
            if (!warmedQuote) {
                throw new Error(`Aucun quote chaud disponible pour ${percentage}%`);
            }

            // Vérifier la validité du quote
            const quoteAge = Date.now() - warmedQuote.timestamp;
            if (quoteAge > WARMED_QUOTE_VALIDITY_MS) {
                throw new Error(`Quote trop ancien (${Math.round(quoteAge/1000)}s)`);
            }

            console.log(`✅ Quote chaud récupéré en ${Date.now() - startTime}ms`);

            // ÉTAPE 2: Validation rapide du solde (< 50ms) - optionnelle mais recommandée
            const currentBalance = await this.getTokenBalanceInBaseUnits(mint);
            if (!currentBalance) {
                throw new Error('Impossible de récupérer le solde actuel');
            }

            const balanceDeviation = Math.abs(
                (parseInt(currentBalance.rawAmount) - parseInt(warmedQuote.originalBalance)) / 
                parseInt(warmedQuote.originalBalance) * 100
            );

            if (balanceDeviation > WARMED_QUOTE_BALANCE_DEVIATION_THRESHOLD_PERCENT) {
                console.warn(`⚠️ Solde a changé de ${balanceDeviation.toFixed(2)}%, recalcul du quote...`);
                // Fallback: calcul à la volée
                return await this.executeFallbackSell(mint, percentage);
            }

            console.log(`✅ Solde validé en ${Date.now() - startTime}ms`);

            // ÉTAPE 3: Construction et signature de la transaction
            const swapTransaction = await this.buildSwapTransaction(warmedQuote.quote);
            console.log(`✅ Transaction construite en ${Date.now() - startTime}ms`);

            // ÉTAPE 3b: Signature de la transaction
            const signedTransaction = await this.signTransaction(swapTransaction);
            console.log(`✅ Transaction signée en ${Date.now() - startTime}ms`);

            // ÉTAPE 4: Envoi à la blockchain
            const signature = await this.sendTransaction(signedTransaction);
            console.log(`✅ Transaction envoyée en ${Date.now() - startTime}ms - Signature: ${signature}`);

            // ÉTAPE 5: Confirmation (variable selon congestion)
            const confirmed = await this.waitForConfirmation(signature, 30);
            
            const totalTime = Date.now() - startTime;
            console.log(`🎉 VENTE OPTIMISÉE TERMINÉE en ${totalTime}ms - Statut: ${confirmed ? 'CONFIRMÉ' : 'EN ATTENTE'}`);

            return {
                success: true,
                signature,
                confirmed,
                executionTimeMs: totalTime,
                method: 'OPTIMIZED',
                percentage,
                quoteAge: Math.round(quoteAge/1000)
            };

        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`❌ ÉCHEC vente optimisée en ${totalTime}ms:`, error.message);
            
            // Fallback vers méthode classique
            console.log(`🔄 Tentative fallback vers méthode classique...`);
            return await this.executeFallbackSell(mint, percentage);
        }
    }

    /**
     * Méthode de fallback en cas d'échec de la vente optimisée
     */
    async executeFallbackSell(mint, percentage) {
        const startTime = Date.now();
        console.log(`🔄 FALLBACK: vente classique ${percentage}% pour ${mint.substring(0, 8)}`);

        try {
            const currentBalance = await this.getTokenBalanceInBaseUnits(mint);
            
            // Vérification si le token existe dans le wallet
            if (!currentBalance) {
                throw new Error(`Token ${mint.substring(0, 8)} non trouvé dans le wallet ou solde = 0`);
            }
            
            // Vérification si le solde est suffisant
            if (!currentBalance.rawAmount || parseInt(currentBalance.rawAmount) === 0) {
                throw new Error(`Solde insuffisant pour ${mint.substring(0, 8)}: ${currentBalance.rawAmount}`);
            }
            
            const sellAmount = this.calculateSellAmount(currentBalance.rawAmount, percentage);
            console.log(`💰 Montant à vendre: ${sellAmount} tokens (${percentage}% de ${currentBalance.rawAmount})`);
            
            const quote = await this.getOptimizedCloseQuote(mint, sellAmount);
            const swapTransaction = await this.buildSwapTransaction(quote);
            const signedTransaction = await this.signTransaction(swapTransaction);
            const signature = await this.sendTransaction(signedTransaction);
            const confirmed = await this.waitForConfirmation(signature, 30);
            
            const totalTime = Date.now() - startTime;
            console.log(`✅ FALLBACK TERMINÉ en ${totalTime}ms`);

            return {
                success: true,
                signature,
                confirmed,
                executionTimeMs: totalTime,
                method: 'FALLBACK',
                percentage
            };
        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`❌ ÉCHEC fallback en ${totalTime}ms:`, error.message);
            
            return {
                success: false,
                error: error.message,
                executionTimeMs: totalTime,
                method: 'FALLBACK',
                percentage
            };
        }
    }

    /**
     * Construit la transaction de swap à partir du quote Jupiter
     */
    async buildSwapTransaction(quote) {
        try {
            const response = await fetch('https://quote-api.jup.ag/v6/swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteResponse: quote,
                    userPublicKey: this.getWalletPublicKey(),
                    wrapAndUnwrapSol: true,
                    dynamicComputeUnitLimit: true,
                    prioritizationFeeLamports: 500000  // 0.0005 SOL ultra-agressif
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Erreur construction transaction: ${data.error}`);
            }

            return data.swapTransaction;
        } catch (error) {
            console.error('❌ Erreur construction transaction:', error.message);
            throw error;
        }
    }

    /**
     * Signe la transaction avec la clé privée
     */
    async signTransaction(swapTransaction) {
        try {
            const PRIVATE_KEY = process.env.PRIVATE_KEY;
            if (!PRIVATE_KEY) {
                throw new Error('PRIVATE_KEY non trouvée dans les variables d\'environnement');
            }

            const secretKey = bs58.decode(PRIVATE_KEY);
            const keypair = Keypair.fromSecretKey(secretKey);

            // Désérialiser la transaction
            const transactionBuffer = Buffer.from(swapTransaction, 'base64');
            const transaction = VersionedTransaction.deserialize(transactionBuffer);

            // Signer la transaction
            transaction.sign([keypair]);

            // Sérialiser la transaction signée
            const serializedTransaction = transaction.serialize();
            return Buffer.from(serializedTransaction).toString('base64');
        } catch (error) {
            console.error('❌ Erreur signature transaction:', error.message);
            throw error;
        }
    }

    /**
     * Envoie la transaction à la blockchain
     */
    async sendTransaction(swapTransaction) {
        try {
            const response = await fetch(this.heliusRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'send-transaction',
                    method: 'sendTransaction',
                    params: [
                        swapTransaction, 
                        {
                            encoding: 'base64',
                            skipPreflight: false,
                            maxRetries: 5,
                            preflightCommitment: 'confirmed'
                        }
                    ]
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Erreur envoi transaction: ${data.error.message}`);
            }

            return data.result;
        } catch (error) {
            console.error('❌ Erreur envoi transaction:', error.message);
            throw error;
        }
    }

    /**
     * Attend la confirmation de la transaction (polling optimisé)
     */
    async waitForConfirmation(signature, maxAttempts = 30) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await fetch(this.heliusRpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'get-signature-status',
                        method: 'getSignatureStatuses',
                        params: [[signature], { searchTransactionHistory: true }]
                    })
                });

                const data = await response.json();
                
                if (data.result && data.result.value[0]) {
                    const status = data.result.value[0];
                    if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
                        return true;
                    }
                    if (status.err) {
                        throw new Error(`Transaction échouée: ${JSON.stringify(status.err)}`);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500)); // Polling agressif 500ms
            } catch (error) {
                if (attempt === maxAttempts - 1) {
                    console.error('❌ Timeout confirmation transaction:', error.message);
                    return false;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return false;
    }

    /**
     * Récupère la clé publique du wallet
     */
    getWalletPublicKey() {
        const PRIVATE_KEY = process.env.PRIVATE_KEY;
        const secretKey = bs58.decode(PRIVATE_KEY);
        const keypair = Keypair.fromSecretKey(secretKey);
        return keypair.publicKey.toString();
    }

    /**
     * Démarre le chauffage pour tous les tokens actifs
     */
    startWarmingForAllActiveTokens() {
        const summary = this.positionManager.getPositionsSummary();
        
        // Considérer tous les tokens OPEN comme actifs (règle TP/SL par défaut)
        const activePositions = summary.positions.filter(position => 
            position.status === 'OPEN'
        );
        
        console.log(`🔍 Positions trouvées: ${summary.positions.length} total, ${activePositions.length} OPEN`);
        
        for (const position of activePositions) {
            console.log(`🔥 Démarrage chauffage pour ${position.mint.substring(0, 8)}... (${position.symbol || 'Unknown'})`);
            this.startWarmingForToken(position.mint);
        }
        console.log(`🔥 Chauffage démarré pour ${activePositions.length} tokens actifs`);
    }

    /**
     * Arrête tous les chauffages
     */
    stopAllWarming() {
        for (const [mint, interval] of this.warmingIntervals) {
            clearInterval(interval);
        }
        this.warmingIntervals.clear();
        warmedQuotesCache.clear();
        console.log('❄️ Tous les chauffages arrêtés');
    }

    /**
     * Statistiques du service
     */
    getStats() {
        return {
            activeWarmings: this.warmingIntervals.size,
            cachedQuotes: warmedQuotesCache.size,
            cachedBalances: balanceCache.size,
            isWarmingTokens: Array.from(this.isWarming)
        };
    }
}

export default OptimizedSellService; 