#!/usr/bin/env node

/**
 * 🎯 CONTOURNEMENT CLOUDFLARE AVANCÉ AVEC PATCHRIGHT
 * 
 * Solution la plus avancée : Patchright (Playwright patché)
 * - Supprime Runtime.enable leak
 * - Patches Console.enable leak  
 * - Modifie Command Flags automatiquement
 * - Interaction avec Closed Shadow Roots
 * - Passe Cloudflare, Kasada, Akamai, Shape/F5, etc.
 * 
 * 🚀 OBJECTIF: Contourner définitivement l'erreur 403
 */

import { chromium } from 'patchright';

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';
const UPDATE_INTERVAL = 1000; // 1 seconde

// ⭐ IPRoyal proxy (on garde le proxy premium)
const IPROYAL_HOSTNAME = 'geo.iproyal.com';
const IPROYAL_PORT = '12321';
const IPROYAL_USERNAME = 'j686absSWTWSkmcj';
const IPROYAL_PASSWORD = 'kjXBVH6xcLmWKew5';

const PROXY_STRING = `http://${IPROYAL_USERNAME}:${IPROYAL_PASSWORD}@${IPROYAL_HOSTNAME}:${IPROYAL_PORT}`;

// Variables de suivi
let lastPrice = null;
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();
let browser = null;
let page = null;

console.log('🎭 CONTOURNEMENT CLOUDFLARE AVANCÉ AVEC PATCHRIGHT');
console.log('═'.repeat(80));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log(`⏱️ Mise à jour: toutes les ${UPDATE_INTERVAL/1000} seconde(s)`);
console.log(`🔗 Source: GMGN.ai`);
console.log(`🌐 Proxy: IPRoyal + Patchright`);
console.log(`🛡️ Anti-détection: Runtime.enable patch + Command flags`);
console.log('🚀 Initialisation du navigateur patché...');

/**
 * 🌐 Initialiser le navigateur Patchright avec maximum de stealth
 */
async function initBrowser() {
    try {
        console.log('🎭 Lancement de Chromium patché avec Patchright...');
        
        browser = await chromium.launch({
            headless: true, // Mode headless pour la performance
            proxy: {
                server: `http://${IPROYAL_HOSTNAME}:${IPROYAL_PORT}`,
                username: IPROYAL_USERNAME,
                password: IPROYAL_PASSWORD
            },
            args: [
                // Patchright applique déjà ses propres patches, mais on ajoute quelques flags
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions-file-access-check',
                '--disable-extensions-http-throttling',
                '--disable-extensions-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                // Anti-détection supplémentaire
                '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });

        // Créer un contexte avec des permissions étendues
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            locale: 'en-US',
            timezoneId: 'America/New_York',
            permissions: ['geolocation'],
            extraHTTPHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        page = await context.newPage();
        
        // Scripts d'initialisation avancés pour masquer l'automatisation
        await page.addInitScript(() => {
            // Masquer webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // Masquer les propriétés du navigateur automatisé
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Deno.PermissionState.denied }) :
                    originalQuery(parameters)
            );

            // Remove console.debug
            console.debug = () => {};
        });

        console.log('✅ Navigateur Patchright initialisé avec succès !');
        console.log('🛡️ Patches appliqués : Runtime.enable, Console.enable, Command flags');
        
        return true;
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation du navigateur:', error.message);
        return false;
    }
}

/**
 * 🌐 Récupérer données avec Patchright (méthode avancée)
 */
