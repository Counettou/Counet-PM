#!/usr/bin/env node

/**
 * 🔥 TEST DIRECT FLARESOLVERR - DEBUG COMPLET
 */

import fetch from 'node-fetch';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';
const TARGET_URL = 'https://gmgn.ai/defi/quotation/v1/tokens/sol/5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';

const PROXY_CONFIG = {
    url: 'http://j686absSWTWSkmcj:kjXBVH6xcLmWKew5@geo.iproyal.com:12321'
};

async function testFlareSolverr() {
    console.log('🔥 TEST DIRECT FLARESOLVERR');
    console.log('═'.repeat(50));
    
    try {
        const payload = {
            cmd: "request.get",
            url: TARGET_URL,
            maxTimeout: 60000,
            proxy: PROXY_CONFIG
        };
        
        console.log('📤 Payload envoyé:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 70000
        });
        
        const result = await response.json();
        
        console.log('📥 Réponse FlareSolverr:');
        console.log('  Status:', result.status);
        console.log('  Message:', result.message);
        
        if (result.status === 'ok' && result.solution) {
            const solution = result.solution;
            console.log('  HTTP Status:', solution.status);
            console.log('  URL finale:', solution.url);
            console.log('  User-Agent:', solution.userAgent);
            console.log('  Cookies count:', solution.cookies?.length || 0);
            console.log('  Response length:', solution.response?.length || 0);
            
            if (solution.response) {
                console.log('  Response preview:', solution.response.substring(0, 300));
                
                try {
                    const data = JSON.parse(solution.response);
                    console.log('📊 DONNÉES PARSÉES:');
                    console.log('  Prix:', data.price || 'N/A');
                    console.log('  Symbol:', data.symbol || 'N/A');
                    console.log('  Name:', data.name || 'N/A');
                    console.log('  Market Cap:', data.market_cap || 'N/A');
                } catch (parseError) {
                    console.log('❌ Erreur parsing JSON:', parseError.message);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

testFlareSolverr(); 