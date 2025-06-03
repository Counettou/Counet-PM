#!/usr/bin/env node

/**
 * Script pour changer l'API de prix entre Jupiter et DexScreener
 * Usage: node scripts/switch_api.js [jupiter|dexscreener]
 */

const api = process.argv[2];

if (!api || (api !== 'jupiter' && api !== 'dexscreener')) {
  console.log('❌ Usage: node scripts/switch_api.js [jupiter|dexscreener]');
  console.log('');
  console.log('Exemples:');
  console.log('  node scripts/switch_api.js jupiter     # Passer à Jupiter API');
  console.log('  node scripts/switch_api.js dexscreener # Passer à DexScreener API');
  process.exit(1);
}

async function switchAPI() {
  try {
    console.log(`🔄 Changement vers API ${api.toUpperCase()}...`);
    
    const response = await fetch('http://localhost:8080/api/switch-price-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ api })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅', result.message);
      console.log('📊 Statistiques:', {
        'API primaire': result.stats.primaryAPI,
        'API fallback': result.stats.fallbackAPI,
        'Tokens suivis': result.stats.trackedTokens,
        'Refresh': result.stats.updateInterval + 'ms',
        'Dernière MAJ': result.stats.lastUpdate
      });
    } else {
      console.error('❌ Erreur HTTP:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('💡 Assurez-vous que le serveur est démarré (npm start)');
  }
}

switchAPI(); 