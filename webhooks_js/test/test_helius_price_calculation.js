#!/usr/bin/env node

/**
 * 🧪 SCRIPT DE TEST - CALCUL DE PRIX HELIUS
 * 
 * Valide le calcul de prix en temps réel depuis le WebSocket Helius
 * Compare avec DexScreener et Jupiter pour vérifier la précision
 */

import HeliusWebSocketPriceService from './src/helius_websocket_price_service.js';

class HeliusPriceCalculationTester {
    constructor() {
        this.heliusService = new HeliusWebSocketPriceService();
        this.testTokens = [
            'DFfPq2hHbJeunp1F6eNyuyvBHcPpnTqaawn2tAFUpump', // KITTY
            '5umKhqeUQYLWGgWRPzYu3WdJfSwqShvGxBzpR6uH6x2r'  // chat
        ];
        
        this.testResults = {
            totalUpdates: 0,
            heliusCalculated: 0,
            dexScreenerFallbacks: 0,
            priceVariations: [],
            errors: []
        };
        
        this.referencePrice = new Map();
        this.lastHeliusPrice = new Map();
        
        console.log('🧪 Initialisation du testeur de calcul de prix Helius');
        console.log(`📋 Tokens de test: ${this.testTokens.length}`);
    }

    /**
     * Démarrer les tests
     */
    async startTests() {
        console.log('\n🚀 DÉMARRAGE DES TESTS DE CALCUL DE PRIX');
        console.log('═'.repeat(60));
        
        // Démarrer le service Helius
        await this.heliusService.start();
        
        // Ajouter les tokens de test
        for (const mint of this.testTokens) {
            await this.heliusService.addToken(mint);
        }
        
        // Récupérer les prix de référence
        await this.fetchReferencePrices();
        
        // Écouter les mises à jour de prix
        this.heliusService.on('priceUpdate', (priceData) => {
            this.handlePriceUpdate(priceData);
        });
        
        // Lancer les tests périodiques
        this.startPeriodicTests();
        
        console.log('\n✅ Tests démarrés - Surveillance en cours...');
        console.log('🔍 Validation: Calcul Helius vs Prix de référence');
        console.log('⏱️  Rapport de test toutes les 30 secondes');
    }

    /**
     * Récupérer les prix de référence (DexScreener)
     */
    async fetchReferencePrices() {
        console.log('\n📊 Récupération des prix de référence...');
        
        for (const mint of this.testTokens) {
            try {
                const price = await this.heliusService.getDexScreenerPrice(mint);
                if (price) {
                    this.referencePrice.set(mint, price);
                    const symbol = this.heliusService.getTokenSymbol(mint) || mint.substring(0, 8);
                    console.log(`📌 ${symbol}: $${price.toFixed(8)} (référence DexScreener)`);
                }
            } catch (error) {
                console.error(`❌ Erreur prix référence ${mint}:`, error.message);
            }
        }
    }

    /**
     * Traiter une mise à jour de prix
     */
    handlePriceUpdate(priceData) {
        const { mint, price, source, slot } = priceData;
        this.testResults.totalUpdates++;
        
        const symbol = this.heliusService.getTokenSymbol(mint) || mint.substring(0, 8);
        const refPrice = this.referencePrice.get(mint);
        
        if (source === 'helius_realtime') {
            this.testResults.heliusCalculated++;
            this.lastHeliusPrice.set(mint, price);
            
            // Calculer la variation par rapport à la référence
            if (refPrice) {
                const variation = ((price - refPrice) / refPrice) * 100;
                this.testResults.priceVariations.push({
                    mint,
                    symbol,
                    heliusPrice: price,
                    referencePrice: refPrice,
                    variation: variation,
                    slot: slot,
                    timestamp: Date.now()
                });
                
                // Affichage simple sur une ligne
                const variationIcon = Math.abs(variation) < 0.5 ? '🟢' : Math.abs(variation) < 1 ? '🟡' : '🔴';
                const time = new Date().toLocaleTimeString();
                console.log(`${time} | ${symbol.padEnd(6)} | $${price.toFixed(8)} | Δ${variation.toFixed(2)}% ${variationIcon}`);
            }
        } else {
            this.testResults.dexScreenerFallbacks++;
            // Logs fallback moins verbeux
            if (this.testResults.dexScreenerFallbacks % 10 === 1) {
                console.log(`🔄 ${symbol}: Fallback DexScreener $${price.toFixed(8)}`);
            }
        }
        
        // Affichage du tableau des 2 tokens toutes les 5 mises à jour
        if (this.testResults.totalUpdates % 5 === 0) {
            this.displayTokensTable();
        }
    }

