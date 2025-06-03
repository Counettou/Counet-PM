#!/usr/bin/env node

/**
 * 🎯 DONNÉES TEMPS RÉEL AVEC PROXY PREMIUM IPROYAL - GMGN.AI (GOT-SCRAPING)
 * 
 * Récupération complète des données via GMGN avec proxy IPRoyal et got-scraping.
 * Utilisation de got-scraping pour contourner Cloudflare avec TLS sophistiqué.
 * 
 * 🌐 PROXY: IPRoyal Résidentiel
 * ⚡ OBJECTIF: 1 requête par seconde avec bypass avancé
 */

import { gotScraping } from 'got-scraping';
import { HttpsProxyAgent } from 'https-proxy-agent';

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump'; // chat
const UPDATE_INTERVAL = 1000; // 1000ms = 1 seconde

// ⭐ Identifiants IPRoyal
const IPROYAL_HOSTNAME = 'geo.iproyal.com';
const IPROYAL_PORT = '12321';
const IPROYAL_USERNAME = 'j686absSWTWSkmcj';
const IPROYAL_PASSWORD = 'kjXBVH6xcLmWKew5';

const PROXY_STRING = `http://${IPROYAL_USERNAME}:${IPROYAL_PASSWORD}@${IPROYAL_HOSTNAME}:${IPROYAL_PORT}`;

// 🔄 CONFIGURATIONS TLS AVANCÉES pour simuler différents navigateurs
const BROWSER_CONFIGS = [
    {
        name: 'Chrome 120',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        headerGeneratorOptions: {
            browsers: [{ name: 'chrome', minVersion: 120, maxVersion: 121 }],
            operatingSystems: ['macos', 'windows'],
            locales: ['en-US', 'en'],
            devices: ['desktop']
        }
    },
    {
        name: 'Firefox 120',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        headerGeneratorOptions: {
            browsers: [{ name: 'firefox', minVersion: 120, maxVersion: 121 }],
            operatingSystems: ['windows', 'macos'],
            locales: ['en-US', 'en'],
            devices: ['desktop']
        }
    },
    {
        name: 'Safari 17',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        headerGeneratorOptions: {
            browsers: [{ name: 'safari', minVersion: 17, maxVersion: 17 }],
            operatingSystems: ['macos'],
            locales: ['en-US', 'en'],
            devices: ['desktop']
        }
    }
];

// Variables de suivi
let currentBrowserIndex = 0;
let lastPrice = null;
let lastData = null;
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();

console.log('🎯 DONNÉES TEMPS RÉEL AVEC IPROYAL & GOT-SCRAPING - TOKEN CHAT');
console.log('═'.repeat(80));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log(`⏱️ Mise à jour: toutes les ${UPDATE_INTERVAL/1000} seconde(s)`);
console.log(`🔗 Source: GMGN.ai`);
console.log(`🌐 Proxy: IPRoyal Résidentiel (${IPROYAL_HOSTNAME})`);
console.log(`🤖 Bypasser: got-scraping avec TLS avancé`);
console.log(`⚡ Objectif: 1 req/sec avec rotation de fingerprints`);
console.log('🚀 Initialisation...');

/**
 * 🔄 Obtenir la prochaine configuration de navigateur
 */
function getNextBrowserConfig() {
    const config = BROWSER_CONFIGS[currentBrowserIndex];
    currentBrowserIndex = (currentBrowserIndex + 1) % BROWSER_CONFIGS.length;
    return config;
}

/**
 * 🌐 Récupérer les données avec got-scraping et configurations avancées
 */
