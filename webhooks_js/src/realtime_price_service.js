#!/usr/bin/env node
import { EventEmitter } from 'events';
import fetch from 'node-fetch';

/**
 * 🎯 SERVICE DE PRIX TEMPS RÉEL - GMGN.AI
 * 
 * Service remplaçant Helius WebSocket par GMGN.ai API polling 1s
 * Récupération exhaustive des données toutes les secondes
 * DexScreener en fallback + compatibilité complète
 */
class RealtimePriceService extends EventEmitter {
    constructor() {
        super();
        
        // Configuration GMGN
        this.UPDATE_INTERVAL = 1000; // 1 seconde pour temps réel
        this.trackedTokens = new Set();
        this.tokenIntervals = new Map(); // Intervalles par token
        this.prices = new Map(); // Cache des prix
        this.lastPrices = new Map(); // Prix précédents pour calcul variations
        this.isRunning = false;
        this.lastUpdateTime = null;
        this.errorCount = 0;
        this.maxErrors = 5;
        this.currentActiveSource = 'gmgn';
        
        // Configuration avec DexScreener fallback
        this.apiConfig = {
            primary: 'gmgn',
            fallback: 'dexscreener',
            dexscreenerUrl: 'https://api.dexscreener.com/latest/dex/tokens'
        };
        
        // Statistiques
        this.stats = {
            gmgnUpdates: 0,
            gmgnErrors: 0,
            dexscreenerSuccess: 0,
            dexscreenerErrors: 0,
            totalRequests: 0,
            avgLatency: 0,
            updateCount: 0,
            uptime: Date.now()
        };
        
        console.log('🎯 SERVICE GMGN TEMPS RÉEL initialisé');
        console.log('📊 Source primaire: GMGN.AI (1s polling)');
        console.log('🔄 Fallback: DEXSCREENER');
        console.log('⚡ Fréquence: 1 seconde par token');
    }

