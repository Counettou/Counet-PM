#!/usr/bin/env node

/**
 * 🔥 TEST FLARESOLVERR AVEC L'URL EXACTE SPÉCIFIÉE
 */

import fetch from 'node-fetch';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';

// 🎯 URL EXACTE SPÉCIFIÉE PAR L'UTILISATEUR
const TARGET_URL = 'https://gmgn.ai/defi/quotation/v1/tokens/sol/';

const PROXY_CONFIG = {
    url: 'http://j686absSWTWSkmcj:kjXBVH6xcLmWKew5@geo.iproyal.com:12321'
};

async function testExactURL() {
    console.log('🔥 TEST FLARESOLVERR AVEC URL EXACTE');
    console.log('═'.repeat(60));
    console.log(`🎯 URL exacte: ${TARGET_URL}`);
    
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
        
        console.log('📤 Requête vers l\'URL exacte...');
        
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
                        console.log('🎉 SUCCESS - JSON PARSÉ:');
                        console.log('  Type de data:', typeof data);
                        console.log('  Keys:', Object.keys(data));
                        
                        if (data.code !== undefined) {
                            console.log('  Code:', data.code);
                            console.log('  Message:', data.msg || data.message || 'N/A');
                        }
                        
                        if (data.data) {
                            console.log('  Data keys:', Object.keys(data.data));
                            if (Array.isArray(data.data)) {
                                console.log('  Data array length:', data.data.length);
                                if (data.data.length > 0) {
                                    console.log('  Premier élément:', JSON.stringify(data.data[0], null, 2));
                                }
                            } else {
                                console.log('  Data object:', JSON.stringify(data.data, null, 2));
                            }
                        }
                        
                        return data;
                    } catch (parseError) {
                        console.log('❌ Erreur parsing JSON:', parseError.message);
                    }
                } else {
                    console.log('❌ Réponse HTML reçue au lieu de JSON');
                    // Chercher des indices dans le HTML
                    if (solution.response.includes('403') || solution.response.includes('Forbidden')) {
                        console.log('🚨 Possible erreur 403/Forbidden détectée dans le HTML');
                    }
                    if (solution.response.includes('cloudflare')) {
                        console.log('🚨 Cloudflare détecté dans le HTML');
                    }
                    if (solution.response.includes('api') || solution.response.includes('API')) {
                        console.log('💡 Mention d\'API trouvée dans le HTML');
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

// Test également avec une session
async function testWithSession() {
    console.log('\n🔥 TEST AVEC SESSION FLARESOLVERR');
    console.log('═'.repeat(60));
    
    let sessionId = null;
    
    try {
        // Créer une session
        const sessionPayload = {
            cmd: "sessions.create",
            session: `test-session-${Date.now()}`,
            maxTimeout: 60000,
            proxy: PROXY_CONFIG
        };
        
        const sessionResponse = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionPayload),
            timeout: 70000
        });
        
        const sessionResult = await sessionResponse.json();
        
        if (sessionResult.status === 'ok') {
            sessionId = sessionResult.session;
            console.log(`✅ Session créée: ${sessionId}`);
            
            // Maintenant faire la requête avec la session
            const payload = {
                cmd: "request.get",
                url: TARGET_URL,
                session: sessionId,
                maxTimeout: 60000,
                proxy: PROXY_CONFIG,
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://gmgn.ai/',
                    'Origin': 'https://gmgn.ai'
                }
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
            
            console.log('📥 Réponse avec session:');
            console.log('  Status:', result.status);
            console.log('  Message:', result.message);
            
            if (result.solution) {
                console.log('  HTTP Status:', result.solution.status);
                console.log('  Response length:', result.solution.response?.length || 0);
                
                if (result.solution.response && result.solution.response.trim().startsWith('{')) {
                    try {
                        const data = JSON.parse(result.solution.response);
                        console.log('✅ JSON parsé avec session !');
                        console.log('  Type:', typeof data);
                        console.log('  Keys:', Object.keys(data));
                    } catch (e) {
                        console.log('❌ Parse error avec session');
                    }
                } else {
                    console.log('❌ HTML reçu même avec session');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur session:', error.message);
    } finally {
        // Nettoyer la session
        if (sessionId) {
            try {
                const cleanupPayload = {
                    cmd: "sessions.destroy",
                    session: sessionId
                };
                
                await fetch(FLARESOLVERR_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(cleanupPayload),
                    timeout: 30000
                });
                
                console.log('✅ Session nettoyée');
            } catch (cleanupError) {
                console.error('❌ Erreur nettoyage:', cleanupError.message);
            }
        }
    }
}

async function runTests() {
    await testExactURL();
    await testWithSession();
}

runTests(); 