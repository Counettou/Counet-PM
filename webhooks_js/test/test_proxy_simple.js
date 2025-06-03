#!/usr/bin/env node

import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 🔍 TEST SIMPLE PROXY IPROYAL
 * 
 * Test de base pour diagnostiquer les problèmes de proxy
 */

const IPROYAL_CONFIG = {
    hostname: 'geo.iproyal.com',
    port: '12321',
    username: 'j686absSWTWSkmcj',
    password: 'kjXBVH6xcLmWKew5'
};

console.log('🔍 TEST DIAGNOSTIC PROXY IPROYAL');
console.log('═'.repeat(50));

// Test 1: Sans proxy (pour référence)
async function testWithoutProxy() {
    console.log('\n📋 TEST 1: Sans proxy (référence)');
    try {
        const response = await fetch('https://httpbin.org/ip', {
            timeout: 5000
        });
        const data = await response.json();
        console.log('✅ Succès sans proxy:', data.origin);
        return true;
    } catch (error) {
        console.log('❌ Erreur sans proxy:', error.message);
        return false;
    }
}

// Test 2: Avec proxy IPRoyal (sans pays)
async function testWithBasicProxy() {
    console.log('\n📋 TEST 2: Proxy IPRoyal basique (sans pays)');
    
    const proxyUrl = `http://${IPROYAL_CONFIG.username}:${IPROYAL_CONFIG.password}@${IPROYAL_CONFIG.hostname}:${IPROYAL_CONFIG.port}`;
    const agent = new HttpsProxyAgent(proxyUrl);
    
    console.log('🔗 Proxy URL:', proxyUrl.replace(IPROYAL_CONFIG.password, '***'));
    
    try {
        const response = await fetch('https://httpbin.org/ip', {
            agent: agent,
            timeout: 10000
        });
        const data = await response.json();
        console.log('✅ Succès avec proxy basique:', data.origin);
        return true;
    } catch (error) {
        console.log('❌ Erreur avec proxy basique:', error.message);
        return false;
    }
}

// Test 3: Avec proxy IPRoyal + pays
async function testWithCountryProxy() {
    console.log('\n📋 TEST 3: Proxy IPRoyal avec pays (US)');
    
    const username = IPROYAL_CONFIG.username;
    const password = `${IPROYAL_CONFIG.password}_country-us`;
    const proxyUrl = `http://${username}:${password}@${IPROYAL_CONFIG.hostname}:${IPROYAL_CONFIG.port}`;
    const agent = new HttpsProxyAgent(proxyUrl);
    
    console.log('🔗 Proxy URL:', proxyUrl.replace(IPROYAL_CONFIG.password, '***'));
    
    try {
        const response = await fetch('https://httpbin.org/ip', {
            agent: agent,
            timeout: 10000
        });
        const data = await response.json();
        console.log('✅ Succès avec proxy US:', data.origin);
        return true;
    } catch (error) {
        console.log('❌ Erreur avec proxy US:', error.message);
        return false;
    }
}

// Test 4: GMGN sans proxy
async function testGMGNWithoutProxy() {
    console.log('\n📋 TEST 4: GMGN sans proxy');
    
    const url = 'https://gmgn.ai/defi/quotation/v1/tokens/sol/5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.gmgn.cc/',
                'Origin': 'https://www.gmgn.cc'
            },
            timeout: 5000
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.price) {
                console.log('✅ GMGN sans proxy - Prix:', `$${data.price}`);
                return true;
            } else {
                console.log('❌ GMGN sans proxy - Pas de prix dans la réponse');
                return false;
            }
        } else {
            console.log('❌ GMGN sans proxy - HTTP', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ GMGN sans proxy - Erreur:', error.message);
        return false;
    }
}

// Test 5: GMGN avec proxy basique
async function testGMGNWithProxy() {
    console.log('\n📋 TEST 5: GMGN avec proxy IPRoyal basique');
    
    const proxyUrl = `http://${IPROYAL_CONFIG.username}:${IPROYAL_CONFIG.password}@${IPROYAL_CONFIG.hostname}:${IPROYAL_CONFIG.port}`;
    const agent = new HttpsProxyAgent(proxyUrl);
    const url = 'https://gmgn.ai/defi/quotation/v1/tokens/sol/5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';
    
    try {
        const response = await fetch(url, {
            agent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.gmgn.cc/',
                'Origin': 'https://www.gmgn.cc'
            },
            timeout: 10000
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.price) {
                console.log('✅ GMGN avec proxy - Prix:', `$${data.price}`);
                return true;
            } else {
                console.log('❌ GMGN avec proxy - Pas de prix dans la réponse');
                return false;
            }
        } else {
            console.log('❌ GMGN avec proxy - HTTP', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ GMGN avec proxy - Erreur:', error.message);
        return false;
    }
}

// Exécution des tests
async function runAllTests() {
    console.log('🚀 Démarrage des tests diagnostic...\n');
    
    const results = {
        withoutProxy: await testWithoutProxy(),
        basicProxy: await testWithBasicProxy(),
        countryProxy: await testWithCountryProxy(),
        gmgnWithoutProxy: await testGMGNWithoutProxy(),
        gmgnWithProxy: await testGMGNWithProxy()
    };
    
    console.log('\n📊 RÉSUMÉ DES TESTS:');
    console.log('═'.repeat(50));
    console.log(`📡 Sans proxy (référence): ${results.withoutProxy ? '✅ OK' : '❌ FAIL'}`);
    console.log(`🌐 Proxy IPRoyal basique: ${results.basicProxy ? '✅ OK' : '❌ FAIL'}`);
    console.log(`🇺🇸 Proxy IPRoyal + pays: ${results.countryProxy ? '✅ OK' : '❌ FAIL'}`);
    console.log(`🎯 GMGN sans proxy: ${results.gmgnWithoutProxy ? '✅ OK' : '❌ FAIL'}`);
    console.log(`🎯 GMGN avec proxy: ${results.gmgnWithProxy ? '✅ OK' : '❌ FAIL'}`);
    
    console.log('\n💡 DIAGNOSTIC:');
    if (!results.basicProxy) {
        console.log('❌ Problème d\'authentification IPRoyal ou configuration incorrecte');
    } else if (!results.gmgnWithProxy) {
        console.log('❌ GMGN bloque les proxies IPRoyal ou problème de configuration');
    } else {
        console.log('✅ Tout fonctionne ! Le problème était ailleurs.');
    }
}

runAllTests().catch(console.error); 