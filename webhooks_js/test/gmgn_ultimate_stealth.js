#!/usr/bin/env node

/**
 * 🎯 SOLUTION ULTIME : PATCHRIGHT + COMPORTEMENT HUMAIN ULTRA-RÉALISTE
 * 
 * Combinaison de toutes les techniques les plus avancées :
 * - Patchright (Playwright patché)
 * - Mode navigateur VISIBLE (non-headless) 
 * - Simulation de comportement humain ultra-réaliste
 * - Délais aléatoires et mouvements de souris
 * - Rotation d'User-Agents et résolutions
 * - Gestion intelligente des challenges Cloudflare
 * 
 * 🚀 OBJECTIF: Solution définitive anti-détection
 */

import { chromium } from 'patchright';

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';
const UPDATE_INTERVAL = 3000; // 3 secondes pour être plus humain

// ⭐ IPRoyal proxy
const IPROYAL_HOSTNAME = 'geo.iproyal.com';
const IPROYAL_PORT = '12321';
const IPROYAL_USERNAME = 'j686absSWTWSkmcj';
const IPROYAL_PASSWORD = 'kjXBVH6xcLmWKew5';

// 🎭 Profils de navigateur ultra-réalistes
const BROWSER_PROFILES = [
    {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        platform: 'macOS',
        locale: 'en-US'
    },
    {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        platform: 'Win32',
        locale: 'en-US'
    },
    {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        viewport: { width: 1440, height: 900 },
        platform: 'macOS',
        locale: 'en-US'
    }
];

// Variables de suivi
let lastPrice = null;
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();
let browser = null;
let page = null;
let currentProfileIndex = 0;

console.log('🎭 SOLUTION ULTIME : STEALTH MAXIMUM AVEC PATCHRIGHT');
console.log('═'.repeat(80));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log(`⏱️ Mise à jour: toutes les ${UPDATE_INTERVAL/1000} secondes (délai humain)`);
console.log(`🔗 Source: GMGN.ai`);
console.log(`🌐 Proxy: IPRoyal Premium`);
console.log(`🛡️ Anti-détection: Patchright + Comportement humain + Mode visible`);
console.log(`🎭 Profils: ${BROWSER_PROFILES.length} profils de navigateur rotatifs`);
console.log('🚀 Initialisation ultra-stealth...');

/**
 * 🎲 Générer un délai aléatoire humain
 */
function humanDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 🎭 Obtenir le prochain profil de navigateur
 */
function getNextProfile() {
    const profile = BROWSER_PROFILES[currentProfileIndex];
    currentProfileIndex = (currentProfileIndex + 1) % BROWSER_PROFILES.length;
    return profile;
}

/**
 * 🐭 Simuler des mouvements de souris humains
 */
async function simulateHumanMouseMovement(page) {
    try {
        // Mouvements aléatoires de souris
        for (let i = 0; i < 3; i++) {
            const x = Math.random() * 1200 + 100;
            const y = Math.random() * 600 + 100;
            await page.mouse.move(x, y, { 
                steps: Math.floor(Math.random() * 10) + 5 
            });
            await page.waitForTimeout(humanDelay(200, 800));
        }
        
        // Scroll aléatoire
        await page.evaluate(() => {
            window.scrollBy(0, Math.random() * 200 - 100);
        });
        
        await page.waitForTimeout(humanDelay(500, 1500));
    } catch (error) {
        console.log(`⚠️ Erreur simulation souris: ${error.message}`);
    }
}

/**
 * 🌐 Initialiser le navigateur ultra-stealth
 */
