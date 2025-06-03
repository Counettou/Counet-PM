#!/usr/bin/env node

import fetch from 'node-fetch';

/**
 * 🎯 DONNÉES TEMPS RÉEL - GMGN.AI
 * 
 * Récupération complète des données toutes les 0.6 secondes via GMGN
 * Affichage détaillé de toutes les informations disponibles
 * 
 * ⚠️ LIMITATION API GMGN: 2 requêtes par seconde maximum
 * À 600ms (1.67 req/sec), nous sommes en sécurité par rapport à la limite
 */

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump'; // chat
const UPDATE_INTERVAL = 1000; // 600ms = 0.6 seconde (1.67 req/sec - sécurisé)

let lastPrice = null;
let lastData = null;
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();

console.log('🎯 DONNÉES TEMPS RÉEL - TOKEN CHAT');
console.log('═'.repeat(70));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log(`⏱️ Mise à jour: toutes les ${UPDATE_INTERVAL/1000} seconde(s)`);
console.log(`🔗 Source: GMGN.ai`);
console.log(`✅ Fréquence sécurisée: ${(1000/UPDATE_INTERVAL).toFixed(2)} req/sec`);
console.log('🚀 Démarrage...\n');

/**
 * Récupérer toutes les données depuis GMGN
 */
async function fetchTokenData() {
    try {
        const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': `https://www.gmgn.cc/sol/${TARGET_TOKEN}`,
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
        
        return {
            ...data,
            timestamp: Date.now()
        };
        
    } catch (error) {
        throw new Error(error.message);
    }
}

/**
 * Formater une valeur avec unité appropriée
 */
function formatValue(value, type = 'default') {
    if (value === null || value === undefined) return 'N/A';
    
    switch (type) {
        case 'price':
            return `$${Number(value).toFixed(8)}`;
        case 'marketcap':
        case 'volume':
            if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
            if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
            if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
            return `$${Number(value).toFixed(2)}`;
        case 'percentage':
            return `${Number(value).toFixed(4)}%`;
        case 'number':
            return Number(value).toLocaleString();
        case 'timestamp':
            return new Date(value * 1000).toLocaleString('fr-FR');
        default:
            return String(value);
    }
}

/**
 * Afficher toutes les données avec variations
 */
