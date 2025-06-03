#!/usr/bin/env node

import fetch from 'node-fetch';

/**
 * 🎯 DONNÉES TEMPS RÉEL AVEC PROXIES IPROYAL + FLARESOLVERR - GMGN.AI
 * 
 * Solution finale combinant :
 * ✅ FlareSolverr pour contourner Cloudflare GMGN
 * ✅ Proxies IPRoyal avec rotation pour éviter les limitations
 * ✅ Diagnostic confirmé : proxies IPRoyal fonctionnels
 */

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump'; // chat
const UPDATE_INTERVAL = 2000; // 2000ms = 2 secondes (FlareSolverr est plus lent)

// ⭐ Configuration IPRoyal (validée par diagnostic)
const IPROYAL_CONFIG = {
    hostname: 'geo.iproyal.com',
    port: '12321',
    username: 'j686absSWTWSkmcj',
    password: 'kjXBVH6xcLmWKew5'
};

// 🔄 Pays pour rotation automatique (testés et fonctionnels)
const COUNTRIES = ['US', 'CA', 'GB', 'DE', 'FR'];
let currentCountryIndex = 0;

// Variables de suivi
let lastPrice = null;
let lastData = null;
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();
let currentProxy = null;

console.log('🎯 SOLUTION FINALE : FLARESOLVERR + PROXIES IPROYAL');
console.log('═'.repeat(75));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log(`⏱️ Mise à jour: toutes les ${UPDATE_INTERVAL/1000} seconde(s)`);
console.log(`🔗 Source: GMGN.ai via FlareSolverr`);
console.log(`🌐 Proxy: IPRoyal Résidentiel avec rotation IP`);
console.log(`✅ Fréquence sécurisée: ${(1000/UPDATE_INTERVAL).toFixed(2)} req/sec`);
console.log('🚀 Démarrage...\n');

/**
 * 🌐 Obtenir le prochain proxy avec rotation de pays
 */
function getNextProxy() {
    const country = COUNTRIES[currentCountryIndex];
    currentCountryIndex = (currentCountryIndex + 1) % COUNTRIES.length;
    
    // ✅ Format validé par diagnostic
    const username = IPROYAL_CONFIG.username;
    const password = `${IPROYAL_CONFIG.password}_country-${country.toLowerCase()}`;
    const proxyUrl = `http://${username}:${password}@${IPROYAL_CONFIG.hostname}:${IPROYAL_CONFIG.port}`;
    
    currentProxy = {
        url: proxyUrl,
        country: country
    };
    
    return currentProxy;
}

/**
 * 📡 Récupérer données GMGN via FlareSolverr + IPRoyal
 */
async function fetchTokenData() {
    try {
        const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;
        
        // Obtenir le prochain proxy
        const proxy = getNextProxy();
        
        // 🔥 FlareSolverr avec proxy IPRoyal
        const payload = {
            cmd: "request.get",
            url: url,
            maxTimeout: 60000,
            proxy: {
                url: proxy.url
            },
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': `https://www.gmgn.cc/sol/${TARGET_TOKEN}`,
                'Origin': 'https://www.gmgn.cc'
            }
        };
        
        const response = await fetch('http://localhost:8191/v1', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`FlareSolverr HTTP ${response.status} via ${proxy.country}`);
        }
        
        const result = await response.json();
        
        if (result.status !== 'ok') {
            throw new Error(`FlareSolverr failed: ${result.message} via ${proxy.country}`);
        }
        
        // Traiter la réponse
        let data;
        try {
            data = JSON.parse(result.solution.response);
        } catch (parseError) {
            // Diagnostic amélioré
            const responsePreview = result.solution.response.substring(0, 100);
            if (result.solution.response.includes('<!DOCTYPE html>')) {
                throw new Error(`GMGN retourne HTML (Cloudflare actif?) via ${proxy.country}`);
            }
            throw new Error(`JSON parsing error via ${proxy.country}: ${responsePreview}...`);
        }
        
        if (!data || typeof data.price === 'undefined') {
            throw new Error(`Pas de données de prix via ${proxy.country}`);
        }
        
        return {
            ...data,
            timestamp: Date.now(),
            proxyUsed: `FlareSolverr+IPRoyal-${proxy.country}`,
            proxyUrl: proxy.url.replace(IPROYAL_CONFIG.password, '***')
        };
        
    } catch (error) {
        throw new Error(`${error.message} [Proxy: ${currentProxy?.country || 'N/A'}]`);
    }
}

