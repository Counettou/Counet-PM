#!/usr/bin/env node
import PositionManager from '../src/position_manager.js';

async function preloadMetadata() {
  console.log("🔄 PRÉ-CHARGEMENT DES MÉTADONNÉES DES TOKENS");
  console.log("==========================================");
  
  const positionManager = new PositionManager();
  
  // Récupérer tous les tokens uniques des positions
  const allTokens = new Set();
  for (const position of positionManager.positions.values()) {
    allTokens.add(position.mint);
  }
  
  console.log(`📊 ${allTokens.size} token(s) unique(s) trouvé(s)`);
  
  if (allTokens.size === 0) {
    console.log("❌ Aucun token trouvé dans les positions");
    return;
  }
  
  // Pré-charger les métadonnées pour chaque token
  let successCount = 0;
  for (const mint of allTokens) {
    try {
      console.log(`\n🔍 Récupération métadonnées pour: ${mint.substring(0, 8)}...`);
      const metadata = await positionManager.metadataService.getTokenMetadata(mint);
      
      if (metadata.name || metadata.symbol) {
        console.log(`✅ Trouvé: ${metadata.symbol || metadata.name} (${metadata.source})`);
        successCount++;
      } else {
        console.log(`⚠️  Aucune métadonnée trouvée`);
      }
    } catch (error) {
      console.error(`❌ Erreur pour ${mint}:`, error.message);
    }
  }
  
  console.log(`\n🎉 PRÉ-CHARGEMENT TERMINÉ !`);
  console.log(`✅ ${successCount}/${allTokens.size} tokens enrichis avec succès`);
  
  // Afficher le résumé enrichi
  console.log("\n📊 RÉSUMÉ ENRICHI :");
  const enrichedSummary = await positionManager.getEnrichedPositionsSummary();
  
  enrichedSummary.positions.forEach(pos => {
    const tokenDisplay = pos.tokenSymbol || pos.tokenName || 'Token Inconnu';
    const source = pos.metadataSource ? ` (${pos.metadataSource})` : '';
    console.log(`   • ${tokenDisplay}${source} - ${pos.mint.substring(0, 8)}...`);
  });
}

// Exécuter le script
preloadMetadata().catch(console.error); 