async function initBrowser() {
    try {
        const profile = getNextProfile();
        console.log(`🎭 Profil sélectionné: ${profile.platform} - ${profile.viewport.width}x${profile.viewport.height}`);
        
        browser = await chromium.launch({
            headless: false, // MODE VISIBLE pour éviter la détection headless
            proxy: {
                server: `http://${IPROYAL_HOSTNAME}:${IPROYAL_PORT}`,
                username: IPROYAL_USERNAME,
                password: IPROYAL_PASSWORD
            },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--exclude-switches=enable-automation',
                '--disable-extensions-except=',
                '--disable-plugins-except=',
                '--start-maximized',
                '--disable-infobars',
                '--disable-notifications',
                '--disable-popup-blocking',
                '--disable-save-password-bubble',
                '--disable-translate',
                '--disable-features=VizDisplayCompositor,TranslateUI',
                '--no-first-run',
                '--no-default-browser-check',
                `--user-agent=${profile.userAgent}`
            ]
        });

        // Contexte avec profil ultra-réaliste
        const context = await browser.newContext({
            userAgent: profile.userAgent,
            viewport: profile.viewport,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            locale: profile.locale,
            timezoneId: 'America/New_York',
            colorScheme: 'light',
            permissions: ['geolocation', 'notifications'],
            geolocation: { latitude: 40.7128, longitude: -74.0060 }, // NYC
            extraHTTPHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': `"${profile.platform}"`,
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'DNT': '1'
            }
        });

        page = await context.newPage();
        
        // Scripts ultra-avancés pour masquer TOUTE trace d'automatisation
        await page.addInitScript(() => {
            // Supprimer les traces de webdriver
            delete navigator.__proto__.webdriver;
            delete navigator.webdriver;
            
            // Redéfinir toutes les propriétés suspectes
            Object.defineProperties(navigator, {
                webdriver: { get: () => undefined },
                plugins: { get: () => Array.from({ length: 5 }, (_, i) => ({ name: `Plugin${i}` })) },
                languages: { get: () => ['en-US', 'en'] },
                platform: { get: () => window.chrome ? 'Win32' : 'MacIntel' },
                hardwareConcurrency: { get: () => 8 },
                deviceMemory: { get: () => 8 },
                maxTouchPoints: { get: () => 0 }
            });
            
            // Supprimer console.debug et autres traces
            console.debug = console.info = () => {};
            
            // Override de window.chrome
            if (!window.chrome) {
                window.chrome = {
                    runtime: {},
                    loadTimes: () => ({
                        commitLoadTime: Date.now() / 1000 - Math.random() * 1000,
                        finishDocumentLoadTime: Date.now() / 1000 - Math.random() * 500,
                        startLoadTime: Date.now() / 1000 - Math.random() * 1500
                    }),
                    csi: () => ({ pageT: Date.now() - Math.random() * 1000 })
                };
            }
            
            // Masquer les propriétés Playwright
            const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
            Object.getOwnPropertyDescriptor = function(obj, prop) {
                if (prop === 'webdriver' || prop.includes('playwright') || prop.includes('__playwright')) {
                    return undefined;
                }
                return originalGetOwnPropertyDescriptor.apply(this, arguments);
            };
            
            // Override permissions API
            const originalQuery = navigator.permissions.query;
            navigator.permissions.query = function(params) {
                if (params.name === 'notifications') {
                    return Promise.resolve({ state: 'default' });
                }
                return originalQuery.apply(this, arguments);
            };
        });

        console.log('✅ Navigateur ultra-stealth initialisé !');
        console.log('🎭 Mode VISIBLE activé pour éviter la détection headless');
        console.log('🛡️ Scripts anti-détection ultra-avancés injectés');
        
        return true;
    } catch (error) {
        console.error('❌ Erreur initialisation:', error.message);
        return false;
    }
}

/**
 * 🌐 Méthode ultra-stealth pour récupérer les données
 */
