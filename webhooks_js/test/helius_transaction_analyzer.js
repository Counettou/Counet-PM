#!/usr/bin/env node

// Note: fetch est maintenant built-in dans Node.js 18+

/**
 * 🔬 ANALYSEUR DE TRANSACTIONS HELIUS
 * 
 * Ce script récupère les vraies transactions d'un slot via Helius
 * pour comprendre comment extraire les vrais prix depuis les swaps.
 */

class HeliusTransactionAnalyzer {
    constructor() {
        this.HELIUS_API_KEY = "076e4798-996e-42df-ae5a-7bf783c627ea";
        this.HELIUS_HTTP_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${this.HELIUS_API_KEY}`;
        
        console.log('🔬 HELIUS TRANSACTION ANALYZER INITIALISÉ');
        console.log('📊 Objectif: Analyser les vraies transactions de swaps');
    }

    /**
     * Récupérer toutes les transactions d'un slot
     */
    async getSlotTransactions(slot) {
        try {
            console.log(`\n🔍 RÉCUPÉRATION DES TRANSACTIONS DU SLOT: ${slot}`);
            console.log('='.repeat(60));
            
            const response = await fetch(this.HELIUS_HTTP_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "getBlock",
                    params: [
                        slot,
                        {
                            encoding: "jsonParsed",
                            transactionDetails: "full",
                            rewards: false,
                            maxSupportedTransactionVersion: 0
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Helius Error: ${data.error.message}`);
            }

            if (!data.result) {
                console.log('❌ Aucune donnée de bloc trouvée');
                return [];
            }

            const transactions = data.result.transactions || [];
            console.log(`📊 ${transactions.length} transactions trouvées dans le slot ${slot}`);
            
            return transactions;

        } catch (error) {
            console.error(`❌ Erreur récupération slot ${slot}:`, error.message);
            return [];
        }
    }

    /**
     * Analyser une transaction pour des swaps de tokens
     */
    analyzeTransactionForSwaps(transaction, targetMint = null) {
        const swaps = [];
        
        try {
            // Analyser les token transfers
            if (transaction.meta && transaction.meta.postTokenBalances && transaction.meta.preTokenBalances) {
                const preBalances = transaction.meta.preTokenBalances;
                const postBalances = transaction.meta.postTokenBalances;
                
                // Créer un map des changements de balance par compte/mint
                const balanceChanges = new Map();
                
                // Pre-balances
                preBalances.forEach(balance => {
                    const key = `${balance.accountIndex}_${balance.mint}`;
                    balanceChanges.set(key, {
                        mint: balance.mint,
                        accountIndex: balance.accountIndex,
                        preBal: parseFloat(balance.uiTokenAmount.uiAmountString || '0'),
                        postBal: 0,
                        change: 0
                    });
                });
                
                // Post-balances
                postBalances.forEach(balance => {
                    const key = `${balance.accountIndex}_${balance.mint}`;
                    const existing = balanceChanges.get(key) || {
                        mint: balance.mint,
                        accountIndex: balance.accountIndex,
                        preBal: 0,
                        postBal: 0,
                        change: 0
                    };
                    
                    existing.postBal = parseFloat(balance.uiTokenAmount.uiAmountString || '0');
                    existing.change = existing.postBal - existing.preBal;
                    balanceChanges.set(key, existing);
                });
                
                // Chercher des patterns de swap
                const changes = Array.from(balanceChanges.values());
                const increases = changes.filter(c => c.change > 0);
                const decreases = changes.filter(c => c.change < 0);
                
                // Pattern de swap: un token diminue, un autre augmente
                if (increases.length > 0 && decreases.length > 0) {
                    decreases.forEach(decrease => {
                        increases.forEach(increase => {
                            // Si le target mint est spécifié, vérifier qu'il est impliqué
                            if (targetMint && decrease.mint !== targetMint && increase.mint !== targetMint) {
                                return;
                            }
                            
                            swaps.push({
                                signature: transaction.transaction.signatures[0],
                                slot: transaction.slot,
                                tokenIn: decrease.mint,
                                tokenOut: increase.mint,
                                amountIn: Math.abs(decrease.change),
                                amountOut: increase.change,
                                price: increase.change / Math.abs(decrease.change),
                                invPrice: Math.abs(decrease.change) / increase.change
                            });
                        });
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Erreur analyse transaction:', error.message);
        }
        
        return swaps;
    }

    /**
     * Analyser un slot complet pour des swaps d'un token
     */
    async analyzeSlotForToken(slot, targetMint) {
        console.log(`\n🎯 ANALYSE DU SLOT ${slot} POUR LE TOKEN: ${targetMint}`);
        console.log('='.repeat(80));
        
        const transactions = await this.getSlotTransactions(slot);
        
        if (transactions.length === 0) {
            console.log('❌ Aucune transaction à analyser');
            return [];
        }
        
        let allSwaps = [];
        let txCount = 0;
        
        for (const tx of transactions) {
            txCount++;
            const swaps = this.analyzeTransactionForSwaps(tx, targetMint);
            
            if (swaps.length > 0) {
                console.log(`\n📊 TRANSACTION #${txCount} - ${swaps.length} swap(s) trouvé(s)`);
                console.log(`🔗 Signature: ${tx.transaction.signatures[0]}`);
                
                swaps.forEach((swap, i) => {
                    console.log(`  💱 Swap ${i+1}:`);
                    console.log(`    📉 Token IN:  ${swap.tokenIn} (${swap.amountIn})`);
                    console.log(`    📈 Token OUT: ${swap.tokenOut} (${swap.amountOut})`);
                    console.log(`    💰 Prix: ${swap.price.toFixed(8)} (1 IN = ${swap.price.toFixed(8)} OUT)`);
                    console.log(`    🔄 Prix inv: ${swap.invPrice.toFixed(8)} (1 OUT = ${swap.invPrice.toFixed(8)} IN)`);
                    
                    // Si c'est notre token target, calculer le prix en USD
                    if (swap.tokenIn === targetMint || swap.tokenOut === targetMint) {
                        let usdPrice = null;
                        
                        // Si swap contre SOL (So11111111111111111111111111111111111111112)
                        if (swap.tokenIn === 'So11111111111111111111111111111111111111112') {
                            // Target token acheté avec SOL
                            usdPrice = (swap.amountIn * 170) / swap.amountOut; // Approximation SOL = $170
                            console.log(`    💵 Prix USD estimé: $${usdPrice.toFixed(8)} (target acheté avec SOL)`);
                        } else if (swap.tokenOut === 'So11111111111111111111111111111111111111112') {
                            // Target token vendu contre SOL
                            usdPrice = (swap.amountOut * 170) / swap.amountIn; // Approximation SOL = $170
                            console.log(`    💵 Prix USD estimé: $${usdPrice.toFixed(8)} (target vendu contre SOL)`);
                        }
                    }
                });
                
                allSwaps = allSwaps.concat(swaps);
            }
        }
        
        console.log(`\n📊 RÉSUMÉ DU SLOT ${slot}:`);
        console.log(`  📋 ${transactions.length} transactions analysées`);
        console.log(`  💱 ${allSwaps.length} swaps trouvés pour ${targetMint}`);
        
        if (allSwaps.length > 0) {
            // Calculer prix moyen si plusieurs swaps
            const targetSwaps = allSwaps.filter(s => s.tokenIn === targetMint || s.tokenOut === targetMint);
            if (targetSwaps.length > 0) {
                console.log(`  🎯 ${targetSwaps.length} swaps impliquant le token cible`);
            }
        }
        
        return allSwaps;
    }

    /**
     * Analyser plusieurs slots récents
     */
    async analyzeRecentSlots(targetMint, slotCount = 5) {
        console.log(`\n🚀 ANALYSE DES ${slotCount} DERNIERS SLOTS`);
        console.log('='.repeat(60));
        
        // Récupérer le slot actuel
        const currentSlotResponse = await fetch(this.HELIUS_HTTP_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getSlot"
            })
        });
        
        const currentSlotData = await currentSlotResponse.json();
        const currentSlot = currentSlotData.result;
        
        console.log(`📊 Slot actuel: ${currentSlot}`);
        console.log(`🎯 Token analysé: ${targetMint}`);
        
        // Analyser les derniers slots
        for (let i = 0; i < slotCount; i++) {
            const slot = currentSlot - i;
            await this.analyzeSlotForToken(slot, targetMint);
            
            // Petit délai pour ne pas spammer l'API
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Utilisation
const analyzer = new HeliusTransactionAnalyzer();

// Token BRIX pour test
const TARGET_MINT = '5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx';

console.log('🎯 Démarrage de l\'analyse...');
console.log('💡 Cet outil va analyser les vraies transactions Helius');
console.log('📊 pour comprendre comment extraire les prix réels des swaps\n');

// Analyser un slot spécifique si fourni en argument
if (process.argv[2]) {
    const slot = parseInt(process.argv[2]);
    console.log(`🔍 Analyse du slot spécifique: ${slot}`);
    await analyzer.analyzeSlotForToken(slot, TARGET_MINT);
} else {
    // Analyser les 3 derniers slots
    await analyzer.analyzeRecentSlots(TARGET_MINT, 3);
}

console.log('\n✅ Analyse terminée!');
console.log('💡 Usage: node helius_transaction_analyzer.js [slot_number]'); 