    /**
     * Afficher le tableau des 2 tokens
     */
    displayTokensTable() {
        console.log('\n┌─────────────────────────────────────────────────┐');
        console.log('│               🚀 HELIUS PRICING                │');
        console.log('├─────────┬─────────────┬─────────────┬──────────┤');
        console.log('│ TOKEN   │ HELIUS      │ RÉFÉRENCE   │ VARIATION│');
        console.log('├─────────┼─────────────┼─────────────┼──────────┤');
        
        for (const mint of this.testTokens) {
            const symbol = this.heliusService.getTokenSymbol(mint) || mint.substring(0, 6);
            const heliusPrice = this.lastHeliusPrice.get(mint);
            const refPrice = this.referencePrice.get(mint);
            
            let heliusStr = 'N/A';
            let refStr = 'N/A';
            let variationStr = 'N/A';
            
            if (heliusPrice) {
                heliusStr = `$${heliusPrice.toFixed(8)}`;
            }
            if (refPrice) {
                refStr = `$${refPrice.toFixed(8)}`;
            }
            if (heliusPrice && refPrice) {
                const variation = ((heliusPrice - refPrice) / refPrice) * 100;
                const icon = Math.abs(variation) < 0.5 ? '🟢' : Math.abs(variation) < 1 ? '🟡' : '🔴';
                variationStr = `${variation.toFixed(2)}% ${icon}`;
            }
            
            console.log(`│ ${symbol.padEnd(7)} │ ${heliusStr.padEnd(11)} │ ${refStr.padEnd(11)} │ ${variationStr.padEnd(8)} │`);
        }
        
        console.log('└─────────┴─────────────┴─────────────┴──────────┘');
        console.log(`📊 Updates: ${this.testResults.totalUpdates} | Calculs: ${this.testResults.heliusCalculated} | Fallbacks: ${this.testResults.dexScreenerFallbacks}\n`);
    }

    /**
     * Tests périodiques
     */
    startPeriodicTests() {
        // Affichage du tableau toutes les 10 secondes
        setInterval(() => {
            this.displayTokensTable();
        }, 10000);
        
        // Rapport de test toutes les 60 secondes (moins fréquent)
        setInterval(() => {
            this.generateTestReport();
        }, 60000);
        
        // Mise à jour des prix de référence toutes les 2 minutes
        setInterval(() => {
            this.fetchReferencePrices();
        }, 120000);
    }

    /**
     * Générer un rapport de test
     */
    generateTestReport() {
        console.log('\n📊 RAPPORT DE TEST - CALCUL DE PRIX HELIUS');
        console.log('═'.repeat(50));
        console.log(`📈 Total mises à jour    : ${this.testResults.totalUpdates}`);
        console.log(`🧮 Calculs Helius       : ${this.testResults.heliusCalculated}`);
        console.log(`🔄 Fallbacks DexScreener : ${this.testResults.dexScreenerFallbacks}`);
        
        if (this.testResults.heliusCalculated > 0) {
            const heliusRate = (this.testResults.heliusCalculated / this.testResults.totalUpdates * 100).toFixed(1);
            console.log(`⚡ Taux calcul Helius   : ${heliusRate}%`);
        }
        
        // Analyse des variations
        if (this.testResults.priceVariations.length > 0) {
            const recentVariations = this.testResults.priceVariations.slice(-10);
            const avgVariation = recentVariations.reduce((sum, v) => sum + Math.abs(v.variation), 0) / recentVariations.length;
            
            console.log(`📊 Variation moy. (10 dernières): ±${avgVariation.toFixed(2)}%`);
            
            const lowVariations = recentVariations.filter(v => Math.abs(v.variation) < 1).length;
            const mediumVariations = recentVariations.filter(v => Math.abs(v.variation) >= 1 && Math.abs(v.variation) < 5).length;
            const highVariations = recentVariations.filter(v => Math.abs(v.variation) >= 5).length;
            
            console.log(`🟢 Faibles variations (<1%): ${lowVariations}/10`);
            console.log(`🟡 Moyennes variations (1-5%): ${mediumVariations}/10`);
            console.log(`🔴 Fortes variations (>5%): ${highVariations}/10`);
        }
        
        console.log('═'.repeat(50));
    }

