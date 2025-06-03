#!/usr/bin/env node

/**
 * 🔥 TEST API OFFICIELLE GMGN - ROUTER API
 * 
 * Utilisation de l'API officielle documentée par GMGN
 * pour récupérer les données de prix via FlareSolverr
 */

import fetch from 'node-fetch';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';
const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';

// 🎯 API OFFICIELLE GMGN - ROUTER ENDPOINT (comme documenté)
const SOL_ADDRESS = 'So11111111111111111111111111111111111111112'; // SOL
const FROM_ADDRESS = '11111111111111111111111111111111'; // Adresse factice pour test
const AMOUNT = '1000000'; // 0.001 SOL en lamports
const SLIPPAGE = 1; // 1%

const OFFICIAL_API_URL = `https://gmgn.ai/defi/router/v1/sol/tx/get_swap_route?token_in_address=${SOL_ADDRESS}&token_out_address=${TARGET_TOKEN}&in_amount=${AMOUNT}&from_address=${FROM_ADDRESS}&slippage=${SLIPPAGE}`;

const PROXY_CONFIG = {
    url: 'http://j686absSWTWSkmcj:kjXBVH6xcLmWKew5@geo.iproyal.com:12321'
};

async function testOfficialAPI() {
    console.log('🔥 TEST API OFFICIELLE GMGN - ROUTER');
    console.log('═'.repeat(80));
    console.log(`🎯 URL API Officielle: ${OFFICIAL_API_URL}`);
    
    try {
        const payload = {
            cmd: "request.get",
            url: OFFICIAL_API_URL,
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
        
        console.log('📤 Requête vers API officielle router...');
        
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
                const preview = solution.response.substring(0, 1000);
                console.log('  Response preview:', preview);
                
                // Essayer de parser si c'est du JSON
                if (solution.response.trim().startsWith('{') || solution.response.trim().startsWith('[')) {
                    try {
                        const data = JSON.parse(solution.response);
                        console.log('🎉 SUCCESS - JSON PARSÉ DE L\'API OFFICIELLE:');
                        console.log('  Code:', data.code);
                        console.log('  Message:', data.msg);
                        
                        if (data.data && data.data.quote) {
                            const quote = data.data.quote;
                            console.log('  📊 DONNÉES DE QUOTE:');
                            console.log('    Input Mint:', quote.inputMint);
                            console.log('    Input Amount:', quote.inAmount);
                            console.log('    Output Mint:', quote.outputMint);
                            console.log('    Output Amount:', quote.outAmount);
                            console.log('    Price Impact:', quote.priceImpactPct);
                            
                            // Calculer le prix approximatif
                            if (quote.inAmount && quote.outAmount) {
                                const inputSOL = parseFloat(quote.inAmount) / 1e9; // Convertir lamports en SOL
                                const outputTokens = parseFloat(quote.outAmount) / 1e6; // Supposer 6 décimales pour le token
                                const pricePerToken = inputSOL / outputTokens;
                                console.log(`    💰 Prix approximatif: $${pricePerToken.toFixed(10)} par token`);
                            }
                            
                            return data;
                        }
                        
                        return data;
                    } catch (parseError) {
                        console.log('❌ Erreur parsing JSON:', parseError.message);
                    }
                } else {
                    console.log('❌ Réponse HTML reçue au lieu de JSON');
                    // Chercher des indices dans le HTML
                    if (solution.response.includes('403') || solution.response.includes('Forbidden')) {
                        console.log('🚨 Possible erreur 403/Forbidden détectée');
                    }
                    if (solution.response.includes('whitelist') || solution.response.includes('ip')) {
                        console.log('🚨 Mention de whitelist/IP détectée - IP pas autorisée');
                    }
                }
            }
        } else {
            console.log('❌ Erreur FlareSolverr:', result.message || 'Erreur inconnue');
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

// Test aussi l'endpoint de ranking qui pourrait contenir des prix
async function testRankingAPI() {
    console.log('\n🔥 TEST API RANKING GMGN (POUR DONNÉES DE PRIX)');
    console.log('═'.repeat(80));
    
    // URL de ranking qui peut contenir des prix
    const rankingURL = 'https://gmgn.ai/defi/quotation/v1/rank/sol/swaps/1h?orderby=volume&direction=desc&limit=100';
    
    const payload = {
        cmd: "request.get",
        url: rankingURL,
        maxTimeout: 60000,
        proxy: PROXY_CONFIG,
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://gmgn.ai/',
            'Origin': 'https://gmgn.ai'
        }
    };
    
    try {
        console.log(`📤 Requête vers API ranking: ${rankingURL}`);
        
        const response = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 70000
        });
        
        const result = await response.json();
        
        console.log('📥 Réponse Ranking API:');
        console.log('  Status:', result.status);
        console.log('  Message:', result.message);
        
        if (result.solution && result.solution.response && result.solution.response.trim().startsWith('{')) {
            try {
                const data = JSON.parse(result.solution.response);
                console.log('✅ JSON parsé du ranking !');
                console.log('  Code:', data.code);
                console.log('  Message:', data.msg);
                
                if (data.data && data.data.rank && Array.isArray(data.data.rank)) {
                    console.log('  📈 Nombre de tokens dans le ranking:', data.data.rank.length);
                    
                    // Chercher notre token dans le ranking
                    const ourToken = data.data.rank.find(token => 
                        token.address === TARGET_TOKEN || 
                        token.mint === TARGET_TOKEN ||
                        token.token_address === TARGET_TOKEN
                    );
                    
                    if (ourToken) {
                        console.log('  🎯 NOTRE TOKEN TROUVÉ DANS LE RANKING:');
                        console.log('    Address:', ourToken.address || ourToken.mint || ourToken.token_address);
                        console.log('    Symbol:', ourToken.symbol);
                        console.log('    Price:', ourToken.price || ourToken.usd_price || 'N/A');
                        console.log('    Market Cap:', ourToken.market_cap || 'N/A');
                        console.log('    Volume:', ourToken.volume_24h || ourToken.volume || 'N/A');
                        
                        return ourToken;
                    } else {
                        console.log('  ℹ️ Notre token pas dans le top ranking actuel');
                        console.log('  📊 Exemple de token du ranking:', JSON.stringify(data.data.rank[0], null, 2));
                    }
                }
                
            } catch (parseError) {
                console.log('❌ Erreur parsing ranking JSON:', parseError.message);
            }
        } else {
            console.log('❌ Pas de JSON valide reçu du ranking');
        }
        
    } catch (error) {
        console.error('❌ Erreur ranking API:', error.message);
    }
}

async function runTests() {
    await testOfficialAPI();
    await testRankingAPI();
}

runTests(); 