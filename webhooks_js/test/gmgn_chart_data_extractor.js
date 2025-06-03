#!/usr/bin/env node

import fetch from 'node-fetch';

/**
 * 🎯 EXTRACTEUR DE DONNÉES GRAPHIQUE GMGN.AI
 * 
 * Ce script essaie différentes méthodes pour récupérer le prix du token chat
 * depuis GMGN.ai en analysant leurs endpoints publics
 */

const TARGET_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump'; // chat

console.log('🎯 EXTRACTEUR DE DONNÉES GRAPHIQUE GMGN.AI');
console.log('═'.repeat(50));
console.log(`🪙 Token: ${TARGET_TOKEN}`);
console.log('🔄 Test des différents endpoints...\n');

/**
 * Méthode 1: Essayer l'endpoint de données de graphique GMGN
 */
async function tryGMGNChartData() {
    console.log('📊 Test 1: Endpoint de données graphique GMGN...');
    
    try {
        // Endpoints possibles pour les données de graphique
        const endpoints = [
            `https://gmgn.ai/defi/quotation/v1/chart/sol/${TARGET_TOKEN}?period=1m&limit=100`,
            `https://gmgn.ai/api/v1/chart/sol/${TARGET_TOKEN}?interval=1m`,
            `https://api.gmgn.ai/api/v1/token_chart/sol/${TARGET_TOKEN}`,
            `https://gmgn.ai/defi/quotation/v1/tokens/sol/${TARGET_TOKEN}`,
            `https://gmgn.ai/api/v1/token/sol/${TARGET_TOKEN}`,
        ];
        
        for (const url of endpoints) {
            console.log(`  🔗 Essai: ${url}`);
            
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': `https://www.gmgn.cc/kline/sol/${TARGET_TOKEN}`,
                        'Origin': 'https://www.gmgn.cc'
                    }
                });
                
                if (response.ok) {
                    const data = await response.text();
                    console.log(`  ✅ Réponse reçue (${data.length} chars)`);
                    
                    // Essayer de parser comme JSON
                    try {
                        const jsonData = JSON.parse(data);
                        console.log('  📄 Données JSON:');
                        console.log(JSON.stringify(jsonData, null, 2).substring(0, 500) + '...');
                        
                        // Chercher des champs de prix
                        if (typeof jsonData === 'object') {
                            const priceFields = findPriceFields(jsonData);
                            if (priceFields.length > 0) {
                                console.log('  💰 Champs de prix trouvés:', priceFields);
                                return { url, data: jsonData, priceFields };
                            }
                        }
                        
                    } catch (e) {
                        console.log('  ❌ Pas du JSON valide');
                    }
                } else {
                    console.log(`  ❌ Erreur: ${response.status} ${response.statusText}`);
                }
                
            } catch (error) {
                console.log(`  ❌ Erreur: ${error.message}`);
            }
            
            // Petite pause entre les requêtes
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
    } catch (error) {
        console.log(`❌ Erreur générale: ${error.message}`);
    }
    
    return null;
}

/**
 * Méthode 2: Essayer les endpoints de données de trading populaires
 */
