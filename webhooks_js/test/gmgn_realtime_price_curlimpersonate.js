#!/usr/bin/env node

/**
 * 🎯 DONNÉES TEMPS RÉEL AVEC PROXY PREMIUM IPROYAL - GMGN.AI (CURL-IMPERSONATE)
 * 
 * Récupération complète des données via GMGN avec proxy IPRoyal et curl-impersonate natif.
 * Utilisation de @qnaplus/node-curl-impersonate pour un vrai bypass Cloudflare.
 * 
 * 🌐 PROXY: IPRoyal Résidentiel
 * ⚡ OBJECTIF: 1 requête par seconde avec bypass natif
 */

import { RequestBuilder } from '@qnaplus/node-curl-impersonate';

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump'; // chat
const UPDATE_INTERVAL = 1000; // 1000ms = 1 seconde

// ⭐ Identifiants IPRoyal
const IPROYAL_HOSTNAME = 'geo.iproyal.com';
const IPROYAL_PORT = '12321';
const IPROYAL_USERNAME = 'j686absSWTWSkmcj';
const IPROYAL_PASSWORD = 'kjXBVH6xcLmWKew5';

const PROXY_STRING = `http://${IPROYAL_USERNAME}:${IPROYAL_PASSWORD}@${IPROYAL_HOSTNAME}:${IPROYAL_PORT}`;

// 🔄 CONFIGURATIONS DE NAVIGATEURS pour curl-impersonate
const BROWSER_PRESETS = [
    { name: 'chrome', version: '116' },
    { name: 'chrome', version: '110' },
    { name: 'chrome', version: '107' },
    { name: 'safari', version: '15_5' },
    { name: 'firefox', version: '109' }
];

// Variables de suivi
let currentPresetIndex = 0;
let lastPrice = null;
let lastData = null;
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();

console.log('🎯 DONNÉES TEMPS RÉEL AVEC IPROYAL & CURL-IMPERSONATE NATIF - TOKEN CHAT');
console.log('═'.repeat(85));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log(`⏱️ Mise à jour: toutes les ${UPDATE_INTERVAL/1000} seconde(s)`);
console.log(`🔗 Source: GMGN.ai`);
console.log(`🌐 Proxy: IPRoyal Résidentiel (${IPROYAL_HOSTNAME})`);
console.log(`🤖 Bypasser: curl-impersonate natif (@qnaplus)`);
console.log(`⚡ Objectif: 1 req/sec avec TLS natif`);
console.log('🚀 Initialisation...');

/**
 * 🔄 Obtenir le prochain preset de navigateur
 */
function getNextBrowserPreset() {
    const preset = BROWSER_PRESETS[currentPresetIndex];
    currentPresetIndex = (currentPresetIndex + 1) % BROWSER_PRESETS.length;
    return preset;
}

/**
 * 🌐 Récupérer les données avec curl-impersonate natif
 */
