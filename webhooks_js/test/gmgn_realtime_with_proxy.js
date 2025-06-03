#!/usr/bin/env node

import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 🎯 DONNÉES TEMPS RÉEL AVEC PROXIES IPROYAL - GMGN.AI
 * 
 * Version améliorée du script qui fonctionne avec rotation de proxies IPRoyal
 * Basé sur la solution simple qui contourne déjà Cloudflare avec succès
 * 
 * ⚡ AMÉLIORATION: Ajout de la rotation des IP pour éviter les limitations
 * 🌐 PROXY: IPRoyal Résidentiel avec rotation automatique
 */

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump'; // chat
const UPDATE_INTERVAL = 1000; // 1000ms = 1 seconde

// ⭐ Configuration IPRoyal avec rotation d'IP
const IPROYAL_CONFIG = {
    hostname: 'geo.iproyal.com',
    port: '12321',
    username: 'j686absSWTWSkmcj',
    password: 'kjXBVH6xcLmWKew5'
};

// 🔄 Pays pour rotation automatique (IPRoyal)
const COUNTRIES = ['US', 'CA', 'GB', 'DE', 'FR', 'NL', 'AU', 'SE', 'NO', 'DK'];
let currentCountryIndex = 0;

// Variables de suivi
let lastPrice = null;
let lastData = null;
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();
let currentProxy = null;

console.log('🎯 DONNÉES TEMPS RÉEL AVEC PROXIES IPROYAL - TOKEN CHAT');
console.log('═'.repeat(75));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log(`⏱️ Mise à jour: toutes les ${UPDATE_INTERVAL/1000} seconde(s)`);
console.log(`🔗 Source: GMGN.ai (méthode qui fonctionne)`);
console.log(`🌐 Proxy: IPRoyal Résidentiel avec rotation IP`);
console.log(`✅ Fréquence sécurisée: ${(1000/UPDATE_INTERVAL).toFixed(2)} req/sec`);
console.log('🚀 Démarrage...\n');

/**
 * 🌐 Obtenir le prochain proxy avec rotation de pays
 */
function getNextProxy() {
    const country = COUNTRIES[currentCountryIndex];
    currentCountryIndex = (currentCountryIndex + 1) % COUNTRIES.length;
    
    // ✅ FORMAT CORRECT IPRoyal : pays dans le password, pas dans le username
    const username = IPROYAL_CONFIG.username;
    const password = `${IPROYAL_CONFIG.password}_country-${country.toLowerCase()}`;
    const proxyUrl = `http://${username}:${password}@${IPROYAL_CONFIG.hostname}:${IPROYAL_CONFIG.port}`;
    
    currentProxy = {
        url: proxyUrl,
        country: country,
        agent: new HttpsProxyAgent(proxyUrl)
    };
    
    return currentProxy;
}

/**
 * 📡 Récupérer toutes les données depuis GMGN avec proxy IPRoyal
 * (Méthode directe qui fonctionne, basée sur save_gmgn.js + proxies)
 */