async function fetchTokenDataWithPatchright() {
    try {
        const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;
        
        console.log(`🔍 [Patchright] Requête vers: ${url}`);
        
        // Navigation avec gestion des challenges Cloudflare
        const response = await page.goto(url, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        // Vérifier si on a un challenge Cloudflare
        const title = await page.title();
        const content = await page.content();
        
        if (title.includes('Just a moment') || content.includes('cf-challenge') || content.includes('cloudflare')) {
            console.log('🛡️ Challenge Cloudflare détecté, en attente...');
            // Attendre que le challenge soit résolu automatiquement par Patchright
            await page.waitForSelector('body', { timeout: 30000 });
            await page.waitForTimeout(5000); // Attente supplémentaire
        }
        
        // Vérifier le statut de la réponse
        if (response.status() === 403) {
            throw new Error(`HTTP 403 - Cloudflare bloque encore la requête`);
        }
        
        if (response.status() !== 200) {
            throw new Error(`HTTP ${response.status()}`);
        }
        
        // Extraire les données JSON de la page
        const jsonData = await page.evaluate(() => {
            try {
                const bodyText = document.body.innerText || document.body.textContent;
                return JSON.parse(bodyText);
            } catch (e) {
                // Si ce n'est pas du JSON pur, chercher dans le HTML
                const scripts = document.querySelectorAll('script');
                for (let script of scripts) {
                    if (script.textContent && script.textContent.includes('price')) {
                        try {
                            return JSON.parse(script.textContent);
                        } catch (e2) {
                            continue;
                        }
                    }
                }
                return null;
            }
        });
        
        if (!jsonData || typeof jsonData.price === 'undefined') {
            // Fallback : essayer d'extraire via l'API directement
            const apiResponse = await page.evaluate(async (targetToken) => {
                try {
                    const response = await fetch(`https://gmgn.ai/defi/quotation/v1/tokens/sol/${targetToken}`, {
                        headers: {
                            'Accept': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    });
                    const data = await response.json();
                    return data;
                } catch (e) {
                    return null;
                }
            }, TARGET_TOKEN);
            
            if (apiResponse && apiResponse.price) {
                return {
                    ...apiResponse,
                    timestamp: Date.now(),
                    method: 'Patchright + fetch API'
                };
            }
            
            throw new Error('Données non disponibles via Patchright');
        }
        
        console.log(`✅ [Patchright] Prix récupéré: ${jsonData.price}`);
        
        return {
            ...jsonData,
            timestamp: Date.now(),
            method: 'Patchright navigation'
        };
        
    } catch (error) {
        throw new Error(`Patchright: ${error.message}`);
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
        default:
            return String(value);
    }
}

/**
 * Afficher les données avec info Patchright
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
    
    // Affichage avec méthode utilisée
    console.log(`${changeIcon} [${time}] ${formatValue(price, 'price')}${priceChangeInfo} [${tokenData.method}]`);
    
    if (updateCount % 10 === 0) {
        console.log('┌───────────────────────────────────────────────────────────────────────────┐');
        console.log('│ 🎭 DONNÉES VIA PATCHRIGHT (CLOUDFLARE CONTOURNÉ)                          │');
        console.log('├───────────────────────────────────────────────────────────────────────────┤');
        console.log(`│ 💰 Prix: ${formatValue(price, 'price').padEnd(69)} │`);
        console.log(`│ 🛡️ Méthode: ${(tokenData.method).padEnd(65)} │`);
        console.log(`│ 🌐 Proxy: IPRoyal + Patchright patches                                    │`);
        console.log('└───────────────────────────────────────────────────────────────────────────┘');
    }
    
    lastPrice = price;
}

/**
 * Afficher les statistiques
 */
function showStats() {
    const runTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
    const successRate = updateCount > 0 ? ((updateCount / (updateCount + errorCount)) * 100).toFixed(1) : '0';
    const avgReqPerSec = updateCount > 0 ? (updateCount / runTime).toFixed(2) : '0';
    
    console.log(`📊 [Stats Patchright] Durée: ${runTime}s | Updates: ${updateCount} | Erreurs: ${errorCount} | Succès: ${successRate}%`);
    console.log(`⚡ [Perf Patchright] Vitesse: ${avgReqPerSec} req/sec`);
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
        const tokenData = await fetchTokenDataWithPatchright();
        displayTokenData(tokenData);
        
    } catch (error) {
        errorCount++;
        const time = new Date().toLocaleTimeString('fr-FR', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        console.log(`❌ [${time}] Erreur Patchright: ${error.message}`);
        
        // Si erreur persistante, redémarrer le navigateur
        if (errorCount % 3 === 0) {
            console.log(`🔄 Redémarrage du navigateur après ${errorCount} erreurs...`);
            await cleanupBrowser();
            await initBrowser();
        }
    }
}

/**
 * Nettoyage du navigateur
 */
async function cleanupBrowser() {
    try {
        if (page) {
            await page.close();
            page = null;
        }
        if (browser) {
            await browser.close();
            browser = null;
        }
    } catch (error) {
        console.log(`⚠️ Erreur lors du nettoyage: ${error.message}`);
    }
}

/**
 * Démarrage principal
 */
async function start() {
    const browserInitialized = await initBrowser();
    
    if (!browserInitialized) {
        console.error('❌ Impossible d\'initialiser le navigateur Patchright');
        process.exit(1);
    }
    
    console.log('✅ Patchright configuré avec IPRoyal');
    
    // Premier appel
    await dataLoop();
    
    // Puis selon l'intervalle
    const interval = setInterval(dataLoop, UPDATE_INTERVAL);
    
    // Stats toutes les 30 secondes
    const statsInterval = setInterval(showStats, 30000);
    
    // Gestion Ctrl+C
    process.on('SIGINT', async () => {
        console.log('🛑 Arrêt en cours...');
        
        clearInterval(interval);
        clearInterval(statsInterval);
        
        await cleanupBrowser();
        
        const runTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        console.log('📊 RÉSUMÉ FINAL (PATCHRIGHT):');
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
        
        console.log('✅ Monitoring Patchright arrêté!');
        process.exit(0);
    });
    
    console.log('💡 Appuyez sur Ctrl+C pour arrêter');
    console.log('🎭 Contournement Cloudflare actif avec Patchright !');
}

// Démarrage
start().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
}); 