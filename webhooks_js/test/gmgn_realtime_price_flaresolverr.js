#!/usr/bin/env node

/**
 * 🎯 DONNÉES TEMPS RÉEL AVEC PROXY PREMIUM IPROYAL - GMGN.AI (FLARESOLVERR)
 * 
 * Récupération complète des données via GMGN avec proxy IPRoyal et FlareSolverr.
 * Utilisation de FlareSolverr pour contourner Cloudflare avec Selenium + Chrome.
 * 
 * 🌐 PROXY: IPRoyal Résidentiel
 * ⚡ OBJECTIF: 1 requête par seconde avec bypass FlareSolverr
 */

import fetch from 'node-fetch';

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump'; // chat
const UPDATE_INTERVAL = 2000; // 2000ms = 2 secondes (FlareSolverr est plus lent)

// ⭐ Identifiants IPRoyal
const IPROYAL_HOSTNAME = 'geo.iproyal.com';
const IPROYAL_PORT = '12321';
const IPROYAL_USERNAME = 'j686absSWTWSkmcj';
const IPROYAL_PASSWORD = 'kjXBVH6xcLmWKew5';

const PROXY_CONFIG = {
    url: `http://${IPROYAL_USERNAME}:${IPROYAL_PASSWORD}@${IPROYAL_HOSTNAME}:${IPROYAL_PORT}`
};

// 🔥 Configuration FlareSolverr
const FLARESOLVERR_URL = 'http://localhost:8191/v1';

// Variables de suivi
let lastPrice = null;
let lastData = null;
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();
let currentSession = null;

console.log('🎯 DONNÉES TEMPS RÉEL AVEC IPROYAL & FLARESOLVERR - TOKEN CHAT');
console.log('═'.repeat(80));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log(`⏱️ Mise à jour: toutes les ${UPDATE_INTERVAL/1000} seconde(s)`);
console.log(`🔗 Source: GMGN.ai`);
console.log(`🌐 Proxy: IPRoyal Résidentiel (${IPROYAL_HOSTNAME})`);
console.log(`🤖 Bypasser: FlareSolverr v3.3.21 (Selenium + Chrome)`);
console.log(`⚡ Objectif: 1 req toutes les 2 sec avec session réutilisable`);
console.log('🚀 Initialisation...');

/**
 * 🔥 Créer une session FlareSolverr avec proxy IPRoyal
 */
async function createFlareSolverrSession() {
    try {
        console.log('🔥 [DEBUG] Création d\'une session FlareSolverr avec proxy IPRoyal...');
        
        const sessionPayload = {
            cmd: "sessions.create",
            session: `gmgn-session-${Date.now()}`,
            maxTimeout: 60000,
            proxy: PROXY_CONFIG
        };
        
        const response = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionPayload),
            timeout: 70000
        });
        
        const result = await response.json();
        
        if (result.status === 'ok') {
            currentSession = result.session;
            console.log(`✅ [DEBUG] Session créée: ${currentSession}`);
            return currentSession;
        } else {
            throw new Error(`Erreur création session: ${result.message}`);
        }
        
    } catch (error) {
        console.error(`❌ [DEBUG] Erreur création session FlareSolverr: ${error.message}`);
        throw error;
    }
}

/**
 * 🌐 Récupérer les données avec FlareSolverr
 */
