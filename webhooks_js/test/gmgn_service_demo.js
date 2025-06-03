#!/usr/bin/env node

import GMGNPriceService from '../src/services/GMGNPriceService.js';

/**
 * 🎯 DÉMONSTRATION SERVICE GMGN - TOKEN CHAT
 * 
 * Test du service de prix temps réel GMGN
 * avec le token "chat" en surveillance continue
 */

const CHAT_TOKEN = '5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump';

console.log('🎯 DÉMONSTRATION SERVICE GMGN - TOKEN CHAT');
console.log('═'.repeat(60));
console.log(`🪙 Token surveillé: ${CHAT_TOKEN}`);
console.log('🔄 Démarrage de la surveillance temps réel...\n');

// Créer le service avec configuration personnalisée
const priceService = new GMGNPriceService({
    updateInterval: 15000, // Mise à jour toutes les 15 secondes
    retryDelay: 3000,
    maxRetries: 3,
    timeout: 10000
});

// Statistiques
let updateCount = 0;
let errorCount = 0;
let startTime = Date.now();

/**
 * Gestionnaires d'événements
 */
priceService.on('priceUpdate', (event) => {
    updateCount++;
    const { tokenAddress, priceData, priceChange, isNewData } = event;
    
    const time = new Date().toLocaleTimeString('fr-FR');
    
    if (isNewData) {
        console.log('\n🎉 PREMIÈRE RÉCUPÉRATION DU PRIX!');
        console.log('═'.repeat(50));
    } else {
        console.log('\n📊 MISE À JOUR DU PRIX');
        console.log('─'.repeat(30));
    }
    
    console.log(`🕒 Heure: ${time}`);
    console.log(`🪙 Token: ${priceData.symbol} (${priceData.name})`);
    console.log(`💵 Prix actuel: $${priceData.price.toFixed(8)}`);
    
    if (priceChange !== null) {
        const changeIcon = priceChange >= 0 ? '📈' : '📉';
        const changeColor = priceChange >= 0 ? '+' : '';
        console.log(`${changeIcon} Variation: ${changeColor}${priceChange.toFixed(4)}%`);
    }
    
    // Historique des prix
    console.log('\n📈 Historique des prix:');
    console.log(`  - 1 minute: $${priceData.priceHistory['1m']?.toFixed(8) || 'N/A'}`);
    console.log(`  - 5 minutes: $${priceData.priceHistory['5m']?.toFixed(8) || 'N/A'}`);
    console.log(`  - 1 heure: $${priceData.priceHistory['1h']?.toFixed(8) || 'N/A'}`);
    console.log(`  - 24 heures: $${priceData.priceHistory['24h']?.toFixed(8) || 'N/A'}`);
    
    // Variations sur différentes périodes
    if (priceData.change1h !== undefined) {
        const icon1h = priceData.change1h >= 0 ? '📈' : '📉';
        console.log(`${icon1h} Variation 1h: ${priceData.change1h >= 0 ? '+' : ''}${priceData.change1h.toFixed(2)}%`);
    }
    
    if (priceData.change24h !== undefined) {
        const icon24h = priceData.change24h >= 0 ? '📈' : '📉';
        console.log(`${icon24h} Variation 24h: ${priceData.change24h >= 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%`);
    }
    
    // Données de marché
    console.log('\n💹 Données de marché:');
    console.log(`  - Volume 24h: $${priceData.volume24h?.toLocaleString() || 'N/A'}`);
    console.log(`  - Market Cap: $${priceData.marketCap?.toLocaleString() || 'N/A'}`);
    console.log(`  - Holders: ${priceData.holderCount?.toLocaleString() || 'N/A'}`);
    
    // Activité de trading
    if (priceData.swaps) {
        console.log('\n🔄 Activité de trading:');
        console.log(`  - Swaps 5m: ${priceData.swaps['5m'] || 'N/A'}`);
        console.log(`  - Swaps 1h: ${priceData.swaps['1h'] || 'N/A'}`);
        console.log(`  - Swaps 24h: ${priceData.swaps['24h'] || 'N/A'}`);
    }
    
    console.log(`\n📊 Source: ${priceData.source}`);
    console.log(`🔢 Mise à jour #${updateCount}`);
});