async function fetchTokenDataWithCurlImpersonate() {
    const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;
    const browserPreset = getNextBrowserPreset();
    
    try {
        console.log(`🔍 [DEBUG] Tentative avec: ${browserPreset.name} ${browserPreset.version}`);
        console.log(`🔍 [DEBUG] URL: ${url}`);
        console.log(`🔍 [DEBUG] Proxy: ${PROXY_STRING}`);
        
        // Configuration de la requête avec curl-impersonate
        const response = await new RequestBuilder()
            .url(url)
            .method('GET')
            .preset(browserPreset)
            .proxy(PROXY_STRING)
            .header('Accept', 'application/json, text/plain, */*')
            .header('Accept-Language', 'en-US,en;q=0.9,fr;q=0.8')
            .header('Accept-Encoding', 'gzip, deflate, br')
            .header('Referer', `https://gmgn.ai/sol/${TARGET_TOKEN}`)
            .header('Origin', 'https://gmgn.ai')
            .header('DNT', '1')
            .header('Connection', 'keep-alive')
            .header('Upgrade-Insecure-Requests', '1')
            .header('Sec-Fetch-Dest', 'empty')
            .header('Sec-Fetch-Mode', 'cors')
            .header('Sec-Fetch-Site', 'same-site')
            .header('Cache-Control', 'no-cache')
            .header('Pragma', 'no-cache')
            .timeout(10000)
            .send();
        
        console.log(`🔍 [DEBUG] Status: ${response.statusCode}`);
        console.log(`🔍 [DEBUG] Headers présents: ${Object.keys(response.headers || {}).length}`);
        console.log(`🔍 [DEBUG] Content-Type: ${response.headers?.['content-type'] || 'N/A'}`);
        
        // Vérification spécifique pour Cloudflare
        if (response.statusCode === 403) {
            const bodySnippet = response.body ? response.body.substring(0, 200) : '';
            if (bodySnippet.includes('cloudflare') || bodySnippet.includes('Forbidden')) {
                throw new Error(`Cloudflare bloque encore (HTTP 403) - ${browserPreset.name} ${browserPreset.version}`);
            }
        }
        
        if (response.statusCode !== 200) {
            throw new Error(`HTTP ${response.statusCode} avec ${browserPreset.name} ${browserPreset.version}`);
        }
        
        console.log(`🔍 [DEBUG] Body length: ${response.body ? response.body.length : 0}`);
        console.log(`🔍 [DEBUG] Body snippet: ${response.body ? response.body.substring(0, 200) : 'N/A'}`);
        
        let data;
        try {
            data = JSON.parse(response.body);
        } catch (parseError) {
            throw new Error(`Erreur parsing JSON (${browserPreset.name} ${browserPreset.version}): ${parseError.message}`);
        }
        
        if (!data || typeof data.price === 'undefined') {
            throw new Error(`Données non disponibles depuis GMGN (${browserPreset.name} ${browserPreset.version})`);
        }
        
        console.log(`✅ [DEBUG] Prix récupéré avec ${browserPreset.name} ${browserPreset.version}: ${data.price}`);
        
        return {
            ...data,
            timestamp: Date.now(),
            proxyUsed: `IPRoyal (${browserPreset.name} ${browserPreset.version}) via curl-impersonate`,
            browserPreset: `${browserPreset.name} ${browserPreset.version}`
        };
        
    } catch (error) {
        console.log(`🔍 [DEBUG] Erreur avec ${browserPreset.name} ${browserPreset.version}: ${error.message}`);
        throw new Error(`${browserPreset.name} ${browserPreset.version}: ${error.message}`);
    }
}

/**
 * 📊 Récupérer données (curl-impersonate natif)
 */
async function fetchTokenData() {
    return await fetchTokenDataWithCurlImpersonate();
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
 * Afficher toutes les données avec informations de navigateur
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
        
        if (Math.abs(changePercent) > 0.00001) {
            changeIcon = change >= 0 ? '🟢' : '🔴';
            const changeStr = change >= 0 ? `+${change.toFixed(10)}` : change.toFixed(10);
            const percentStr = change >= 0 ? `+${changePercent.toFixed(4)}%` : `${changePercent.toFixed(4)}%`;
            priceChangeInfo = ` (${changeStr} | ${percentStr})`;
        }
    }
    
    // Affichage compact avec info navigateur
    console.log(`${changeIcon} [${time}] ${formatValue(price, 'price')}${priceChangeInfo} [${tokenData.browserPreset}]`);
    
    const shouldShowDetails = (lastData === null) || 
                             (updateCount % 20 === 0) || 
                             (lastPrice && Math.abs((price - lastPrice) / lastPrice) > 0.005);
    
    if (shouldShowDetails) {
        console.log('┌─────────────────────────────────────────────────────────────────────────────────┐');
        console.log('│ 📊 DONNÉES COMPLÈTES (via curl-impersonate natif)                              │');
        console.log('├─────────────────────────────────────────────────────────────────────────────────┤');
        
        if (tokenData.symbol) console.log(`│ 🏷️  Symbole: ${tokenData.symbol.padEnd(70)} │`);
        if (tokenData.name) console.log(`│ 📛 Nom: ${tokenData.name.padEnd(74)} │`);
        console.log(`│ 💰 Prix: ${formatValue(price, 'price').padEnd(73)} │`);
        
        if (tokenData.market_cap) console.log(`│ 📈 Market Cap: ${formatValue(tokenData.market_cap, 'marketcap').padEnd(66)} │`);
        if (tokenData.volume_24h) console.log(`│ 📊 Volume 24h: ${formatValue(tokenData.volume_24h, 'volume').padEnd(66)} │`);
        if (tokenData.liquidity) console.log(`│ 💧 Liquidité: ${formatValue(tokenData.liquidity, 'marketcap').padEnd(67)} │`);
        
        if (tokenData.holder_count) console.log(`│ 👥 Holders: ${formatValue(tokenData.holder_count, 'number').padEnd(69)} │`);
        
        console.log(`│ 🌐 Navigateur simulé: ${(tokenData.browserPreset).padEnd(60)} │`);
        console.log(`│ 🔧 Méthode: curl-impersonate natif + IPRoyal${' '.padEnd(47)} │`);
        
        console.log('└─────────────────────────────────────────────────────────────────────────────────┘');
    }
    
    lastPrice = price;
    lastData = tokenData;
}