    /**
     * Récupérer les données d'un token depuis GMGN (logique de save_gmgn.js)
     */
    async fetchTokenDataFromGMGN(tokenAddress) {
        try {
            const startTime = Date.now();
            const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${tokenAddress}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': `https://www.gmgn.cc/sol/${tokenAddress}`,
                    'Origin': 'https://www.gmgn.cc'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data || typeof data.price === 'undefined') {
                throw new Error('Données non disponibles');
            }
            
            const latency = Date.now() - startTime;
            
            // Format complet des données GMGN
            const tokenData = {
                // Données de base
                mint: tokenAddress,
                address: data.address,
                symbol: data.symbol,
                name: data.name,
                decimals: data.decimals,
                price: data.price,
                
                // Prix historiques
                price_1m: data.price_1m,
                price_5m: data.price_5m,
                price_1h: data.price_1h,
                price_6h: data.price_6h,
                price_24h: data.price_24h,
                
                // Market data
                market_cap: data.market_cap,
                volume_24h: data.volume_24h,
                liquidity: data.liquidity,
                fdv: data.fdv,
                
                // Holders et supply
                holder_count: data.holder_count,
                max_supply: data.max_supply,
                total_supply: data.total_supply,
                
                // Trading activity
                swaps_1m: data.swaps_1m,
                swaps_5m: data.swaps_5m,
                swaps_1h: data.swaps_1h,
                swaps_6h: data.swaps_6h,
                swaps_24h: data.swaps_24h,
                
                buys_1m: data.buys_1m,
                buys_5m: data.buys_5m,
                buys_1h: data.buys_1h,
                buys_6h: data.buys_6h,
                buys_24h: data.buys_24h,
                
                sells_1m: data.sells_1m,
                sells_5m: data.sells_5m,
                sells_1h: data.sells_1h,
                sells_6h: data.sells_6h,
                sells_24h: data.sells_24h,
                
                // Volumes détaillés
                volume_1m: data.volume_1m,
                volume_5m: data.volume_5m,
                volume_1h: data.volume_1h,
                volume_6h: data.volume_6h,
                
                buy_volume_1m: data.buy_volume_1m,
                buy_volume_5m: data.buy_volume_5m,
                buy_volume_1h: data.buy_volume_1h,
                buy_volume_6h: data.buy_volume_6h,
                buy_volume_24h: data.buy_volume_24h,
                
                sell_volume_1m: data.sell_volume_1m,
                sell_volume_5m: data.sell_volume_5m,
                sell_volume_1h: data.sell_volume_1h,
                sell_volume_6h: data.sell_volume_6h,
                sell_volume_24h: data.sell_volume_24h,
                
                net_in_volume_1m: data.net_in_volume_1m,
                net_in_volume_5m: data.net_in_volume_5m,
                net_in_volume_1h: data.net_in_volume_1h,
                net_in_volume_6h: data.net_in_volume_6h,
                net_in_volume_24h: data.net_in_volume_24h,
                
                // Données techniques
                biggest_pool_address: data.biggest_pool_address,
                chain: data.chain,
                creation_timestamp: data.creation_timestamp,
                
                // Métadonnées
                source: 'GMGN',
                timestamp: Date.now(),
                latency: latency
            };
            
            // Calculer les variations de prix
            const lastPrice = this.lastPrices.get(tokenAddress);
            if (lastPrice !== null && lastPrice !== undefined) {
                const change = data.price - lastPrice;
                const changePercent = ((change / lastPrice) * 100);
                tokenData.priceChange = change;
                tokenData.priceChangePercent = changePercent;
            }
            
            return tokenData;
            
        } catch (error) {
            throw new Error(`GMGN Error: ${error.message}`);
        }
    }

    /**
     * Récupérer le prix via DexScreener (fallback)
     */
    async fetchPriceFromDexScreener(tokenAddress) {
        try {
            const startTime = Date.now();
            const response = await fetch(`${this.apiConfig.dexscreenerUrl}/${tokenAddress}`);
            const latency = Date.now() - startTime;
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.pairs && data.pairs.length > 0) {
                const pair = data.pairs[0];
                const price = parseFloat(pair.priceUsd);
                
                if (price && price > 0) {
                    return {
                        mint: tokenAddress,
                        symbol: pair.baseToken?.symbol || 'Unknown',
                        name: pair.baseToken?.name || 'Unknown',
                        price: price,
                        source: 'DEXSCREENER',
                        timestamp: Date.now(),
                        latency: latency,
                        dexId: pair.dexId,
                        pairAddress: pair.pairAddress,
                        liquidity: pair.liquidity?.usd || 0,
                        volume_24h: pair.volume?.h24 || 0,
                        priceChange24h: pair.priceChange?.h24 || 0
                    };
                }
            }
            
            throw new Error('Prix non trouvé dans DexScreener');
            
        } catch (error) {
            throw new Error(`DexScreener Error: ${error.message}`);
        }
    }

    /**
     * Récupérer les données d'un token avec fallback automatique
     */
    async fetchTokenData(tokenAddress) {
        this.stats.totalRequests++;
        
        try {
            // Essayer GMGN d'abord
            const tokenData = await this.fetchTokenDataFromGMGN(tokenAddress);
            this.stats.gmgnUpdates++;
            this.logSourceChange('gmgn');
            return tokenData;
            
        } catch (gmgnError) {
            this.stats.gmgnErrors++;
            
            try {
                // Fallback vers DexScreener
                const tokenData = await this.fetchPriceFromDexScreener(tokenAddress);
                this.stats.dexscreenerSuccess++;
                this.logSourceChange('dexscreener');
                return tokenData;
                
            } catch (dexError) {
                this.stats.dexscreenerErrors++;
                console.error(`❌ Échec récupération ${tokenAddress.substring(0,8)}: GMGN(${gmgnError.message}) + DexScreener(${dexError.message})`);
                return null;
            }
        }
    }

    /**
     * Boucle de monitoring pour un token spécifique
     */
    startTokenMonitoring(tokenAddress) {
        if (this.tokenIntervals.has(tokenAddress)) {
            console.log(`⚠️ Token ${tokenAddress.substring(0,8)} déjà surveillé`);
            return;
        }
        
        console.log(`🎯 Démarrage monitoring GMGN: ${tokenAddress.substring(0,8)} (1s)`);
        
        // Premier appel immédiat
        this.updateTokenPrice(tokenAddress);
        
        // Puis toutes les secondes
        const interval = setInterval(() => {
            this.updateTokenPrice(tokenAddress);
        }, this.UPDATE_INTERVAL);
        
        this.tokenIntervals.set(tokenAddress, interval);
    }

    /**
     * Arrêter le monitoring d'un token
     */
    stopTokenMonitoring(tokenAddress) {
        const interval = this.tokenIntervals.get(tokenAddress);
        if (interval) {
            clearInterval(interval);
            this.tokenIntervals.delete(tokenAddress);
            console.log(`🛑 Arrêt monitoring: ${tokenAddress.substring(0,8)}`);
        }
    }

    /**
     * Mettre à jour le prix d'un token
     */
    async updateTokenPrice(tokenAddress) {
        try {
            const tokenData = await this.fetchTokenData(tokenAddress);
            
            if (tokenData) {
                // Sauvegarder le prix précédent pour calcul variations
                if (this.prices.has(tokenAddress)) {
                    this.lastPrices.set(tokenAddress, this.prices.get(tokenAddress).price);
                }
                
                // Mettre à jour le cache
                this.prices.set(tokenAddress, tokenData);
                this.lastUpdateTime = Date.now();
                this.stats.updateCount++;
                
                // Émettre l'événement pour les clients WebSocket
                this.emit('priceUpdate', tokenData);
                
                // Log compact avec variations
                this.logPriceUpdate(tokenData);
            }
            
        } catch (error) {
            this.errorCount++;
            console.error(`❌ Erreur update ${tokenAddress.substring(0,8)}: ${error.message}`);
        }
    }

    /**
     * Logger les mises à jour de prix de façon compacte
     */
    logPriceUpdate(tokenData) {
        const time = new Date().toLocaleTimeString('fr-FR', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        let changeIcon = '⚪';
        let changeInfo = '';
        
        if (tokenData.priceChangePercent !== undefined) {
            if (Math.abs(tokenData.priceChangePercent) > 0.01) {
                changeIcon = tokenData.priceChangePercent >= 0 ? '🟢' : '🔴';
                changeInfo = ` (${tokenData.priceChangePercent >= 0 ? '+' : ''}${tokenData.priceChangePercent.toFixed(4)}%)`;
            }
        }
        
        const symbol = tokenData.symbol || tokenData.mint.substring(0,8);
        console.log(`${changeIcon} [${time}] ${symbol}: $${tokenData.price.toFixed(8)}${changeInfo} [${tokenData.source}]`);
    }

    /**
     * Logger un changement de source
     */
    logSourceChange(source) {
        if (this.currentActiveSource !== source) {
            this.currentActiveSource = source;
            const now = new Date();
            const time = now.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            console.log(`📊 Source Prix : ${source.toUpperCase()} - ${time}`);
        }
    }

    /**
     * Ajouter un token à suivre
     */
    async addToken(mint) {
        if (!mint || mint === 'So11111111111111111111111111111111111111112') {
            return; // Ignorer SOL
        }
        
        const wasEmpty = this.trackedTokens.size === 0;
        
        if (!this.trackedTokens.has(mint)) {
            this.trackedTokens.add(mint);
            
            console.log(`📊 Token ajouté au suivi GMGN: ${mint.substring(0, 8)}...`);
        console.log(`📈 Total tokens suivis: ${this.trackedTokens.size}`);
            
            // Démarrer le monitoring pour ce token
            this.startTokenMonitoring(mint);
        
        // Démarrer le service si c'est le premier token
        if (wasEmpty && !this.isRunning) {
            await this.start();
        }
        }
    }

    /**
     * Retirer un token du suivi
     */
    removeToken(mint) {
        if (this.trackedTokens.has(mint)) {
        this.trackedTokens.delete(mint);
        this.prices.delete(mint);
            this.lastPrices.delete(mint);
            this.stopTokenMonitoring(mint);
        
        console.log(`📉 Token retiré du suivi: ${mint.substring(0, 8)}...`);
        console.log(`📈 Total tokens suivis: ${this.trackedTokens.size}`);
        
        // Arrêter le service si plus de tokens
        if (this.trackedTokens.size === 0 && this.isRunning) {
            this.stop();
            }
        }
    }

    /**
     * Mettre à jour la liste des tokens à suivre
     */
    async updateTrackedTokens(openPositions) {
        const newTokens = new Set();
        
        // Ajouter tous les tokens des positions ouvertes
        openPositions.forEach(position => {
            if (position.status === 'OPEN' && position.mint) {
                newTokens.add(position.mint);
            }
        });
        
        // Retirer les tokens qui ne sont plus ouverts
        for (const mint of this.trackedTokens) {
            if (!newTokens.has(mint)) {
                this.removeToken(mint);
            }
        }
        
        // Ajouter les nouveaux tokens
        for (const mint of newTokens) {
            if (!this.trackedTokens.has(mint)) {
                await this.addToken(mint);
            }
        }
        
        console.log(`📊 Tokens GMGN actifs: ${this.trackedTokens.size}`);
    }

    /**
     * Obtenir le prix actuel d'un token
     */
    getCurrentPrice(mint) {
        const priceData = this.prices.get(mint);
        if (!priceData) {
            return null;
        }
        
        // Vérifier si le prix n'est pas trop ancien (5s max pour GMGN)
        const age = Date.now() - priceData.timestamp;
        if (age > 5000) {
            console.warn(`⚠️ Prix ancien pour ${mint.substring(0, 8)}...: ${age/1000}s`);
            return null;
        }
        
        return priceData;
    }

    /**
     * Obtenir tous les prix actuels
     */
    getAllCurrentPrices() {
        const currentPrices = new Map();
        
        for (const [mint, priceData] of this.prices.entries()) {
            const age = Date.now() - priceData.timestamp;
            if (age <= 5000) { // Prix valides (< 5s)
                currentPrices.set(mint, priceData);
            }
        }
        
        return currentPrices;
    }

    /**
     * Démarrer le service
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Service GMGN déjà démarré');
            return;
        }
        
        console.log(`🚀 Service GMGN temps réel démarré`);
        console.log(`📊 Tokens à surveiller: ${this.trackedTokens.size}`);
        
        this.isRunning = true;
        this.errorCount = 0;
        this.stats.uptime = Date.now();
        
        // Émettre l'événement de démarrage
        this.emit('serviceStarted', {
            tokensCount: this.trackedTokens.size,
            source: 'gmgn'
        });
    }

    /**
     * Arrêter le service
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        console.log('🛑 Arrêt service GMGN temps réel');
        
        this.isRunning = false;
        
        // Arrêter tous les intervalles
        for (const [tokenAddress, interval] of this.tokenIntervals) {
            clearInterval(interval);
        }
        this.tokenIntervals.clear();
        
        console.log('✅ Service GMGN arrêté');
    }

    /**
     * Obtenir les statistiques du service
     */
    getStats() {
        const uptime = Math.floor((Date.now() - this.stats.uptime) / 1000);
        const successRate = this.stats.totalRequests > 0 ? 
            ((this.stats.gmgnUpdates + this.stats.dexscreenerSuccess) / this.stats.totalRequests * 100).toFixed(1) : '0';
        
        return {
            isRunning: this.isRunning,
            trackedTokens: this.trackedTokens.size,
            updateInterval: `${this.UPDATE_INTERVAL/1000}s`,
            primaryAPI: this.apiConfig.primary.toUpperCase(),
            fallbackAPI: this.apiConfig.fallback.toUpperCase(),
            uptime: `${uptime}s`,
            stats: {
                gmgnUpdates: this.stats.gmgnUpdates,
                gmgnErrors: this.stats.gmgnErrors,
                dexscreenerSuccess: this.stats.dexscreenerSuccess,
                dexscreenerErrors: this.stats.dexscreenerErrors,
                totalRequests: this.stats.totalRequests,
                updateCount: this.stats.updateCount,
                successRate: successRate + '%',
                avgLatency: Math.round(this.stats.avgLatency) + 'ms'
            },
            lastUpdate: this.lastUpdateTime ? new Date(this.lastUpdateTime).toLocaleTimeString() : 'Jamais'
        };
    }
}

export default RealtimePriceService; 