async function fetchTokenDataWithGotScraping() {
    const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;
    const browserConfig = getNextBrowserConfig();
    
    // Configuration du proxy agent
    const proxyAgent = new HttpsProxyAgent(PROXY_STRING);
    
    try {
        console.log(`🔍 [DEBUG] Tentative avec: ${browserConfig.name}`);
        console.log(`🔍 [DEBUG] URL: ${url}`);
        console.log(`🔍 [DEBUG] Proxy: ${PROXY_STRING}`);
        
        // Configuration got-scraping simplifiée (certaines options causaient des conflits)
        const response = await gotScraping({
            url: url,
            method: 'GET',
            
            // Configuration du proxy
            agent: {
                https: proxyAgent
            },
            
            // Configuration TLS et HTTP avancée
            headerGeneratorOptions: browserConfig.headerGeneratorOptions,
            
            // En-têtes personnalisés
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': `https://gmgn.ai/sol/${TARGET_TOKEN}`,
                'Origin': 'https://gmgn.ai',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            
            // Timeouts
            timeout: {
                request: 10000,
                connect: 5000,
                socket: 8000
            },
            
            // Retry configuration
            retry: {
                limit: 2,
                methods: ['GET'],
                statusCodes: [408, 413, 429, 500, 502, 503, 504],
                errorCodes: ['TIMEOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN']
            },
            
            // Configuration TLS avancée
            https: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2',
                maxVersion: 'TLSv1.3'
            },
            
            // Configuration de fingerprinting
            useHeaderGenerator: true,
            
            // Configuration des proxies
            proxyUrl: PROXY_STRING
        });
        
        console.log(`🔍 [DEBUG] Status: ${response.statusCode}`);
        console.log(`🔍 [DEBUG] Headers présents: ${Object.keys(response.headers).length}`);
        console.log(`🔍 [DEBUG] Content-Type: ${response.headers['content-type']}`);
        
        // Vérification spécifique pour Cloudflare
        if (response.statusCode === 403) {
            const bodySnippet = response.body.substring(0, 200);
            if (bodySnippet.includes('cloudflare') || bodySnippet.includes('Forbidden')) {
                throw new Error(`Cloudflare bloque encore (HTTP 403) - ${browserConfig.name}`);
            }
        }
        
        if (response.statusCode !== 200) {
            throw new Error(`HTTP ${response.statusCode} avec ${browserConfig.name}`);
        }
        
        console.log(`🔍 [DEBUG] Body length: ${response.body.length}`);
        console.log(`🔍 [DEBUG] Body snippet: ${response.body.substring(0, 200)}`);
        
        let data;
        try {
            data = JSON.parse(response.body);
        } catch (parseError) {
            throw new Error(`Erreur parsing JSON (${browserConfig.name}): ${parseError.message}`);
        }
        
        if (!data || typeof data.price === 'undefined') {
            throw new Error(`Données non disponibles depuis GMGN (${browserConfig.name})`);
        }
        
        console.log(`✅ [DEBUG] Prix récupéré avec ${browserConfig.name}: ${data.price}`);
        
        return {
            ...data,
            timestamp: Date.now(),
            proxyUsed: `IPRoyal (${browserConfig.name}) via got-scraping`,
            browserConfig: browserConfig.name
        };
        
    } catch (error) {
        console.log(`🔍 [DEBUG] Erreur avec ${browserConfig.name}: ${error.message}`);
        throw new Error(`${browserConfig.name}: ${error.message}`);
    }
}

/**
 * 📊 Récupérer données (got-scraping)
 */
async function fetchTokenData() {
    return await fetchTokenDataWithGotScraping();
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
    console.log(`${changeIcon} [${time}] ${formatValue(price, 'price')}${priceChangeInfo} [${tokenData.browserConfig}]`);
    
    const shouldShowDetails = (lastData === null) || 
                             (updateCount % 20 === 0) || 
                             (lastPrice && Math.abs((price - lastPrice) / lastPrice) > 0.005);
    
    if (shouldShowDetails) {
        console.log('┌───────────────────────────────────────────────────────────────────────────┐');
        console.log('│ 📊 DONNÉES COMPLÈTES (via got-scraping)                                   │');
        console.log('├───────────────────────────────────────────────────────────────────────────┤');
        
        if (tokenData.symbol) console.log(`│ 🏷️  Symbole: ${tokenData.symbol.padEnd(66)} │`);
        if (tokenData.name) console.log(`│ 📛 Nom: ${tokenData.name.padEnd(70)} │`);
        console.log(`│ 💰 Prix: ${formatValue(price, 'price').padEnd(69)} │`);
        
        if (tokenData.market_cap) console.log(`│ 📈 Market Cap: ${formatValue(tokenData.market_cap, 'marketcap').padEnd(62)} │`);
        if (tokenData.volume_24h) console.log(`│ 📊 Volume 24h: ${formatValue(tokenData.volume_24h, 'volume').padEnd(62)} │`);
        if (tokenData.liquidity) console.log(`│ 💧 Liquidité: ${formatValue(tokenData.liquidity, 'marketcap').padEnd(63)} │`);
        
        if (tokenData.holder_count) console.log(`│ 👥 Holders: ${formatValue(tokenData.holder_count, 'number').padEnd(65)} │`);
        
        console.log(`│ 🌐 Navigateur simulé: ${(tokenData.browserConfig).padEnd(56)} │`);
        console.log(`│ 🔧 Méthode: got-scraping + IPRoyal${' '.padEnd(51)} │`);
        
        console.log('└───────────────────────────────────────────────────────────────────────────┘');
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
    
    console.log(`📊 [Stats got-scraping] Durée: ${runTime}s | Updates: ${updateCount} | Erreurs: ${errorCount} | Succès: ${successRate}%`);
    console.log(`⚡ [Perf] Vitesse: ${avgReqPerSec} req/sec | Browser actuel: ${BROWSER_CONFIGS[currentBrowserIndex].name}`);
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
        console.log(`❌ [${time}] Erreur got-scraping: ${error.message}`);
        
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
    console.log('✅ Configuration got-scraping avec IPRoyal et rotation de navigateurs.');
    
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
        console.log('📊 RÉSUMÉ FINAL (GOT-SCRAPING):');
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
        
        console.log('✅ Monitoring got-scraping arrêté!');
        process.exit(0);
    });
    
    console.log('💡 Appuyez sur Ctrl+C pour arrêter');
    console.log('📊 Stats automatiques toutes les 30 secondes');
    console.log(`⚡ Objectif: 1 requête par seconde avec rotation TLS`);
}

// Démarrage
start().catch(error => {
    console.error('❌ Erreur fatale au démarrage:', error.message);
    process.exit(1);
}); 