async function fetchTokenDataWithFlareSolverr() {
    const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;
    
    try {
        console.log(`🔍 [DEBUG] Requête FlareSolverr vers: ${url}`);
        console.log(`🔍 [DEBUG] Session: ${currentSession || 'nouvelle session temporaire'}`);
        console.log(`🔍 [DEBUG] Proxy: ${PROXY_CONFIG.url}`);
        
        // Payload pour FlareSolverr
        const payload = {
            cmd: "request.get",
            url: url,
            maxTimeout: 60000,
            proxy: PROXY_CONFIG
        };
        
        // Ajouter la session si disponible
        if (currentSession) {
            payload.session = currentSession;
        }
        
        const response = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 70000
        });
        
        const result = await response.json();
        
        console.log(`🔍 [DEBUG] Status FlareSolverr: ${result.status}`);
        console.log(`🔍 [DEBUG] Message: ${result.message}`);
        
        if (result.status !== 'ok') {
            throw new Error(`FlareSolverr error: ${result.message}`);
        }
        
        const solution = result.solution;
        console.log(`🔍 [DEBUG] Status HTTP: ${solution.status}`);
        console.log(`🔍 [DEBUG] URL finale: ${solution.url}`);
        
        // Vérification spécifique pour Cloudflare
        if (solution.status === 403) {
            const bodySnippet = solution.response.substring(0, 200);
            if (bodySnippet.includes('cloudflare') || bodySnippet.includes('Forbidden')) {
                throw new Error(`Cloudflare bloque encore malgré FlareSolverr (HTTP 403)`);
            }
        }
        
        if (solution.status !== 200) {
            throw new Error(`HTTP ${solution.status} via FlareSolverr`);
        }
        
        console.log(`🔍 [DEBUG] Response length: ${solution.response.length}`);
        console.log(`🔍 [DEBUG] Response snippet: ${solution.response.substring(0, 200)}`);
        
        let data;
        try {
            data = JSON.parse(solution.response);
        } catch (parseError) {
            throw new Error(`Erreur parsing JSON FlareSolverr: ${parseError.message}`);
        }
        
        if (!data || typeof data.price === 'undefined') {
            throw new Error(`Données non disponibles depuis GMGN via FlareSolverr`);
        }
        
        console.log(`✅ [DEBUG] Prix récupéré via FlareSolverr: ${data.price}`);
        
        return {
            ...data,
            timestamp: Date.now(),
            proxyUsed: `IPRoyal via FlareSolverr (${solution.userAgent})`,
            cookies: solution.cookies ? solution.cookies.length : 0,
            sessionUsed: currentSession || 'temporaire'
        };
        
    } catch (error) {
        console.log(`🔍 [DEBUG] Erreur FlareSolverr: ${error.message}`);
        
        // Si erreur de session, on essaie de recréer
        if (error.message.includes('session') && currentSession) {
            console.log('🔄 [DEBUG] Tentative de recréation de session...');
            currentSession = null;
            try {
                await createFlareSolverrSession();
                // Retry une fois
                return await fetchTokenDataWithFlareSolverr();
            } catch (retryError) {
                throw new Error(`Erreur après retry session: ${retryError.message}`);
            }
        }
        
        throw error;
    }
}

/**
 * 📊 Récupérer données (FlareSolverr)
 */
async function fetchTokenData() {
    return await fetchTokenDataWithFlareSolverr();
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
 * Afficher toutes les données avec informations FlareSolverr
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
    
    // Affichage compact avec info FlareSolverr
    console.log(`${changeIcon} [${time}] ${formatValue(price, 'price')}${priceChangeInfo} [FlareSolverr+IPRoyal]`);
    
    const shouldShowDetails = (lastData === null) || 
                             (updateCount % 10 === 0) || 
                             (lastPrice && Math.abs((price - lastPrice) / lastPrice) > 0.005);
    
    if (shouldShowDetails) {
        console.log('┌─────────────────────────────────────────────────────────────────────────────────┐');
        console.log('│ 📊 DONNÉES COMPLÈTES (via FlareSolverr + IPRoyal)                              │');
        console.log('├─────────────────────────────────────────────────────────────────────────────────┤');
        
        if (tokenData.symbol) console.log(`│ 🏷️  Symbole: ${tokenData.symbol.padEnd(70)} │`);
        if (tokenData.name) console.log(`│ 📛 Nom: ${tokenData.name.padEnd(74)} │`);
        console.log(`│ 💰 Prix: ${formatValue(price, 'price').padEnd(73)} │`);
        
        if (tokenData.market_cap) console.log(`│ 📈 Market Cap: ${formatValue(tokenData.market_cap, 'marketcap').padEnd(66)} │`);
        if (tokenData.volume_24h) console.log(`│ 📊 Volume 24h: ${formatValue(tokenData.volume_24h, 'volume').padEnd(66)} │`);
        if (tokenData.liquidity) console.log(`│ 💧 Liquidité: ${formatValue(tokenData.liquidity, 'marketcap').padEnd(67)} │`);
        
        if (tokenData.holder_count) console.log(`│ 👥 Holders: ${formatValue(tokenData.holder_count, 'number').padEnd(69)} │`);
        
        console.log(`│ 🔥 Méthode: FlareSolverr v3.3.21 + IPRoyal${' '.padEnd(52)} │`);
        console.log(`│ 🍪 Cookies: ${tokenData.cookies} | Session: ${tokenData.sessionUsed.substring(0, 20)}...${' '.padEnd(32)} │`);
        
        console.log('└─────────────────────────────────────────────────────────────────────────────────┘');
    }
    
    lastPrice = price;
    lastData = tokenData;
}

