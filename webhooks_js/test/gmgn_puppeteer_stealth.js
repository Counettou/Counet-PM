#!/usr/bin/env node

/**
 * 🎯 CONTOURNEMENT AVANCÉ CLOUDFLARE AVEC PUPPETEER-EXTRA-STEALTH - MODE HAUTE FRÉQUENCE
 * 
 * Utilisation de Puppeteer-Extra avec le plugin Stealth pour une indétectabilité maximale.
 * - Lancement d'une NOUVELLE INSTANCE de navigateur pour CHAQUE requête pour maximiser la rotation d'IP.
 * - Plugin Stealth: Applique de multiples correctifs pour masquer l'automatisation.
 * - Mode navigateur VISIBLE (non-headless).
 * - Proxy IPRoyal Premium (geo.iproyal.com pour rotation automatique).
 * 
 * 🚀 OBJECTIF: Accéder à l'API GMGN malgré Cloudflare, avec rafraîchissement rapide.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Appliquer le plugin Stealth
puppeteer.use(StealthPlugin());

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump'; // chat
const UPDATE_INTERVAL = 1000; // 🎯 Objectif: 1000ms = 1 seconde (1 req/sec)

// ⭐ IPRoyal proxy (identique à gmgn_realtime_price.js)
const IPROYAL_HOSTNAME = 'geo.iproyal.com';
const IPROYAL_PORT = '12321';
const IPROYAL_USERNAME = 'j686absSWTWSkmcj';
const IPROYAL_PASSWORD = 'kjXBVH6xcLmWKew5';

// Variables de suivi
let lastPrice = null;
let lastData = null; // Ajouté pour la fonction displayTokenData détaillée
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();
// Suppression des variables globales browser, page, currentProfileIndex

console.log('🕵️‍♂️ PUPPETEER-EXTRA-STEALTH - MODE HAUTE FRÉQUENCE');
console.log('═'.repeat(80));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log(`⏱️ Intervalle de MàJ visé: ${UPDATE_INTERVAL/1000} seconde(s)`);
console.log(`🔗 Source: GMGN.ai`);
console.log(`🌐 Proxy: IPRoyal Premium (rotation par requête via geo.iproyal.com)`);
console.log('🚀 Démarrage...');

function humanDelay(min = 500, max = 1500) { // Délais réduits pour mode rapide
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simplification : suppression de getNextProfile et BROWSER_PROFILES pour l'instant
// Un User-Agent générique sera utilisé, le plugin Stealth gère beaucoup de choses.

async function simulateHumanMouseMovement(page) {
    try {
        await page.mouse.move(Math.random() * 500 + 100, Math.random() * 400 + 100, { steps: 5 }); // Moins d'étapes
        await new Promise(resolve => setTimeout(resolve, humanDelay(100, 200)));
        await page.evaluate(() => {
            window.scrollBy(0, Math.random() * 50 - 25);
        });
    } catch (error) {
        console.warn(`⚠️ Erreur simulation souris: ${error.message}`);
    }
}

async function initStealthBrowserInstance() {
    let browser = null;
    try {
        // Utilisation d'un User-Agent commun, Stealth s'occupe du reste.
        const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

        browser = await puppeteer.launch({
            headless: false,
            executablePath: puppeteer.executablePath(),
            args: [
                `--proxy-server=http://${IPROYAL_HOSTNAME}:${IPROYAL_PORT}`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
                `--user-agent=${userAgent}`,
                '--window-size=1280,800', // Taille de fenêtre standard
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = (await browser.pages())[0] || await browser.newPage();
        
        await page.authenticate({ 
            username: IPROYAL_USERNAME, 
            password: IPROYAL_PASSWORD 
        });
        
        await page.setViewport({ width: 1280, height: 800 });
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8' // Langue commune
        });
        
        // console.log('✅ Instance de navigateur furtif initialisée.');
        return { browser, page };

    } catch (error) {
        console.error('❌ Erreur initStealthBrowserInstance:', error.message);
        if (browser) {
            try { await browser.close(); } catch (e) { /* ignoré */ }
        }
        throw error; // Projeter pour que dataLoop le gère
    }
}

async function closeStealthBrowserInstance(browser) {
    if (browser) {
        try {
            await browser.close();
            // console.log('🚮 Instance de navigateur fermée.');
        } catch (error) {
            console.error('⚠️ Erreur lors de la fermeture du navigateur:', error.message);
        }
    }
}

