#!/usr/bin/env node

/**
 * 🔥 TEST FLARESOLVERR AVEC EN-TÊTES API
 */

import fetch from 'node-fetch';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';
const TARGET_URL = 'https://gmgn.ai/defi/quotation/v1/tokens/sol/5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';

const PROXY_CONFIG = {
    url: 'http://j686absSWTWSkmcj:kjXBVH6xcLmWKew5@geo.iproyal.com:12321'
};

async function testWithHeaders() {
    console.log('🔥 TEST FLARESOLVERR AVEC EN-TÊTES API');
    console.log('═'.repeat(50));
    
    try {
        const payload = {
            cmd: "request.get",
            url: TARGET_URL,
            maxTimeout: 60000,
            proxy: PROXY_CONFIG,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://gmgn.ai/',
                'Origin': 'https://gmgn.ai',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        };
        
        console.log('📤 Requête avec en-têtes API...');
        
        const response = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 70000
        });
        
        const result = await response.json();
        
        console.log('📥 Réponse:');
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
                        console.log('✅ JSON PARSÉ:');
                        console.log('  Prix:', data.price || 'N/A');
                        console.log('  Symbol:', data.symbol || 'N/A');
                        console.log('  Name:', data.name || 'N/A');
                        return data;
                    } catch (parseError) {
                        console.log('❌ Erreur parsing JSON:', parseError.message);
                    }
                } else {
                    console.log('❌ Réponse HTML reçue au lieu de JSON');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

// Test aussi l'URL de base GMGN
async function testBaseURL() {
    console.log('\n🔍 TEST URL DE BASE GMGN...');
    
    const basePayload = {
        cmd: "request.get",
        url: "https://gmgn.ai/",
        maxTimeout: 30000,
        proxy: PROXY_CONFIG
    };
    
    try {
        const response = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(basePayload),
            timeout: 35000
        });
        
        const result = await response.json();
        console.log('  Base URL Status:', result.status);
        console.log('  Base URL Message:', result.message);
        
        if (result.solution) {
            console.log('  Base HTTP Status:', result.solution.status);
        }
        
    } catch (error) {
        console.error('❌ Erreur base URL:', error.message);
    }
}

async function runTests() {
    await testWithHeaders();
    await testBaseURL();
}

runTests(); 