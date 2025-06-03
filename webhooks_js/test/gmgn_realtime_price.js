#!/usr/bin/env node

/**
 * 🎯 DONNÉES TEMPS RÉEL AVEC PROXY PREMIUM IPROYAL - GMGN.AI
 * 
 * Récupération complète des données via GMGN avec proxy IPRoyal et cloudflare-bypasser.
 * Rotation d'IP à chaque requête pour contourner les limitations.
 * 
 * 🌐 PROXY: IPRoyal Résidentiel
 * ⚡ OBJECTIF INITIAL: 1 requête par seconde
 */

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump'; // chat
const UPDATE_INTERVAL = 1000; // 1000ms = 1 seconde (1 req/sec)

// ⭐ Identifiants IPRoyal
const IPROYAL_HOSTNAME = 'geo.iproyal.com';
const IPROYAL_PORT = '12321';
const IPROYAL_USERNAME = 'j686absSWTWSkmcj';
const IPROYAL_PASSWORD = 'kjXBVH6xcLmWKew5';

const PROXY_STRING = `http://${IPROYAL_USERNAME}:${IPROYAL_PASSWORD}@${IPROYAL_HOSTNAME}:${IPROYAL_PORT}`;

// 🔄 USER AGENTS ROTATIFS (conservé pour simuler différents navigateurs)
const USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0'
];

// Variables de suivi
let currentUserAgentIndex = 0;
let lastPrice = null;
let lastData = null;
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();

// Variable pour le bypasser (sera initialisée dynamiquement)
let CloudflareBypasser = null;

console.log('🎯 DONNÉES TEMPS RÉEL AVEC IPROYAL & CLOUDFLARE-BYPASSER - TOKEN CHAT');
console.log('═'.repeat(80));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log(`⏱️ Mise à jour: toutes les ${UPDATE_INTERVAL/1000} seconde(s)`);
console.log(`🔗 Source: GMGN.ai`);
console.log(`🌐 Proxy: IPRoyal Résidentiel (${IPROYAL_HOSTNAME})`);
console.log(`🤖 Bypasser: cloudflare-bypasser`);
console.log(`⚡ Objectif initial: 1 req/sec`);
console.log('🚀 Initialisation...');

/**
 * 🔄 Obtenir le prochain User-Agent
 */
function getNextUserAgent() {
    const userAgent = USER_AGENTS[currentUserAgentIndex];
    currentUserAgentIndex = (currentUserAgentIndex + 1) % USER_AGENTS.length;
    return userAgent;
}

/**
 * 🌐 Initialiser cloudflare-bypasser avec import dynamique
 */
async function initCloudFlareBypasser() {
    if (!CloudflareBypasser) {
        try {
            const module = await import('cloudflare-bypasser');
            CloudflareBypasser = module.default || module;
            console.log('✅ CloudflareBypasser chargé avec succès');
        } catch (error) {
            console.error('❌ Erreur lors du chargement de cloudflare-bypasser:', error.message);
            throw error;
        }
    }
    return CloudflareBypasser;
}

/**
 * 🌐 Récupérer toutes les données depuis GMGN avec proxy IPRoyal et cloudflare-bypasser
 */