async function fetchSingleTokenDataInstance() {
    let browser = null;
    let page = null;

    try {
        ({ browser, page } = await initStealthBrowserInstance());
        
        // console.log(`📡 Accès à GMGN.ai pour le token ${TARGET_TOKEN}...`);
        
        await page.goto('https://gmgn.ai/sol/' + TARGET_TOKEN, { waitUntil: 'networkidle2', timeout: 30000 }); // Timeout augmenté pour la première charge
        await new Promise(resolve => setTimeout(resolve, humanDelay(1000, 2000))); // Délai après chargement
        // await simulateHumanMouseMovement(page); // Optionnel, peut ralentir

        const pageTitle = await page.title();
        const pageContent = await page.content();

        if (pageTitle.includes('Just a moment') || pageContent.includes('cf-challenge') || pageContent.includes('Checking your browser')) {
            console.log('🛡️ Challenge Cloudflare détecté. Attente (5-10s)...');
            await new Promise(resolve => setTimeout(resolve, humanDelay(5000, 10000)));
            // await simulateHumanMouseMovement(page); // Optionnel
        }
        
        const apiUrl = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;
        const jsonData = await page.evaluate(async (url, tokenAddr) => {
            try {
                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': 'https://gmgn.ai/sol/' + tokenAddr
                    }
                });
                if (!response.ok) {
                    return { error: true, status: response.status, statusText: response.statusText, text: await response.text() };
                }
                return await response.json();
            } catch (e) {
                return { error: true, message: e.message, type: 'fetch-evaluate' };
            }
        }, apiUrl, TARGET_TOKEN);

        await closeStealthBrowserInstance(browser);
        browser = null; // S'assurer qu'il est null après fermeture

        if (jsonData.error) {
            let errorMsg = `Erreur API: Status ${jsonData.status} - ${jsonData.statusText}.`;
            if(jsonData.text) errorMsg += ` Réponse: ${jsonData.text.substring(0,100)}`;
            else if(jsonData.message) errorMsg += ` Message: ${jsonData.message}`;
            
            if (jsonData.status === 403) {
                throw new Error(`Accès API bloqué (403). Cloudflare? Proxy? Contenu: ${jsonData.text ? jsonData.text.substring(0,100) : 'N/A'}`);
            }
            throw new Error(errorMsg);
        }
        
        if (!jsonData || typeof jsonData.price === 'undefined') {
            throw new Error('Format de données API incorrect ou prix non trouvé.');
        }

        // console.log(`✅ Prix récupéré: ${jsonData.price}`);
        return { ...jsonData, timestamp: Date.now(), proxyUsed: `IPRoyal (geo.iproyal.com)` };

    } catch (error) {
        // console.error(`❌ Erreur fetchSingleTokenDataInstance: ${error.message}`);
        if (page) {
            const errorScreenshotPath = `webhooks_js/logs/error_puppeteer_${Date.now()}.png`;
            try {
                 await page.screenshot({ path: errorScreenshotPath });
                 console.log(`📸 Capture d'écran de l'erreur: ${errorScreenshotPath}`);
            } catch (e) {
                console.warn(`⚠️ Impossible de prendre une capture d'écran: ${e.message}`);
            }
        }
        if (browser) { // S'assurer que le navigateur est fermé en cas d'erreur
            await closeStealthBrowserInstance(browser);
        }
        throw error; // Projeter pour que dataLoop le gère
    }
}

