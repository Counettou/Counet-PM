#!/usr/bin/env node

import fetch from 'node-fetch';
import EventEmitter from 'events';

/**
 * 🎯 SERVICE DE PRIX TEMPS RÉEL - GMGN.AI
 * 
 * Service professionnel pour récupérer les prix des tokens Solana
 * via l'API publique GMGN.ai
 * 
 * ✅ Avantages:
 * - API gratuite et publique
 * - Données en temps réel
 * - Prix multiples (1m, 5m, 1h, 6h, 24h)
 * - Données de volume et de swaps
 * - Très rapide et fiable
 */

class GMGNPriceService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            updateInterval: options.updateInterval || 10000, // 10 secondes par défaut
            retryDelay: options.retryDelay || 5000, // 5 secondes de délai entre les retry
            maxRetries: options.maxRetries || 3,
            timeout: options.timeout || 10000, // 10 secondes de timeout
            ...options
        };
        
        this.priceCache = new Map(); // Cache des prix par token
        this.monitoredTokens = new Set(); // Tokens surveillés
        this.intervals = new Map(); // Intervalles de surveillance
        this.isRunning = false;
        
        console.log('🚀 GMGNPriceService initialisé');
    }
    
    /**
     * Récupérer le prix d'un token depuis GMGN
     */
    async fetchTokenPrice(tokenAddress) {
        const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${tokenAddress}`;
        
        let lastError = null;
        
        for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
                
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
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (!data || typeof data.price === 'undefined') {
                    throw new Error('Données de prix invalides ou absentes');
                }
                
                // Formater les données de prix
                const priceData = {
                    address: data.address,
                    symbol: data.symbol,
                    name: data.name,
                    decimals: data.decimals,
                    price: data.price,
                    priceHistory: {
                        '1m': data.price_1m,
                        '5m': data.price_5m,
                        '1h': data.price_1h,
                        '6h': data.price_6h,
                        '24h': data.price_24h
                    },
                    volume24h: data.volume_24h,
                    holderCount: data.holder_count,
                    swaps: {
                        '5m': data.swaps_5m,
                        '1h': data.swaps_1h,
                        '6h': data.swaps_6h,
                        '24h': data.swaps_24h
                    },
                    marketCap: data.market_cap,
                    timestamp: Date.now(),
                    source: 'GMGN'
                };
                
                // Calculer les variations de prix
                if (data.price_1h) {
                    priceData.change1h = ((data.price - data.price_1h) / data.price_1h) * 100;
                }
                if (data.price_24h) {
                    priceData.change24h = ((data.price - data.price_24h) / data.price_24h) * 100;
                }
                
                return priceData;
                
            } catch (error) {
                lastError = error;
                
                if (attempt < this.options.maxRetries) {
                    console.log(`⚠️ Tentative ${attempt}/${this.options.maxRetries} échouée pour ${tokenAddress}: ${error.message}`);
                    await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
                } else {
                    console.error(`❌ Échec final après ${this.options.maxRetries} tentatives pour ${tokenAddress}: ${error.message}`);
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Démarrer la surveillance d'un token
     */
    startMonitoring(tokenAddress, customInterval = null) {
        if (this.intervals.has(tokenAddress)) {
            console.log(`⚠️ Token ${tokenAddress} déjà surveillé`);
            return;
        }
        
        const interval = customInterval || this.options.updateInterval;
        
        console.log(`🔄 Démarrage surveillance: ${tokenAddress} (toutes les ${interval/1000}s)`);
        
        // Première récupération immédiate
        this.updateTokenPrice(tokenAddress);
        
        // Puis programmation périodique
        const intervalId = setInterval(() => {
            this.updateTokenPrice(tokenAddress);
        }, interval);
        
        this.intervals.set(tokenAddress, intervalId);
        this.monitoredTokens.add(tokenAddress);
        this.isRunning = true;
        
        this.emit('monitoringStarted', { tokenAddress, interval });
    }
    
    /**
     * Arrêter la surveillance d'un token
     */
    stopMonitoring(tokenAddress) {
        const intervalId = this.intervals.get(tokenAddress);
        
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(tokenAddress);
            this.monitoredTokens.delete(tokenAddress);
            
            console.log(`🛑 Arrêt surveillance: ${tokenAddress}`);
            this.emit('monitoringStopped', { tokenAddress });
        }
        
        // Arrêter le service si plus aucun token surveillé
        if (this.intervals.size === 0) {
            this.isRunning = false;
        }
    }
    
    /**
     * Arrêter toute surveillance
     */
    stopAllMonitoring() {
        console.log('🛑 Arrêt de toute surveillance...');
        
        for (const tokenAddress of this.monitoredTokens) {
            this.stopMonitoring(tokenAddress);
        }
        
        this.isRunning = false;
        this.emit('allMonitoringStopped');
    }
    
    /**
     * Mettre à jour le prix d'un token
     */
    async updateTokenPrice(tokenAddress) {
        try {
            const priceData = await this.fetchTokenPrice(tokenAddress);
            
            // Comparer avec le prix précédent
            const previousData = this.priceCache.get(tokenAddress);
            let priceChange = null;
            
            if (previousData && previousData.price) {
                priceChange = ((priceData.price - previousData.price) / previousData.price) * 100;
                priceData.realtimeChange = priceChange;
            }
            
            // Mettre à jour le cache
            this.priceCache.set(tokenAddress, priceData);
            
            // Émettre l'événement de mise à jour
            this.emit('priceUpdate', {
                tokenAddress,
                priceData,
                priceChange,
                isNewData: !previousData
            });
            
            // Log de la mise à jour
            const changeStr = priceChange ? ` (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(4)}%)` : '';
            console.log(`💰 ${priceData.symbol}: $${priceData.price.toFixed(8)}${changeStr}`);
            
        } catch (error) {
            this.emit('error', {
                tokenAddress,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Obtenir le prix actuel d'un token depuis le cache
     */
    getPrice(tokenAddress) {
        return this.priceCache.get(tokenAddress);
    }
    
    /**
     * Obtenir tous les prix en cache
     */
    getAllPrices() {
        return Object.fromEntries(this.priceCache);
    }
    
    /**
     * Vérifier si un token est surveillé
     */
    isMonitoring(tokenAddress) {
        return this.monitoredTokens.has(tokenAddress);
    }
    
    /**
     * Obtenir la liste des tokens surveillés
     */
    getMonitoredTokens() {
        return Array.from(this.monitoredTokens);
    }
    
    /**
     * Obtenir les statistiques du service
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            monitoredTokensCount: this.monitoredTokens.size,
            cacheSize: this.priceCache.size,
            monitoredTokens: Array.from(this.monitoredTokens),
            updateInterval: this.options.updateInterval,
            lastUpdate: Math.max(...Array.from(this.priceCache.values()).map(p => p.timestamp))
        };
    }
}

export default GMGNPriceService; 