priceService.on('error', (event) => {
    errorCount++;
    const { tokenAddress, error, timestamp } = event;
    
    console.log(`\n❌ ERREUR lors de la récupération du prix:`);
    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Erreur: ${error}`);
    console.log(`  Heure: ${new Date(timestamp).toLocaleTimeString('fr-FR')}`);
    console.log(`  Total erreurs: ${errorCount}`);
});

priceService.on('monitoringStarted', (event) => {
    console.log(`✅ Surveillance démarrée: ${event.tokenAddress}`);
    console.log(`⏱️ Intervalle: ${event.interval/1000} secondes\n`);
});

priceService.on('monitoringStopped', (event) => {
    console.log(`🛑 Surveillance arrêtée: ${event.tokenAddress}`);
});

/**
 * Affichage périodique des statistiques
 */
function showStats() {
    const stats = priceService.getStats();
    const runTime = ((Date.now() - startTime) / 1000).toFixed(0);
    
    console.log('\n📊 STATISTIQUES DE SESSION');
    console.log('═'.repeat(40));
    console.log(`⏱️ Durée: ${runTime}s`);
    console.log(`📈 Mises à jour: ${updateCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    console.log(`🎯 Tokens surveillés: ${stats.monitoredTokensCount}`);
    console.log(`💾 Cache: ${stats.cacheSize} entrée(s)`);
    console.log(`🔄 Service actif: ${stats.isRunning ? 'Oui' : 'Non'}`);
    
    if (stats.lastUpdate) {
        const lastUpdateTime = new Date(stats.lastUpdate).toLocaleTimeString('fr-FR');
        console.log(`🕒 Dernière MAJ: ${lastUpdateTime}`);
    }
    
    // Calculer le taux de succès
    const totalAttempts = updateCount + errorCount;
    if (totalAttempts > 0) {
        const successRate = ((updateCount / totalAttempts) * 100).toFixed(1);
        console.log(`✅ Taux de succès: ${successRate}%`);
    }
    
    console.log('═'.repeat(40));
}

/**
 * Démarrage du test
 */
async function main() {
    try {
        // Démarrer la surveillance
        priceService.startMonitoring(CHAT_TOKEN);
        
        // Afficher les stats toutes les minutes
        const statsInterval = setInterval(showStats, 60000);
        
        // Instructions
        console.log('💡 INSTRUCTIONS:');
        console.log('  - Appuyez sur Ctrl+C pour arrêter');
        console.log('  - Les prix sont mis à jour toutes les 15 secondes');
        console.log('  - Les statistiques s\'affichent toutes les minutes');
        console.log('  - Comparez avec https://www.gmgn.cc/kline/sol/' + CHAT_TOKEN);
        
        // Gestion de l'arrêt propre
        process.on('SIGINT', () => {
            console.log('\n🛑 Arrêt en cours...');
            
            clearInterval(statsInterval);
            priceService.stopAllMonitoring();
            
            setTimeout(() => {
                console.log('\n📊 RÉSUMÉ FINAL:');
                showStats();
                
                // Afficher le dernier prix connu
                const lastPrice = priceService.getPrice(CHAT_TOKEN);
                if (lastPrice) {
                    console.log(`\n💰 DERNIER PRIX CONNU:`);
                    console.log(`  ${lastPrice.symbol}: $${lastPrice.price.toFixed(8)}`);
                    console.log(`  Récupéré à: ${new Date(lastPrice.timestamp).toLocaleString('fr-FR')}`);
                }
                
                console.log('\n✅ Service arrêté. Au revoir!');
                process.exit(0);
            }, 1000);
        });
        
    } catch (error) {
        console.error('❌ Erreur fatale:', error.message);
        process.exit(1);
    }
}

// Démarrage
main(); 