async function fetchTokenDataWithBypasser() {
    const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;
    const userAgent = getNextUserAgent();
    
    // Initialiser cloudflare-bypasser si pas encore fait
    const CFBypasser = await initCloudFlareBypasser();
    
    const cfBypasser = new CFBypasser({
        userAgent: userAgent, // Définit le User-Agent pour cette instance de bypasser
        headers: { // En-têtes par défaut pour cette instance
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
            'Referer': `https://gmgn.ai/sol/${TARGET_TOKEN}`,
            'Origin': 'https://gmgn.ai',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'Sec-CH-UA': '"Chromium";v="120", "Not?A_Brand";v="8", "Google Chrome";v="120"',
            'Sec-CH-UA-Mobile': '?0',
            'Sec-CH-UA-Platform': '"macOS"'
        }
    });

    try {
        console.log(`🔍 [DEBUG] Tentative de requête vers: ${url}`);
        console.log(`🔍 [DEBUG] User-Agent: ${userAgent}`);
        console.log(`🔍 [DEBUG] Proxy: ${PROXY_STRING}`);
        
        // Simplification de la requête pour cloudflare-bypasser
        const result = await cfBypasser.request({
            url: url, // Utilisation de 'url' au lieu de 'uri'
            proxy: PROXY_STRING,
            timeout: 8000,
            gzip: true, // Activation de la décompression automatique
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
                'Referer': `https://gmgn.ai/sol/${TARGET_TOKEN}`,
                'Origin': 'https://gmgn.ai'
            }
        });
        
        console.log(`🔍 [DEBUG] Type de result: ${typeof result}`);
        console.log(`🔍 [DEBUG] Keys de result: ${result ? Object.keys(result) : 'null'}`);
        
        // Log des propriétés importantes
        if (result) {
            console.log(`🔍 [DEBUG] result.statusCode: ${result.statusCode}`);
            console.log(`🔍 [DEBUG] result.body existe: ${!!result.body}`);
            console.log(`🔍 [DEBUG] Type de result.body: ${typeof result.body}`);
        }
        
        // Vérification spécifique pour les erreurs 403 (Cloudflare)
        if (result && result.statusCode === 403) {
            throw new Error(`Cloudflare bloque la requête (HTTP 403). Proxy: IPRoyal`);
        }
        
        // Vérification générale des codes d'erreur HTTP
        if (result && result.statusCode && result.statusCode !== 200) {
            throw new Error(`HTTP ${result.statusCode} via IPRoyal & Bypasser`);
        }
        
        // Traitement simplifié de la réponse
        let bodyContent;
        
        if (typeof result === 'string') {
            bodyContent = result;
        } else if (result && result.body) {
            bodyContent = result.body;
        } else if (result && typeof result === 'object') {
            // Peut-être que result est déjà les données JSON parsées ?
            if (result.price !== undefined) {
                return {
                    ...result,
                    timestamp: Date.now(),
                    proxyUsed: `IPRoyal (${IPROYAL_HOSTNAME}) via Bypasser`
                };
            }
            bodyContent = JSON.stringify(result);
        } else {
            throw new Error(`Structure de réponse inattendue: ${typeof result}`);
        }
        
        console.log(`🔍 [DEBUG] bodyContent (premiers 200 chars): ${String(bodyContent).substring(0, 200)}`);
        
        let data;
        try {
            data = JSON.parse(bodyContent);
        } catch (parseError) {
            throw new Error(`Erreur de parsing JSON: ${parseError.message}. Réponse reçue: ${String(bodyContent).substring(0, 200)}`);
        }
        
        if (!data || typeof data.price === 'undefined') {
            throw new Error('Données non disponibles ou format incorrect depuis GMGN');
        }
        
        console.log(`✅ [DEBUG] Prix récupéré: ${data.price}`);
        
        return {
            ...data,
            timestamp: Date.now(),
            proxyUsed: `IPRoyal (${IPROYAL_HOSTNAME}) via Bypasser`
        };
        
    } catch (error) {
        console.log(`🔍 [DEBUG] Erreur catchée: ${error.message}`);
        console.log(`🔍 [DEBUG] Type d'erreur: ${typeof error}`);
        console.log(`🔍 [DEBUG] Stack d'erreur: ${error.stack}`);
        throw new Error(`${error.message}`);
    }
}

/**
 * 📊 Récupérer données (maintenant via cloudflare-bypasser)
 */