function displayTokenData(tokenData) {
    updateCount++;
    const time = new Date().toLocaleTimeString('fr-FR', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    
    const price = tokenData.price;
    let changeIcon = '⚪';
    let priceChangeInfo = '';
    
    // Calcul du changement de prix
    if (lastPrice !== null) {
        const change = price - lastPrice;
        const changePercent = ((change / lastPrice) * 100);
        
        if (Math.abs(changePercent) > 0.001) {
            changeIcon = change >= 0 ? '🟢' : '🔴';
            const changeStr = change >= 0 ? `+${change.toFixed(10)}` : change.toFixed(10);
            const percentStr = change >= 0 ? `+${changePercent.toFixed(4)}%` : `${changePercent.toFixed(4)}%`;
            priceChangeInfo = ` (${changeStr} | ${percentStr})`;
        }
    }
    
    // Affichage compact sur une ligne
    console.log(`${changeIcon} [${time}] ${formatValue(price, 'price')}${priceChangeInfo}`);
    
    // Affichage détaillé quand il y a un changement significatif ou toutes les 10 updates
    const shouldShowDetails = (lastData === null) || 
                             (updateCount % 10 === 0) || 
                             (lastPrice && Math.abs((price - lastPrice) / lastPrice) > 0.005); // >0.5% change
    
    if (shouldShowDetails) {
        console.log('┌─────────────────────────────────────────────────────────────────┐');
        console.log('│ 📊 DONNÉES COMPLÈTES                                            │');
        console.log('├─────────────────────────────────────────────────────────────────┤');
        
        // Informations de base
        if (tokenData.symbol) console.log(`│ 🏷️  Symbole: ${tokenData.symbol.padEnd(50)} │`);
        if (tokenData.name) console.log(`│ 📛 Nom: ${tokenData.name.padEnd(54)} │`);
        console.log(`│ 💰 Prix: ${formatValue(price, 'price').padEnd(53)} │`);
        
        // Market data
        if (tokenData.market_cap) console.log(`│ 📈 Market Cap: ${formatValue(tokenData.market_cap, 'marketcap').padEnd(46)} │`);
        if (tokenData.volume_24h) console.log(`│ 📊 Volume 24h: ${formatValue(tokenData.volume_24h, 'volume').padEnd(46)} │`);
        if (tokenData.liquidity) console.log(`│ 💧 Liquidité: ${formatValue(tokenData.liquidity, 'marketcap').padEnd(47)} │`);
        
        // Holder info
        if (tokenData.holder_count) console.log(`│ 👥 Holders: ${formatValue(tokenData.holder_count, 'number').padEnd(49)} │`);
        
        // Price changes
        if (tokenData.price_change_percentage) {
            Object.entries(tokenData.price_change_percentage).forEach(([period, change]) => {
                if (change !== null) {
                    const icon = change >= 0 ? '📈' : '📉';
                    console.log(`│ ${icon} Δ ${period}: ${formatValue(change, 'percentage').padEnd(50)} │`);
                }
            });
        }
        
        // Trading activity
        if (tokenData.swaps_24h) console.log(`│ 🔄 Swaps 24h: ${formatValue(tokenData.swaps_24h, 'number').padEnd(47)} │`);
        if (tokenData.buys_24h) console.log(`│ 🟢 Achats 24h: ${formatValue(tokenData.buys_24h, 'number').padEnd(46)} │`);
        if (tokenData.sells_24h) console.log(`│ 🔴 Ventes 24h: ${formatValue(tokenData.sells_24h, 'number').padEnd(46)} │`);
        
        // Security info
        if (tokenData.is_honeypot !== undefined) {
            const honeypotStatus = tokenData.is_honeypot ? '❌ OUI' : '✅ NON';
            console.log(`│ 🍯 Honeypot: ${honeypotStatus.padEnd(49)} │`);
        }
        if (tokenData.is_verified !== undefined) {
            const verifiedStatus = tokenData.is_verified ? '✅ OUI' : '❌ NON';
            console.log(`│ ✓ Vérifié: ${verifiedStatus.padEnd(51)} │`);
        }
        
        // Timestamps
        if (tokenData.open_timestamp) console.log(`│ 🕐 Création: ${formatValue(tokenData.open_timestamp, 'timestamp').padEnd(48)} │`);
        if (tokenData.pool_creation_timestamp) console.log(`│ 🏊 Pool créé: ${formatValue(tokenData.pool_creation_timestamp, 'timestamp').padEnd(47)} │`);
        
        console.log('└─────────────────────────────────────────────────────────────────┘\n');
    }
    
    lastPrice = price;
    lastData = tokenData;
}

/**
 * Afficher les statistiques périodiques
 */
function showStats() {
    const runTime = Math.floor((Date.now() - startTime) / 1000);
    const successRate = updateCount > 0 ? ((updateCount / (updateCount + errorCount)) * 100).toFixed(1) : '0';
    
    console.log(`\n📊 [Stats] Durée: ${runTime}s | Updates: ${updateCount} | Erreurs: ${errorCount} | Succès: ${successRate}%`);
    if (lastPrice) {
        console.log(`💰 [Prix actuel] ${formatValue(lastPrice, 'price')}`);
    }
    console.log('');
}

/**
 * Boucle principale
 */
async function dataLoop() {
    try {
        const tokenData = await fetchTokenData();
        displayTokenData(tokenData);
        
    } catch (error) {
        errorCount++;
        const time = new Date().toLocaleTimeString('fr-FR', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        console.log(`❌ [${time}] Erreur: ${error.message}`);
    }
}

/**
 * Démarrage
 */
async function start() {
    // Premier appel immédiat
    await dataLoop();
    
    // Puis selon l'intervalle défini
    const interval = setInterval(dataLoop, UPDATE_INTERVAL);
    
    // Stats toutes les 30 secondes
    const statsInterval = setInterval(showStats, 30000);
    
    // Gestion Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n🛑 Arrêt en cours...');
        
        clearInterval(interval);
        clearInterval(statsInterval);
        
        const runTime = Math.floor((Date.now() - startTime) / 1000);
        console.log('\n📊 RÉSUMÉ FINAL:');
        console.log(`  ⏱️ Durée totale: ${runTime} secondes`);
        console.log(`  📈 Mises à jour réussies: ${updateCount}`);
        console.log(`  ❌ Erreurs: ${errorCount}`);
        
        if (updateCount > 0) {
            const successRate = ((updateCount / (updateCount + errorCount)) * 100).toFixed(1);
            console.log(`  ✅ Taux de succès: ${successRate}%`);
            const avgUpdateTime = runTime / updateCount;
            console.log(`  ⚡ Fréquence moyenne: ${avgUpdateTime.toFixed(1)}s par update`);
        }
        
        if (lastPrice) {
            console.log(`  💰 Dernier prix: ${formatValue(lastPrice, 'price')}`);
        }
        
        console.log('\n✅ Monitoring arrêté!');
        process.exit(0);
    });
    
    console.log('💡 Appuyez sur Ctrl+C pour arrêter');
    console.log('📊 Stats automatiques toutes les 30 secondes');
    console.log('📋 Détails complets: changements >0.5% ou toutes les 10 updates\n');
}

// Démarrage
start().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
}); 