    /**
     * Test de comparaison détaillé
     */
    async runDetailedComparison() {
        console.log('\n🔍 TEST DE COMPARAISON DÉTAILLÉ');
        console.log('-'.repeat(40));
        
        for (const mint of this.testTokens) {
            const symbol = this.heliusService.getTokenSymbol(mint) || mint.substring(0, 8);
            const heliusPrice = this.lastHeliusPrice.get(mint);
            const refPrice = this.referencePrice.get(mint);
            
            if (heliusPrice && refPrice) {
                const variation = ((heliusPrice - refPrice) / refPrice) * 100;
                const status = Math.abs(variation) < 1 ? '✅ PRÉCIS' : 
                             Math.abs(variation) < 5 ? '⚠️  MOYEN' : '❌ IMPRÉCIS';
                
                console.log(`${symbol}:`);
                console.log(`  Helius: $${heliusPrice.toFixed(8)}`);
                console.log(`  Référence: $${refPrice.toFixed(8)}`);
                console.log(`  Variation: ${variation > 0 ? '+' : ''}${variation.toFixed(3)}%`);
                console.log(`  Statut: ${status}`);
                console.log('');
            }
        }
    }

    /**
     * Arrêter les tests
     */
    async stopTests() {
        console.log('\n🛑 Arrêt des tests...');
        
        // Rapport final
        this.generateFinalReport();
        
        // Arrêter le service
        await this.heliusService.stop();
        
        console.log('✅ Tests terminés');
    }

    /**
     * Rapport final
     */
    generateFinalReport() {
        console.log('\n📋 RAPPORT FINAL DES TESTS');
        console.log('═'.repeat(60));
        
        console.log(`🔢 Total updates: ${this.testResults.totalUpdates}`);
        console.log(`🧮 Calculs Helius: ${this.testResults.heliusCalculated}`);
        console.log(`🔄 Fallbacks: ${this.testResults.dexScreenerFallbacks}`);
        
        if (this.testResults.priceVariations.length > 0) {
            const allVariations = this.testResults.priceVariations.map(v => Math.abs(v.variation));
            const avgVariation = allVariations.reduce((a, b) => a + b, 0) / allVariations.length;
            const maxVariation = Math.max(...allVariations);
            const minVariation = Math.min(...allVariations);
            
            console.log('\n📊 ANALYSE DES VARIATIONS:');
            console.log(`   Moyenne: ±${avgVariation.toFixed(3)}%`);
            console.log(`   Minimum: ±${minVariation.toFixed(3)}%`);
            console.log(`   Maximum: ±${maxVariation.toFixed(3)}%`);
            
            const preciseCounts = allVariations.filter(v => v < 1).length;
            const precisionRate = (preciseCounts / allVariations.length * 100).toFixed(1);
            
            console.log(`\n🎯 PRÉCISION: ${precisionRate}% des calculs < 1% de variation`);
        }
        
        console.log('\n🔬 VALIDATION DU SYSTÈME:');
        if (this.testResults.heliusCalculated > this.testResults.dexScreenerFallbacks) {
            console.log('✅ Le calcul Helius fonctionne correctement');
        } else {
            console.log('⚠️  Trop de fallbacks - Vérifier la logique de calcul');
        }
    }
}

// Démarrer les tests
const tester = new HeliusPriceCalculationTester();

// Gestion des signaux d'arrêt
process.on('SIGINT', () => {
    console.log('\n🛑 Signal d\'arrêt reçu...');
    tester.stopTests().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Signal de terminaison reçu...');
    tester.stopTests().then(() => process.exit(0));
});

// Démarrer les tests
tester.startTests().catch(error => {
    console.error('❌ Erreur lors du démarrage des tests:', error);
    process.exit(1);
});

export default HeliusPriceCalculationTester; 