async function fetchTokenData() {
    return await fetchTokenDataWithBypasser();
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
 * Afficher toutes les données avec informations de proxy
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
        
        if (Math.abs(changePercent) > 0.00001) { // Seuil de détection de changement plus sensible
            changeIcon = change >= 0 ? '🟢' : '🔴';
            const changeStr = change >= 0 ? `+${change.toFixed(10)}` : change.toFixed(10);
            const percentStr = change >= 0 ? `+${changePercent.toFixed(4)}%` : `${changePercent.toFixed(4)}%`;
            priceChangeInfo = ` (${changeStr} | ${percentStr})`;
        }
    }
    
    // Affichage compact avec info proxy
    console.log(`${changeIcon} [${time}] ${formatValue(price, 'price')}${priceChangeInfo} [${tokenData.proxyUsed}]`);
    
    const shouldShowDetails = (lastData === null) || 
                             (updateCount % 20 === 0) || 
                             (lastPrice && Math.abs((price - lastPrice) / lastPrice) > 0.005); // >0.5% change
    
    if (shouldShowDetails) {
        console.log('┌───────────────────────────────────────────────────────────────────────────┐');
        console.log('│ 📊 DONNÉES COMPLÈTES (via IPRoyal)                                        │');
        console.log('├───────────────────────────────────────────────────────────────────────────┤');
        
        if (tokenData.symbol) console.log(`│ 🏷️  Symbole: ${tokenData.symbol.padEnd(66)} │`);
        if (tokenData.name) console.log(`│ 📛 Nom: ${tokenData.name.padEnd(70)} │`);
        console.log(`│ 💰 Prix: ${formatValue(price, 'price').padEnd(69)} │`);
        
        if (tokenData.market_cap) console.log(`│ 📈 Market Cap: ${formatValue(tokenData.market_cap, 'marketcap').padEnd(62)} │`);
        if (tokenData.volume_24h) console.log(`│ 📊 Volume 24h: ${formatValue(tokenData.volume_24h, 'volume').padEnd(62)} │`);
        if (tokenData.liquidity) console.log(`│ 💧 Liquidité: ${formatValue(tokenData.liquidity, 'marketcap').padEnd(63)} │`);
        
        if (tokenData.holder_count) console.log(`│ 👥 Holders: ${formatValue(tokenData.holder_count, 'number').padEnd(65)} │`);
        
        console.log(`│ 🌐 Proxy utilisé: ${(tokenData.proxyUsed).padEnd(60)} │`);
        // Supprimé: Proxies actifs
        
        console.log('└───────────────────────────────────────────────────────────────────────────┘');
    }
    
    lastPrice = price;
    lastData = tokenData;
}

/**
 * Afficher les statistiques avec info proxies
 */
function showStats() {
    const runTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000)); // Éviter division par zéro
    const successRate = updateCount > 0 ? ((updateCount / (updateCount + errorCount)) * 100).toFixed(1) : '0';
    const avgReqPerSec = updateCount > 0 ? (updateCount / runTime).toFixed(2) : '0';
    
    console.log(`📊 [Stats IPRoyal] Durée: ${runTime}s | Updates: ${updateCount} | Erreurs: ${errorCount} | Succès: ${successRate}%`);
    console.log(`⚡ [Perf IPRoyal] Vitesse: ${avgReqPerSec} req/sec`);
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
        console.log(`❌ [${time}] Erreur IPRoyal: ${error.message}`);
        
        // Si trop d'erreurs consécutives, pause plus longue
        if (errorCount > 0 && errorCount % 5 === 0) { // Pause après 5 erreurs
            console.log(`⏸️ Pause de 10s après ${errorCount} erreurs avec IPRoyal...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

/**
 * Démarrage
 */
async function start() {
    console.log('✅ Utilisation des proxies IPRoyal et cloudflare-bypasser configurée.');
    
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
        // Supprimé : clearInterval(proxyRefreshInterval);
        
        const runTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        console.log('📊 RÉSUMÉ FINAL (IPROYAL):');
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
        
        console.log('✅ Monitoring IPRoyal arrêté!');
        process.exit(0);
    });
    
    console.log('💡 Appuyez sur Ctrl+C pour arrêter');
    console.log('📊 Stats automatiques toutes les 30 secondes');
    console.log(`⚡ Objectif: 1 requête par seconde avec IPRoyal`);
}

// Démarrage
start().catch(error => {
    console.error('❌ Erreur fatale au démarrage:', error.message);
    process.exit(1);
}); 