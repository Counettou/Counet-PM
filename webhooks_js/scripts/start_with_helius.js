#!/usr/bin/env node

/**
 * 🚀 SCRIPT DE DÉMARRAGE - SYSTÈME AVEC HELIUS
 * 
 * Démarre le serveur WebSocket avec le nouveau service de pricing Helius
 * Remplace complètement Jupiter par Helius pour les prix temps réel
 */

import WebSocketPositionServer from '../src/websocket_server.js';

console.log('🚀 DÉMARRAGE DU SYSTÈME AVEC HELIUS');
console.log('═'.repeat(50));
console.log('🎯 Pricing: HELIUS WEBSOCKET (temps réel)');
console.log('🔄 Fallback: DEXSCREENER API');
console.log('⚡ Performance: Temps réel vs 15s Jupiter');
console.log('═'.repeat(50));

const server = new WebSocketPositionServer(8080);

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt du serveur...');
  await server.stop();
  console.log('✅ Système arrêté proprement');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Signal de terminaison reçu...');
  await server.stop();
  process.exit(0);
});

// Démarrage asynchrone avec gestion d'erreurs
(async () => {
  try {
    await server.start();
    
    console.log('');
    console.log('✅ SYSTÈME DÉMARRÉ AVEC HELIUS !');
    console.log('📊 Interface: http://localhost:8080');
    console.log('🔌 WebSocket: ws://localhost:8080');
    console.log('🚀 Pricing Helius: ACTIF');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur démarrage système:', error);
    process.exit(1);
  }
})(); 