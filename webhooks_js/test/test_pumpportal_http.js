#!/usr/bin/env node

/**
 * 🔬 TEST PUMPPORTAL HTTP API - TOKEN CHAT  
 * Test des requêtes HTTP pour récupérer des infos sur le token
 */

const CHAT_MINT = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';

console.log('🚀 TEST PUMPPORTAL HTTP API - TOKEN CHAT');
console.log(`🎯 Token CHAT: ${CHAT_MINT}`);
console.log('📡 Tests des endpoints HTTP disponibles\n');

// Test pour récupérer des infos sur le token via des services tiers
async function testTokenInfo() {
    console.log('📊 === TEST 1: Informations Token via APIs externes ===');
    
    try {
        // Test Solscan API pour infos de base
        console.log('🔍 Test Solscan API...');
        const solscanResponse = await fetch(`https://public-api.solscan.io/token/meta?tokenAddress=${CHAT_MINT}`);
        if (solscanResponse.ok) {
            const solscanData = await solscanResponse.json();
            console.log('✅ Solscan OK:');
            console.log(`   📛 Nom: ${solscanData.name || 'N/A'}`);
            console.log(`   🔤 Symbol: ${solscanData.symbol || 'N/A'}`);
            console.log(`   🔢 Decimals: ${solscanData.decimals || 'N/A'}`);
            console.log(`   🖼️  Icon: ${solscanData.icon || 'N/A'}`);
        } else {
            console.log('❌ Solscan API: Erreur ou rate limit');
        }
    } catch (error) {
        console.log(`❌ Erreur Solscan: ${error.message}`);
    }
    
    console.log(''); // Ligne vide
}

// Test pour DexScreener API
async function testDexScreener() {
    console.log('📊 === TEST 2: DexScreener API ===');
    
    try {
        console.log('🔍 Test DexScreener pour le token...');
        const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CHAT_MINT}`);
        if (dexResponse.ok) {
            const dexData = await dexResponse.json();
            console.log('✅ DexScreener OK:');
            if (dexData.pairs && dexData.pairs.length > 0) {
                const pair = dexData.pairs[0];
                console.log(`   💰 Prix USD: $${pair.priceUsd || 'N/A'}`);
                console.log(`   📊 Volume 24h: $${pair.volume?.h24 || 'N/A'}`);
                console.log(`   🔄 Liquidité: $${pair.liquidity?.usd || 'N/A'}`);
                console.log(`   📈 Change 24h: ${pair.priceChange?.h24 || 'N/A'}%`);
                console.log(`   🏊 Pool: ${pair.pairAddress || 'N/A'}`);
                console.log(`   🏢 DEX: ${pair.dexId || 'N/A'}`);
            } else {
                console.log('   ⚠️  Aucune paire trouvée');
            }
        } else {
            console.log('❌ DexScreener: Erreur ou token non trouvé');
        }
    } catch (error) {
        console.log(`❌ Erreur DexScreener: ${error.message}`);
    }
    
    console.log(''); // Ligne vide
}

// Test pour Jupiter API
async function testJupiterAPI() {
    console.log('📊 === TEST 3: Jupiter Price API ===');
    
    try {
        console.log('🔍 Test Jupiter pour le prix...');
        const jupiterResponse = await fetch(`https://price.jup.ag/v4/price?ids=${CHAT_MINT}`);
        if (jupiterResponse.ok) {
            const jupiterData = await jupiterResponse.json();
            console.log('✅ Jupiter OK:');
            if (jupiterData.data && jupiterData.data[CHAT_MINT]) {
                const priceData = jupiterData.data[CHAT_MINT];
                console.log(`   💰 Prix: $${priceData.price || 'N/A'}`);
                console.log(`   ⏰ Timestamp: ${new Date(priceData.mintSymbol || Date.now()).toLocaleString()}`);
            } else {
                console.log('   ⚠️  Prix non trouvé');
            }
        } else {
            console.log('❌ Jupiter: Erreur ou token non trouvé');
        }
    } catch (error) {
        console.log(`❌ Erreur Jupiter: ${error.message}`);
    }
    
    console.log(''); // Ligne vide
}

// Test pour obtenir des infos sur le token via RPC Solana
async function testSolanaRPC() {
    console.log('📊 === TEST 4: Solana RPC Token Info ===');
    
    try {
        console.log('🔍 Test Solana RPC pour account info...');
        
        const rpcPayload = {
            jsonrpc: "2.0",
            id: 1,
            method: "getAccountInfo",
            params: [
                CHAT_MINT,
                {
                    encoding: "jsonParsed"
                }
            ]
        };
        
        const rpcResponse = await fetch('https://api.mainnet-beta.solana.com', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(rpcPayload)
        });
        
        if (rpcResponse.ok) {
            const rpcData = await rpcResponse.json();
            console.log('✅ Solana RPC OK:');
            if (rpcData.result && rpcData.result.value) {
                const accountData = rpcData.result.value.data.parsed.info;
                console.log(`   🔢 Decimals: ${accountData.decimals || 'N/A'}`);
                console.log(`   🏦 Mint Authority: ${accountData.mintAuthority || 'N/A'}`);
                console.log(`   🔥 Freeze Authority: ${accountData.freezeAuthority || 'N/A'}`);
                console.log(`   📊 Supply: ${accountData.supply || 'N/A'}`);
            } else {
                console.log('   ⚠️  Account non trouvé');
            }
        } else {
            console.log('❌ Solana RPC: Erreur');
        }
    } catch (error) {
        console.log(`❌ Erreur Solana RPC: ${error.message}`);
    }
    
    console.log(''); // Ligne vide
}

// Test de simulation de trading (sans vraie transaction)
async function testTradingSimulation() {
    console.log('📊 === TEST 5: Simulation Trading (PumpPortal) ===');
    console.log('⚠️  Note: Ceci est une simulation - aucune vraie transaction');
    
    // Exemple de payload pour PumpPortal (simulation uniquement)
    const tradingPayload = {
        publicKey: "SIMULATION_KEY",
        action: "buy",
        mint: CHAT_MINT,
        denominatedInSol: "true",
        amount: 0.01,
        slippage: 10,
        priorityFee: 0.0001,
        pool: "pump"
    };
    
    console.log('📝 Payload de simulation:');
    console.log(JSON.stringify(tradingPayload, null, 2));
    console.log('💡 Pour utiliser: POST vers https://pumpportal.fun/api/trade-local');
    console.log('🔑 Nécessite: Clé API et vraies clés wallet');
    
    console.log(''); // Ligne vide
}

// Fonction principale
async function runAllTests() {
    const startTime = Date.now();
    
    await testTokenInfo();
    await testDexScreener();
    await testJupiterAPI();
    await testSolanaRPC();
    await testTradingSimulation();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('🏁 === RÉSUMÉ DES TESTS ===');
    console.log(`⏱️  Durée totale: ${duration}s`);
    console.log(`🎯 Token testé: ${CHAT_MINT}`);
    console.log('✅ Tests HTTP terminés');
    console.log('\n💡 Pour le temps réel, lancez: node test_pumpportal_chat.js');
}

// Lancer tous les tests
runAllTests().catch(error => {
    console.error('❌ Erreur générale:', error);
}); 