/**
 * Afficher les statistiques
 */
function showStats() {
    const runTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
    const successRate = updateCount > 0 ? ((updateCount / (updateCount + errorCount)) * 100).toFixed(1) : '0';
    const avgReqPerSec = updateCount > 0 ? (updateCount / runTime).toFixed(2) : '0';
    
    console.log(`📊 [Stats curl-impersonate] Durée: ${runTime}s | Updates: ${updateCount} | Erreurs: ${errorCount} | Succès: ${successRate}%`);
    console.log(`⚡ [Perf] Vitesse: ${avgReqPerSec} req/sec | Browser actuel: ${BROWSER_PRESETS[currentPresetIndex].name} ${BROWSER_PRESETS[currentPresetIndex].version}`);
    if (lastPrice) {
        console.log(`💰 [Prix actuel] ${formatValue(lastPrice, 'price')}`);
    }
    console.log('');
}

/**
 * Boucle principale avec gestion d'erreurs robuste
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
        console.log(`❌ [${time}] Erreur curl-impersonate: ${error.message}`);
        
        // Pause après erreurs multiples
        if (errorCount > 0 && errorCount % 3 === 0) {
            console.log(`⏸️ Pause de 5s après ${errorCount} erreurs...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

/**
 * Démarrage
 */
async function start() {
    console.log('✅ Configuration curl-impersonate natif avec IPRoyal et rotation de navigateurs.');
    
    // Premier appel immédiat
    await dataLoop();
    
    // Puis selon l'intervalle défini
    const interval = setInterval(dataLoop, UPDATE_INTERVAL);
    
    // Stats toutes les 30 secondes
    const statsInterval = setInterval(showStats, 30000);
    
    // Gestion Ctrl+C
    process.on('SIGINT', () => {
        console.log('🛑 Arrêt en cours...');
        
        clearInterval(interval);
        clearInterval(statsInterval);
        
        const runTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        console.log('📊 RÉSUMÉ FINAL (CURL-IMPERSONATE NATIF):');
        console.log(`  ⏱️ Durée totale: ${runTime} secondes`);
        console.log(`  📈 Mises à jour réussies: ${updateCount}`);
        console.log(`  ❌ Erreurs: ${errorCount}`);
        
        if (updateCount > 0) {
            const successRate = ((updateCount / (updateCount + errorCount)) * 100).toFixed(1);
            const avgReqPerSec = (updateCount / runTime).toFixed(2);
            console.log(`  ✅ Taux de succès: ${successRate}%`);
            console.log(`  ⚡ Vitesse moyenne: ${avgReqPerSec} req/sec`);
        }
        
        if (lastPrice) {
            console.log(`  💰 Dernier prix: ${formatValue(lastPrice, 'price')}`);
        }
        
        console.log('✅ Monitoring curl-impersonate natif arrêté!');
        process.exit(0);
    });
    
    console.log('💡 Appuyez sur Ctrl+C pour arrêter');
    console.log('📊 Stats automatiques toutes les 30 secondes');
    console.log(`⚡ Objectif: 1 requête par seconde avec TLS natif curl-impersonate`);
}

// Démarrage
start().catch(error => {
    console.error('❌ Erreur fatale au démarrage:', error.message);
    process.exit(1);
}); 