async function tryPopularTradingAPIs() {
    console.log('\n📊 Test 2: APIs de trading populaires...');
    
    const apis = [
        {
            name: 'DexScreener',
            url: `https://api.dexscreener.com/latest/dex/tokens/${TARGET_TOKEN}`,
        },
        {
            name: 'Jupiter Price API',
            url: `https://price.jup.ag/v4/price?ids=${TARGET_TOKEN}`,
        },
        {
            name: 'CoinGecko Terminal',
            url: `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${TARGET_TOKEN}/info`,
        }
    ];
    
    for (const api of apis) {
        console.log(`  🔗 ${api.name}: ${api.url}`);
        
        try {
            const response = await fetch(api.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`  ✅ ${api.name} - Données reçues:`);
                console.log(JSON.stringify(data, null, 2).substring(0, 300) + '...');
                
                const priceFields = findPriceFields(data);
                if (priceFields.length > 0) {
                    console.log(`  💰 Prix trouvés dans ${api.name}:`, priceFields);
                    return { api: api.name, data, priceFields };
                }
            } else {
                console.log(`  ❌ ${api.name}: ${response.status} ${response.statusText}`);
            }
            
        } catch (error) {
            console.log(`  ❌ ${api.name}: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return null;
}

/**
 * Méthode 3: Essayer d'analyser la page GMGN directement
 */
async function tryGMGNPageAnalysis() {
    console.log('\n📊 Test 3: Analyse de la page GMGN...');
    
    try {
        const url = `https://www.gmgn.cc/kline/sol/${TARGET_TOKEN}?interval=1S`;
        console.log(`  🔗 Chargement: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        if (response.ok) {
            const html = await response.text();
            console.log(`  ✅ Page chargée (${html.length} chars)`);
            
            // Chercher des patterns de prix dans le HTML
            const pricePatterns = [
                /price["\s]*[:=]["\s]*([0-9\.]+)/gi,
                /[\$][0-9\.]+/g,
                /"([0-9]+\.[0-9]{6,})"[\s]*[,}]/g,
                /priceInUSD["\s]*[:=]["\s]*([0-9\.]+)/gi
            ];
            
            const foundPrices = [];
            
            for (const pattern of pricePatterns) {
                const matches = [...html.matchAll(pattern)];
                if (matches.length > 0) {
                    console.log(`  💰 Pattern trouvé:`, pattern);
                    matches.slice(0, 5).forEach(match => {
                        console.log(`    - ${match[0]}`);
                        foundPrices.push(match[1] || match[0]);
                    });
                }
            }
            
            if (foundPrices.length > 0) {
                return { source: 'HTML', prices: foundPrices };
            }
            
        } else {
            console.log(`  ❌ Erreur: ${response.status} ${response.statusText}`);
        }
        
    } catch (error) {
        console.log(`  ❌ Erreur: ${error.message}`);
    }
    
    return null;
}

/**
 * Fonction utilitaire pour trouver des champs de prix dans un objet
 */
function findPriceFields(obj, path = '', results = []) {
    if (typeof obj !== 'object' || obj === null) {
        return results;
    }
    
    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Vérifier si c'est un champ de prix
        if (typeof value === 'number' || typeof value === 'string') {
            const keyLower = key.toLowerCase();
            if (keyLower.includes('price') || 
                keyLower.includes('usd') || 
                keyLower === 'p' ||
                (typeof value === 'string' && value.match(/^[0-9]*\.?[0-9]+$/))) {
                
                const numValue = typeof value === 'string' ? parseFloat(value) : value;
                if (!isNaN(numValue) && numValue > 0 && numValue < 1) {
                    results.push({ path: currentPath, key, value, numValue });
                }
            }
        }
        
        // Récursion pour les objets et tableaux
        if (typeof value === 'object') {
            findPriceFields(value, currentPath, results);
        }
    }
    
    return results;
}

/**
 * Fonction principale
 */
async function main() {
    console.log('🚀 Démarrage de l\'extraction...\n');
    
    // Test des différentes méthodes
    let result = await tryGMGNChartData();
    
    if (!result) {
        result = await tryPopularTradingAPIs();
    }
    
    if (!result) {
        result = await tryGMGNPageAnalysis();
    }
    
    // Résumé final
    console.log('\n═'.repeat(50));
    if (result) {
        console.log('✅ SUCCÈS - Données trouvées!');
        console.log('📊 Source:', result.api || result.source || 'GMGN');
        
        if (result.priceFields) {
            console.log('💰 Prix candidats:');
            result.priceFields.forEach(field => {
                console.log(`  - ${field.path}: ${field.value} (${field.numValue})`);
            });
        }
        
        if (result.prices) {
            console.log('💰 Prix trouvés:', result.prices.slice(0, 10));
        }
        
    } else {
        console.log('❌ ÉCHEC - Aucune donnée de prix trouvée');
        console.log('\n💡 Suggestions:');
        console.log('1. Vérifier si le token existe bien sur GMGN');
        console.log('2. Essayer avec un token plus populaire pour tester');
        console.log('3. Analyser les appels réseau de GMGN avec les outils de développement');
    }
    
    console.log('═'.repeat(50));
}

main().catch(console.error); 