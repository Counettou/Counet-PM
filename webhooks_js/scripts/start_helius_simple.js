#!/usr/bin/env node

/**
 * 🚀 SCRIPT DE DÉMARRAGE SIMPLIFIÉ - HELIUS
 * 
 * Version allégée qui ne charge que les positions ouvertes
 * Port 8081 pour éviter les conflits
 */

import WebSocketPositionServer from '../src/websocket_server.js';

console.log('🚀 DÉMARRAGE SIMPLIFIÉ - HELIUS');
console.log('═'.repeat(50));
console.log('🎯 Pricing: HELIUS WEBSOCKET (temps réel)');
console.log('🔄 Fallback: DEXSCREENER API');
console.log('⚡ Port: 8081 (évite les conflits)');
console.log('═'.repeat(50));

// Utiliser le port 8081 pour éviter les conflits
const server = new WebSocketPositionServer(8081);

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

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur non capturée:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejetée non gérée:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

// Démarrage asynchrone avec gestion d'erreurs renforcée
(async () => {
  try {
    console.log('🔄 Initialisation du serveur...');
    await server.start();
    
    console.log('');
    console.log('✅ SYSTÈME HELIUS DÉMARRÉ !');
    console.log('📊 Interface: http://localhost:8081');
    console.log('🔌 WebSocket: ws://localhost:8081');
    console.log('🚀 Pricing Helius: ACTIF');
    console.log('📈 Seules les positions OUVERTES sont suivies');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur démarrage système:', error.message);
    console.error('📍 Type erreur:', error.name);
    console.error('📝 Stack trace:', error.stack);
    
    // Essayer de diagnostiquer le problème spécifique
    if (error.message.includes('EADDRINUSE')) {
      console.error('🔍 Diagnostic: Port 8081 déjà utilisé');
      console.error('💡 Solution: Arrêtez le processus existant ou changez de port');
    } else if (error.message.includes('EACCES')) {
      console.error('🔍 Diagnostic: Permissions insuffisantes');
      console.error('💡 Solution: Vérifiez les droits d\'accès');
    } else if (error.message.includes('WebSocket')) {
      console.error('🔍 Diagnostic: Problème de connexion WebSocket Helius');
      console.error('💡 Solution: Vérifiez votre connexion internet et l\'API key Helius');
    }
    
    process.exit(1);
  }
})(); 