/**
 * Afficher les statistiques FlareSolverr
 */
function showStats() {
    const runTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
    const successRate = updateCount > 0 ? ((updateCount / (updateCount + errorCount)) * 100).toFixed(1) : '0';
    const avgReqPerSec = updateCount > 0 ? (updateCount / runTime).toFixed(2) : '0';
    
    console.log(`📊 [Stats FlareSolverr] Durée: ${runTime}s | Updates: ${updateCount} | Erreurs: ${errorCount} | Succès: ${successRate}%`);
    console.log(`⚡ [Perf] Vitesse: ${avgReqPerSec} req/sec | Session active: ${currentSession ? 'Oui' : 'Non'}`);
    if (lastPrice) {
        console.log(`💰 [Prix actuel] ${formatValue(lastPrice, 'price')}`);
    }
    console.log('');
}

/**
 * Nettoyer la session FlareSolverr
 */
async function cleanupSession() {
    if (currentSession) {
        try {
            console.log('🧹 [DEBUG] Nettoyage de la session FlareSolverr...');
            
            const payload = {
                cmd: "sessions.destroy",
                session: currentSession
            };
            
            await fetch(FLARESOLVERR_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                timeout: 30000
            });
            
            console.log('✅ Session FlareSolverr nettoyée');
        } catch (error) {
            console.error('❌ Erreur nettoyage session:', error.message);
        }
    }
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
        console.log(`❌ [${time}] Erreur FlareSolverr: ${error.message}`);
        
        // Pause après erreurs multiples
        if (errorCount > 0 && errorCount % 3 === 0) {
            console.log(`⏸️ Pause de 10s après ${errorCount} erreurs...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

/**
 * Démarrage avec initialisation FlareSolverr
 */
async function start() {
    try {
        console.log('✅ Initialisation FlareSolverr avec IPRoyal...');
        
        // Créer une session réutilisable
        await createFlareSolverrSession();
        
        console.log('🚀 Session FlareSolverr prête. Démarrage du monitoring...');
        
        // Premier appel immédiat
        await dataLoop();
        
        // Puis selon l'intervalle défini
        const interval = setInterval(dataLoop, UPDATE_INTERVAL);
        
        // Stats toutes les 30 secondes
        const statsInterval = setInterval(showStats, 30000);
        
        // Gestion Ctrl+C
        process.on('SIGINT', async () => {
            console.log('🛑 Arrêt en cours...');
            
            clearInterval(interval);
            clearInterval(statsInterval);
            
            // Nettoyer la session
            await cleanupSession();
            
            const runTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
            console.log('📊 RÉSUMÉ FINAL (FLARESOLVERR):');
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
            
            console.log('✅ Monitoring FlareSolverr arrêté!');
            process.exit(0);
        });
        
        console.log('💡 Appuyez sur Ctrl+C pour arrêter');
        console.log('📊 Stats automatiques toutes les 30 secondes');
        console.log(`⚡ Objectif: 1 requête toutes les 2 secondes avec FlareSolverr`);
        
    } catch (error) {
        console.error('❌ Erreur fatale initialisation FlareSolverr:', error.message);
        process.exit(1);
    }
}

// Démarrage
start(); 