async function fetchTokenDataUltraStealth() {
    try {
        console.log(`🔍 [UltraStealth] Navigation humaine vers GMGN...`);
        
        // Étape 1: Aller sur la page principale pour établir une session
        await page.goto('https://gmgn.ai', { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        await page.waitForTimeout(humanDelay(2000, 4000));
        
        // Simuler un comportement humain sur la page principale
        await simulateHumanMouseMovement(page);
        
        // Étape 2: Vérifier s'il y a un challenge Cloudflare
        let title = await page.title();
        let content = await page.content();
        
        if (title.includes('Just a moment') || content.includes('cf-challenge')) {
            console.log('🛡️ Challenge Cloudflare détecté, résolution automatique...');
            
            // Attendre et simuler un comportement humain pendant le challenge
            let attempts = 0;
            while ((title.includes('Just a moment') || content.includes('cf-challenge')) && attempts < 10) {
                await page.waitForTimeout(humanDelay(3000, 6000));
                await simulateHumanMouseMovement(page);
                title = await page.title();
                content = await page.content();
                attempts++;
                console.log(`🔄 Tentative ${attempts}/10 de résolution du challenge...`);
            }
        }
        
        console.log('✅ Page principale chargée, navigation vers API...');
        
        // Étape 3: Naviguer vers l'endpoint API avec délai humain
        await page.waitForTimeout(humanDelay(1000, 3000));
        
        const apiUrl = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;
        const response = await page.goto(apiUrl, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        if (response.status() === 403) {
            throw new Error(`HTTP 403 - Challenge Cloudflare non résolu`);
        }
        
        if (response.status() !== 200) {
            throw new Error(`HTTP ${response.status()}`);
        }
        
        // Étape 4: Extraire les données JSON avec simulation humaine
        await simulateHumanMouseMovement(page);
        
        const jsonData = await page.evaluate(() => {
            try {
                const bodyText = document.body.innerText || document.body.textContent;
                return JSON.parse(bodyText);
            } catch (e) {
                return null;
            }
        });
        
        if (!jsonData || typeof jsonData.price === 'undefined') {
            throw new Error('Données JSON non disponibles');
        }
        
        console.log(`✅ [UltraStealth] Prix récupéré: ${jsonData.price}`);
        
        return {
            ...jsonData,
            timestamp: Date.now(),
            method: 'UltraStealth + Navigation humaine'
        };
        
    } catch (error) {
        throw new Error(`UltraStealth: ${error.message}`);
    }
}

/**
 * Formater une valeur
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
        default:
            return String(value);
    }
}

/**
 * Afficher les données
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
    
    console.log(`${changeIcon} [${time}] ${formatValue(price, 'price')}${priceChangeInfo} [${tokenData.method}]`);
    
    if (updateCount % 5 === 0) {
        console.log('┌───────────────────────────────────────────────────────────────────────────┐');
        console.log('│ 🎭 CONTOURNEMENT RÉUSSI - CLOUDFLARE BATTU !                              │');
        console.log('├───────────────────────────────────────────────────────────────────────────┤');
        console.log(`│ 💰 Prix: ${formatValue(price, 'price').padEnd(69)} │`);
        console.log(`│ 🛡️ Méthode: ${(tokenData.method).padEnd(60)} │`);
        console.log(`│ 🌐 Proxy: IPRoyal Premium + UltraStealth                                  │`);
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
    
    console.log(`📊 [Stats UltraStealth] Durée: ${runTime}s | Updates: ${updateCount} | Erreurs: ${errorCount} | Succès: ${successRate}%`);
    console.log(`⚡ [Perf UltraStealth] Vitesse: ${avgReqPerSec} req/sec (délais humains)`);
    if (lastPrice) {
        console.log(`💰 [Prix actuel] ${formatValue(lastPrice, 'price')}`);
    }
    console.log('');
}

/**
 * Boucle principale avec délais humains
 */
async function dataLoop() {
    try {
        const tokenData = await fetchTokenDataUltraStealth();
        displayTokenData(tokenData);
        
    } catch (error) {
        errorCount++;
        const time = new Date().toLocaleTimeString('fr-FR', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        console.log(`❌ [${time}] Erreur UltraStealth: ${error.message}`);
        
        // Redémarrage intelligent
        if (errorCount % 2 === 0) {
            console.log(`🔄 Changement de profil navigateur après ${errorCount} erreurs...`);
            await cleanupBrowser();
            const reInitialized = await initBrowser();
            if (reInitialized && page) {
                await page.waitForTimeout(humanDelay(2000, 5000));
            } else if (!reInitialized) {
                console.error('❌ Échec de la réinitialisation du navigateur après erreurs. Arrêt de la tentative actuelle.');
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
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
        console.log(`⚠️ Erreur nettoyage: ${error.message}`);
    }
}

/**
 * Démarrage principal
 */
async function start() {
    const browserInitialized = await initBrowser();
    
    if (!browserInitialized) {
        console.error('❌ Impossible d\'initialiser le navigateur UltraStealth');
        process.exit(1);
    }
    
    console.log('✅ UltraStealth configuré avec IPRoyal');
    console.log('🎭 Mode VISIBLE + Comportement humain + Délais réalistes');
    
    // Premier appel avec délai
    await page.waitForTimeout(humanDelay(2000, 4000));
    await dataLoop();
    
    // Puis avec des intervalles humains variables
    let interval;
    function scheduleNext() {
        const delay = humanDelay(UPDATE_INTERVAL, UPDATE_INTERVAL + 2000);
        interval = setTimeout(async () => {
            await dataLoop();
            scheduleNext();
        }, delay);
    }
    
    scheduleNext();
    
    // Stats toutes les 60 secondes
    const statsInterval = setInterval(showStats, 60000);
    
    // Gestion Ctrl+C
    process.on('SIGINT', async () => {
        console.log('🛑 Arrêt UltraStealth...');
        
        clearTimeout(interval);
        clearInterval(statsInterval);
        
        await cleanupBrowser();
        
        const runTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        console.log('📊 RÉSUMÉ FINAL (ULTRASTEALTH):');
        console.log(`  ⏱️ Durée totale: ${runTime} secondes`);
        console.log(`  📈 Mises à jour réussies: ${updateCount}`);
        console.log(`  ❌ Erreurs: ${errorCount}`);
        
        if (updateCount > 0) {
            const successRate = ((updateCount / (updateCount + errorCount)) * 100).toFixed(1);
            console.log(`  ✅ Taux de succès: ${successRate}%`);
        }
        
        if (lastPrice) {
            console.log(`  💰 Dernier prix: ${formatValue(lastPrice, 'price')}`);
        }
        
        console.log('✅ UltraStealth arrêté !');
        process.exit(0);
    });
    
    console.log('💡 Appuyez sur Ctrl+C pour arrêter');
    console.log('🎭 CLOUDFLARE VA ÊTRE BATTU ! Mode UltraStealth actif !');
}

// Démarrage
start().catch(error => {
    console.error('❌ Erreur fatale UltraStealth:', error.message);
    process.exit(1);
}); 