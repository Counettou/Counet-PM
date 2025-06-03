#!/usr/bin/env node

/**
 * 🔥 TEST FLARESOLVERR EN DEUX ÉTAPES
 * 1. Visiter la page principale pour obtenir les cookies/session
 * 2. Faire la requête API avec la session établie
 */

import fetch from 'node-fetch';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';
const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';
const API_URL = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;

const PROXY_CONFIG = {
    url: 'http://j686absSWTWSkmcj:kjXBVH6xcLmWKew5@geo.iproyal.com:12321'
};

let sessionId = null;

async function createSession() {
    console.log('🔥 ÉTAPE 1: CRÉATION DE SESSION FLARESOLVERR');
    console.log('═'.repeat(60));
    
    try {
        const payload = {
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
            body: JSON.stringify(payload),
            timeout: 70000
        });
        
        const result = await response.json();
        
        if (result.status === 'ok') {
            sessionId = result.session;
            console.log(`✅ Session créée: ${sessionId}`);
            return sessionId;
        } else {
            throw new Error(`Erreur création session: ${result.message}`);
        }
        
    } catch (error) {
        console.error('❌ Erreur création session:', error.message);
        throw error;
    }
}

async function visitMainPage() {
    console.log('\n🔥 ÉTAPE 2: VISITE DE LA PAGE PRINCIPALE GMGN');
    console.log('═'.repeat(60));
    
    try {
        const payload = {
            cmd: "request.get",
            url: "https://gmgn.ai/",
            session: sessionId,
            maxTimeout: 60000,
            proxy: PROXY_CONFIG
        };
        
        const response = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 70000
        });
        
        const result = await response.json();
        
        if (result.status === 'ok') {
            console.log(`✅ Page principale visitée: ${result.solution.status}`);
            console.log(`✅ Cookies reçus: ${result.solution.cookies?.length || 0}`);
            console.log(`✅ User-Agent: ${result.solution.userAgent}`);
            return true;
        } else {
            throw new Error(`Erreur visite page: ${result.message}`);
        }
        
    } catch (error) {
        console.error('❌ Erreur visite page:', error.message);
        throw error;
    }
}

async function callAPI() {
    console.log('\n🔥 ÉTAPE 3: APPEL API AVEC SESSION ÉTABLIE');
    console.log('═'.repeat(60));
    console.log(`🎯 URL API: ${API_URL}`);
    
    try {
        const payload = {
            cmd: "request.get",
            url: API_URL,
            session: sessionId,
            maxTimeout: 60000,
            proxy: PROXY_CONFIG,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://gmgn.ai/',
                'Origin': 'https://gmgn.ai',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        };
        
        console.log('📤 Requête API avec session...');
        
        const response = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 70000
        });
        
        const result = await response.json();
        
        console.log('📥 Réponse API:');
        console.log('  Status:', result.status);
        console.log('  Message:', result.message);
        
        if (result.status === 'ok' && result.solution) {
            const solution = result.solution;
            console.log('  HTTP Status:', solution.status);
            console.log('  Content-Type:', solution.headers?.['content-type'] || 'N/A');
            console.log('  Response length:', solution.response?.length || 0);
            
            if (solution.response) {
                const preview = solution.response.substring(0, 500);
                console.log('  Response preview:', preview);
                
                // Essayer de parser si c'est du JSON
                if (solution.response.trim().startsWith('{') || solution.response.trim().startsWith('[')) {
                    try {
                        const data = JSON.parse(solution.response);
                        console.log('🎉 SUCCESS - JSON PARSÉ:');
                        console.log('  Code:', data.code || 'N/A');
                        console.log('  Message:', data.msg || 'N/A');
                        
                        if (data.data) {
                            console.log('  Prix:', data.data.price || 'N/A');
                            console.log('  Symbol:', data.data.symbol || 'N/A');
                            console.log('  Name:', data.data.name || 'N/A');
                            console.log('  Market Cap:', data.data.market_cap || 'N/A');
                            console.log('  Volume 24h:', data.data.volume_24h || 'N/A');
                            console.log('  Holders:', data.data.holder_count || 'N/A');
                        }
                        
                        return data;
                    } catch (parseError) {
                        console.log('❌ Erreur parsing JSON:', parseError.message);
                    }
                } else {
                    console.log('❌ Réponse HTML reçue au lieu de JSON');
                    console.log('🔍 Cookies dans la réponse:', solution.cookies?.length || 0);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur API:', error.message);
    }
}

async function cleanup() {
    if (sessionId) {
        console.log('\n🧹 NETTOYAGE DE LA SESSION');
        try {
            const payload = {
                cmd: "sessions.destroy",
                session: sessionId
            };
            
            await fetch(FLARESOLVERR_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                timeout: 30000
            });
            
            console.log('✅ Session nettoyée');
        } catch (error) {
            console.error('❌ Erreur nettoyage:', error.message);
        }
    }
}

async function runFullTest() {
    try {
        await createSession();
        await visitMainPage();
        await callAPI();
    } catch (error) {
        console.error('❌ Test échoué:', error.message);
    } finally {
        await cleanup();
    }
}

runFullTest(); 