// Les fonctions formatValue, displayTokenData, showStats sont conservées et adaptées de gmgn_realtime_price.js si besoin

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
            return Number(value).toLocaleString('fr-FR');
        case 'timestamp': // Inutilisé ici mais conservé pour info
            return new Date(value * 1000).toLocaleString('fr-FR');
        default:
            return String(value);
    }
}

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
        
        if (Math.abs(changePercent) > 0.000001) { // Seuil plus sensible
            changeIcon = change >= 0 ? '🟢' : '🔴';
            const changeStr = change >= 0 ? `+${change.toFixed(10)}` : change.toFixed(10);
            const percentStr = change >= 0 ? `+${changePercent.toFixed(4)}%` : `${changePercent.toFixed(4)}%`;
            priceChangeInfo = ` (${changeStr} | ${percentStr})`;
        }
    }
    
    console.log(`${changeIcon} [${time}] ${formatValue(price, 'price')}${priceChangeInfo} [${tokenData.proxyUsed || 'IPRoyal'}]`);
    
    const shouldShowDetails = (lastData === null) || 
                             (updateCount % 60 === 0) || // Toutes les minutes (60 req si 1 req/s)
                             (lastPrice && Math.abs((price - lastPrice) / lastPrice) > 0.005); // >0.5%
    
    if (shouldShowDetails) {
        console.log('┌───────────────────────────────────────────────────────────────────────────┐');
        console.log('│ 📊 DONNÉES COMPLÈTES (GMGN via Puppeteer-Stealth)                         │');
        console.log('├───────────────────────────────────────────────────────────────────────────┤');
        if (tokenData.symbol) console.log(`│ 🏷️  Symbole: ${String(tokenData.symbol).padEnd(66)} │`);
        if (tokenData.name) console.log(`│ 📛 Nom: ${String(tokenData.name).padEnd(70)} │`);
        console.log(`│ 💰 Prix: ${formatValue(price, 'price').padEnd(69)} │`);
        if (tokenData.market_cap) console.log(`│ 📈 Market Cap: ${formatValue(tokenData.market_cap, 'marketcap').padEnd(62)} │`);
        if (tokenData.volume_24h) console.log(`│ 📊 Volume 24h: ${formatValue(tokenData.volume_24h, 'volume').padEnd(62)} │`);
        if (tokenData.liquidity) console.log(`│ 💧 Liquidité: ${formatValue(tokenData.liquidity, 'marketcap').padEnd(63)} │`);
        if (tokenData.holder_count) console.log(`│ 👥 Holders: ${formatValue(tokenData.holder_count, 'number').padEnd(65)} │`);
        console.log(`│ 🌐 Source: ${String(tokenData.proxyUsed || 'IPRoyal').padEnd(63)} │`);
        console.log('└───────────────────────────────────────────────────────────────────────────┘');
    }
    
    lastPrice = price;
    lastData = tokenData; // Mise à jour de lastData
}

function showStats() {
    const runTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
    const successRate = (updateCount + errorCount) > 0 ? ((updateCount / (updateCount + errorCount)) * 100).toFixed(1) : 'N/A';
    const avgReqPerSecActual = runTime > 0 ? (updateCount / runTime).toFixed(2) : '0';
    
    console.log(`📊 [Stats] Durée: ${runTime}s | Succès: ${updateCount} | Erreurs: ${errorCount} | Taux Succès: ${successRate}%`);
    console.log(`⚡ [Perf] Vitesse réelle: ${avgReqPerSecActual} req/sec (Visé: ${(1000/UPDATE_INTERVAL).toFixed(1)} req/s)`);
    if (lastPrice) {
        console.log(`💰 [Dernier Prix] ${formatValue(lastPrice, 'price')}`);
    }
    console.log(''); // Ligne vide pour espacer
}

async function dataLoop() {
    try {
        const tokenData = await fetchSingleTokenDataInstance(); // Appelle la nouvelle fonction
        displayTokenData(tokenData);
        
    } catch (error) {
        errorCount++;
        const time = new Date().toLocaleTimeString('fr-FR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        console.log(`❌ [${time}] Erreur principale: ${error.message}`);
        // Pause plus longue après une série d'erreurs
        if (errorCount > 0 && errorCount % 3 === 0) {
            const pauseDuration = 5000; // 5 secondes
            console.log(`⏸️ Trop d'erreurs. Pause de ${pauseDuration/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, pauseDuration));
        }
    }
}

async function start() {
    startTime = Date.now(); // Réinitialiser l'heure de début
    
    // Premier appel immédiat pour vérifier la configuration
    console.log("🔄 Premier appel pour test...");
    await dataLoop(); 
    
    // Boucle principale
    const mainInterval = setInterval(dataLoop, UPDATE_INTERVAL);
    
    // Stats toutes les 30 secondes
    const statsInterval = setInterval(showStats, 30000);
    
    process.on('SIGINT', async () => {
        console.log('🛑 Arrêt en cours...');
        clearInterval(mainInterval);
        clearInterval(statsInterval);
        
        // Pas besoin de cleanupStealthBrowser(true) ici car chaque instance est fermée individuellement.
        
        showStats(); // Afficher les stats finales
        console.log('✅ Script arrêté.');
        process.exit(0);
    });
    
    console.log('💡 Appuyez sur Ctrl+C pour arrêter.');
    console.log('📊 Stats automatiques toutes les 30 secondes.');
}

// Démarrage du script
start().catch(error => {
    console.error('❌ Erreur fatale au démarrage du script:', error.message, error.stack);
    process.exit(1);
}); 