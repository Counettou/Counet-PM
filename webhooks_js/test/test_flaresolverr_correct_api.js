#!/usr/bin/env node

/**
 * 🔥 TEST FLARESOLVERR AVEC LA BONNE API GMGN
 */

import fetch from 'node-fetch';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';
const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';

// 🎯 VRAIE URL API GMGN (trouvée dans la recherche)
const CORRECT_API_URL = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`;

const PROXY_CONFIG = {
    url: 'http://j686absSWTWSkmcj:kjXBVH6xcLmWKew5@geo.iproyal.com:12321'
};

async function testCorrectAPI() {
    console.log('🔥 TEST FLARESOLVERR AVEC LA BONNE API GMGN');
    console.log('═'.repeat(60));
    console.log(`🎯 URL correcte: ${CORRECT_API_URL}`);
    
    try {
        const payload = {
            cmd: "request.get",
            url: CORRECT_API_URL,
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
        
        console.log('📤 Requête vers la bonne API...');
        
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
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

// Test aussi l'endpoint ranking pour vérification
async function testRankingEndpoint() {
    console.log('\n🔍 TEST ENDPOINT RANKING GMGN...');
    
    const rankingURL = 'https://gmgn.ai/defi/quotation/v1/rank/sol/swaps/1h?orderby=volume&direction=desc';
    
    const payload = {
        cmd: "request.get",
        url: rankingURL,
        maxTimeout: 30000,
        proxy: PROXY_CONFIG,
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://gmgn.ai/',
            'Origin': 'https://gmgn.ai'
        }
    };
    
    try {
        const response = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 35000
        });
        
        const result = await response.json();
        console.log('  Ranking Status:', result.status);
        console.log('  Ranking Message:', result.message);
        
        if (result.solution) {
            console.log('  Ranking HTTP Status:', result.solution.status);
            if (result.solution.response && result.solution.response.trim().startsWith('{')) {
                try {
                    const data = JSON.parse(result.solution.response);
                    console.log('  Ranking Tokens Count:', data.data?.rank?.length || 0);
                } catch (e) {
                    console.log('  Ranking parse error');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur ranking:', error.message);
    }
}

async function runTests() {
    await testCorrectAPI();
    await testRankingEndpoint();
}

runTests(); 