/**
 * 💰 Formater une valeur
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
 * 📊 Afficher les données
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
    
    // Détails périodiques
    const shouldShowDetails = (lastData === null) || 
                             (updateCount % 5 === 0) || 
                             (lastPrice && Math.abs((price - lastPrice) / lastPrice) > 0.005);
    
    if (shouldShowDetails) {
        console.log('┌───────────────────────────────────────────────────────────────────────────┐');
        console.log('│ 📊 DONNÉES COMPLÈTES (FlareSolverr+IPRoyal)                               │');
        console.log('├───────────────────────────────────────────────────────────────────────────┤');
        
        if (tokenData.symbol) console.log(`│ 🏷️  Symbole: ${tokenData.symbol.padEnd(66)} │`);
        if (tokenData.name) console.log(`│ 📛 Nom: ${tokenData.name.padEnd(70)} │`);
        console.log(`│ 💰 Prix: ${formatValue(price, 'price').padEnd(69)} │`);
        
        if (tokenData.market_cap) console.log(`│ 📈 Market Cap: ${formatValue(tokenData.market_cap, 'marketcap').padEnd(62)} │`);
        if (tokenData.volume_24h) console.log(`│ 📊 Volume 24h: ${formatValue(tokenData.volume_24h, 'volume').padEnd(62)} │`);
        if (tokenData.liquidity) console.log(`│ 💧 Liquidité: ${formatValue(tokenData.liquidity, 'marketcap').padEnd(63)} │`);
        if (tokenData.holder_count) console.log(`│ 👥 Holders: ${formatValue(tokenData.holder_count, 'number').padEnd(65)} │`);
        
        console.log(`│ 🌐 Proxy actuel: ${tokenData.proxyUsed.padEnd(60)} │`);
        console.log(`│ 🔄 Rotation: ${COUNTRIES.length} pays (${COUNTRIES.join(', ')})${' '.padEnd(30)} │`);
        
        console.log('└───────────────────────────────────────────────────────────────────────────┘\n');
    }
    
    lastPrice = price;
    lastData = tokenData;
}

/**
 * 📊 Statistiques
 */
function showStats() {
    const runTime = Math.floor((Date.now() - startTime) / 1000);
    const successRate = updateCount > 0 ? ((updateCount / (updateCount + errorCount)) * 100).toFixed(1) : '0';
    const avgReqPerSec = updateCount > 0 ? (updateCount / runTime).toFixed(2) : '0';
    
    console.log(`\n📊 [Stats] Durée: ${runTime}s | Updates: ${updateCount} | Erreurs: ${errorCount} | Succès: ${successRate}%`);
    console.log(`⚡ [Performance] Vitesse: ${avgReqPerSec} req/sec | Proxy: ${currentProxy?.country || 'N/A'}`);
    console.log(`🌐 [Proxies] ${COUNTRIES.length} pays disponibles avec rotation automatique`);
    if (lastPrice) {
        console.log(`💰 [Prix actuel] ${formatValue(lastPrice, 'price')}`);
    }
    console.log('');
}

/**
 * 🔄 Boucle principale
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
        
        // Pause après erreurs multiples
        if (errorCount > 0 && errorCount % 3 === 0) {
            console.log(`⏸️ Pause de 5s après ${errorCount} erreurs...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

/**
 * 🚀 Démarrage
 */
async function start() {
    console.log('✅ Configuration FlareSolverr + IPRoyal initialisée');
    console.log(`🌐 Pool de proxies: ${COUNTRIES.length} pays validés par diagnostic`);
    console.log(`🔥 FlareSolverr: http://localhost:8191 (doit être démarré)`);
    
    // Premier appel
    await dataLoop();
    
    // Intervalle régulier
    const interval = setInterval(dataLoop, UPDATE_INTERVAL);
    
    // Stats toutes les 60 secondes
    const statsInterval = setInterval(showStats, 60000);
    
    // Gestion Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n🛑 Arrêt en cours...');
        
        clearInterval(interval);
        clearInterval(statsInterval);
        
        const runTime = Math.floor((Date.now() - startTime) / 1000);
        console.log('\n📊 RÉSUMÉ FINAL:');
        console.log(`  ⏱️ Durée: ${runTime} secondes`);
        console.log(`  📈 Succès: ${updateCount} | ❌ Erreurs: ${errorCount}`);
        console.log(`  🌐 Pays utilisés: ${COUNTRIES.join(', ')}`);
        
        if (updateCount > 0) {
            const successRate = ((updateCount / (updateCount + errorCount)) * 100).toFixed(1);
            const avgReqPerSec = (updateCount / runTime).toFixed(2);
            console.log(`  ✅ Taux de succès: ${successRate}%`);
            console.log(`  ⚡ Vitesse: ${avgReqPerSec} req/sec`);
        }
        
        if (lastPrice) {
            console.log(`  💰 Dernier prix: ${formatValue(lastPrice, 'price')}`);
        }
        
        console.log('\n✅ Monitoring arrêté!');
        process.exit(0);
    });
    
    console.log('💡 Appuyez sur Ctrl+C pour arrêter');
    console.log('📊 Stats automatiques toutes les 60 secondes');
    console.log(`⚡ Solution finale : FlareSolverr contourne Cloudflare + IPRoyal évite les limitations`);
}

// Démarrage
start().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
}); 