async function fetchTokenData() {
    try {
        const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;
        
        // Obtenir le prochain proxy
        const proxy = getNextProxy();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout avec proxy
        
        const response = await fetch(url, {
            signal: controller.signal,
            agent: proxy.agent, // 🌐 Utilisation du proxy IPRoyal
            headers: {
                // ✅ Headers identiques à save_gmgn.js qui fonctionne
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': `https://www.gmgn.cc/sol/${TARGET_TOKEN}`,
                'Origin': 'https://www.gmgn.cc'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} via ${proxy.country}`);
        }
        
        const data = await response.json();
        
        if (!data || typeof data.price === 'undefined') {
            throw new Error(`Données non disponibles via ${proxy.country}`);
        }
        
        return {
            ...data,
            timestamp: Date.now(),
            proxyUsed: `IPRoyal-${proxy.country}`,
            proxyUrl: proxy.url.replace(IPROYAL_CONFIG.password, '***') // Masquer le mot de passe
        };
        
    } catch (error) {
        throw new Error(`${error.message} [Proxy: ${currentProxy?.country || 'N/A'}]`);
    }
}

/**
 * 💰 Formater une valeur avec unité appropriée
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
 * 📊 Afficher toutes les données avec informations proxy
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
    
    // Affichage compact avec info proxy
    console.log(`${changeIcon} [${time}] ${formatValue(price, 'price')}${priceChangeInfo} [${tokenData.proxyUsed}]`);
    
    // Affichage détaillé quand il y a un changement significatif ou toutes les 10 updates
    const shouldShowDetails = (lastData === null) || 
                             (updateCount % 10 === 0) || 
                             (lastPrice && Math.abs((price - lastPrice) / lastPrice) > 0.005); // >0.5% change
    
    if (shouldShowDetails) {
        console.log('┌───────────────────────────────────────────────────────────────────────────┐');
        console.log('│ 📊 DONNÉES COMPLÈTES (via IPRoyal)                                        │');
        console.log('├───────────────────────────────────────────────────────────────────────────┤');
        
        // Informations de base
        if (tokenData.symbol) console.log(`│ 🏷️  Symbole: ${tokenData.symbol.padEnd(66)} │`);
        if (tokenData.name) console.log(`│ 📛 Nom: ${tokenData.name.padEnd(70)} │`);
        console.log(`│ 💰 Prix: ${formatValue(price, 'price').padEnd(69)} │`);
        
        // Market data
        if (tokenData.market_cap) console.log(`│ 📈 Market Cap: ${formatValue(tokenData.market_cap, 'marketcap').padEnd(62)} │`);
        if (tokenData.volume_24h) console.log(`│ 📊 Volume 24h: ${formatValue(tokenData.volume_24h, 'volume').padEnd(62)} │`);
        if (tokenData.liquidity) console.log(`│ 💧 Liquidité: ${formatValue(tokenData.liquidity, 'marketcap').padEnd(63)} │`);
        
        // Holder info
        if (tokenData.holder_count) console.log(`│ 👥 Holders: ${formatValue(tokenData.holder_count, 'number').padEnd(65)} │`);
        
        // Price changes
        if (tokenData.price_change_percentage) {
            Object.entries(tokenData.price_change_percentage).forEach(([period, change]) => {
                if (change !== null) {
                    const icon = change >= 0 ? '📈' : '📉';
                    console.log(`│ ${icon} Δ ${period}: ${formatValue(change, 'percentage').padEnd(66)} │`);
                }
            });
        }
        
        // Trading activity
        if (tokenData.swaps_24h) console.log(`│ 🔄 Swaps 24h: ${formatValue(tokenData.swaps_24h, 'number').padEnd(63)} │`);
        if (tokenData.buys_24h) console.log(`│ 🟢 Achats 24h: ${formatValue(tokenData.buys_24h, 'number').padEnd(62)} │`);
        if (tokenData.sells_24h) console.log(`│ 🔴 Ventes 24h: ${formatValue(tokenData.sells_24h, 'number').padEnd(62)} │`);
        
        // Security info
        if (tokenData.is_honeypot !== undefined) {
            const honeypotStatus = tokenData.is_honeypot ? '❌ OUI' : '✅ NON';
            console.log(`│ 🍯 Honeypot: ${honeypotStatus.padEnd(65)} │`);
        }
        if (tokenData.is_verified !== undefined) {
            const verifiedStatus = tokenData.is_verified ? '✅ OUI' : '❌ NON';
            console.log(`│ ✓ Vérifié: ${verifiedStatus.padEnd(67)} │`);
        }
        
        // Timestamps
        if (tokenData.open_timestamp) console.log(`│ 🕐 Création: ${formatValue(tokenData.open_timestamp, 'timestamp').padEnd(64)} │`);
        if (tokenData.pool_creation_timestamp) console.log(`│ 🏊 Pool créé: ${formatValue(tokenData.pool_creation_timestamp, 'timestamp').padEnd(63)} │`);
        
        // Proxy info
        console.log(`│ 🌐 Proxy actuel: ${tokenData.proxyUsed.padEnd(60)} │`);
        console.log(`│ 🔄 Rotation automatique: ${COUNTRIES.length} pays disponibles${' '.padEnd(35)} │`);
        
        console.log('└───────────────────────────────────────────────────────────────────────────┘\n');
    }
    
    lastPrice = price;
    lastData = tokenData;
}

/**
 * 📊 Afficher les statistiques périodiques avec info proxies
 */
function showStats() {
    const runTime = Math.floor((Date.now() - startTime) / 1000);
    const successRate = updateCount > 0 ? ((updateCount / (updateCount + errorCount)) * 100).toFixed(1) : '0';
    const avgReqPerSec = updateCount > 0 ? (updateCount / runTime).toFixed(2) : '0';
    
    console.log(`\n📊 [Stats IPRoyal] Durée: ${runTime}s | Updates: ${updateCount} | Erreurs: ${errorCount} | Succès: ${successRate}%`);
    console.log(`⚡ [Performance] Vitesse: ${avgReqPerSec} req/sec | Proxy actuel: ${currentProxy?.country || 'N/A'}`);
    console.log(`🌐 [Rotation] ${COUNTRIES.length} pays disponibles: ${COUNTRIES.join(', ')}`);
    if (lastPrice) {
        console.log(`💰 [Prix actuel] ${formatValue(lastPrice, 'price')}`);
    }
    console.log('');
}

/**
 * 🔄 Boucle principale avec gestion d'erreurs et rotation automatique
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
        console.log(`❌ [${time}] ${error.message}`);
        
        // Si trop d'erreurs consécutives, pause plus longue
        if (errorCount > 0 && errorCount % 5 === 0) {
            console.log(`⏸️ Pause de 10s après ${errorCount} erreurs avec rotation IP...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

/**
 * 🚀 Démarrage avec configuration IPRoyal
 */
async function start() {
    console.log('✅ Configuration IPRoyal avec rotation automatique initialisée');
    console.log(`🌐 Pool de proxies: ${COUNTRIES.length} pays disponibles`);
    
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
        console.log('📊 RÉSUMÉ FINAL (IPROYAL + ROTATION):');
        console.log(`  ⏱️ Durée totale: ${runTime} secondes`);
        console.log(`  📈 Mises à jour réussies: ${updateCount}`);
        console.log(`  ❌ Erreurs: ${errorCount}`);
        console.log(`  🌐 Pays utilisés: ${COUNTRIES.join(', ')}`);
        
        if (updateCount > 0) {
            const successRate = ((updateCount / (updateCount + errorCount)) * 100).toFixed(1);
            const avgReqPerSec = (updateCount / runTime).toFixed(2);
            console.log(`  ✅ Taux de succès: ${successRate}%`);
            console.log(`  ⚡ Vitesse moyenne: ${avgReqPerSec} req/sec`);
        }
        
        if (lastPrice) {
            console.log(`  💰 Dernier prix: ${formatValue(lastPrice, 'price')}`);
        }
        
        console.log('✅ Monitoring IPRoyal avec rotation arrêté!');
        process.exit(0);
    });
    
    console.log('💡 Appuyez sur Ctrl+C pour arrêter');
    console.log('📊 Stats automatiques toutes les 30 secondes');
    console.log(`⚡ Objectif: 1 requête par seconde avec rotation automatique d'IP`);
    console.log(`🔄 Rotation: Changement de pays à chaque requête pour éviter les limitations`);
}

// Démarrage
start().catch(error => {
    console.error('❌ Erreur fatale au démarrage:', error.message);
    process.exit(1);
}); 