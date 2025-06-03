#!/bin/bash

echo "🚀 LANCEMENT SIMPLE - TUNNEL CLOUDFLARE STABLE"
echo "=============================================="

# Nettoyer les anciens processus
pkill -f "websocket_server" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true

echo "🧹 Anciens processus nettoyés"

# Démarrer le serveur WebSocket
echo "🌐 Démarrage du serveur WebSocket..."
node src/websocket_server.js &
SERVER_PID=$!

# Attendre que le serveur démarre
sleep 5

# Vérifier que le serveur fonctionne
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "✅ Serveur WebSocket opérationnel (PID: $SERVER_PID)"
else
    echo "❌ Erreur: Serveur WebSocket non accessible"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Démarrer le tunnel Cloudflare
echo "🌉 Démarrage du tunnel Cloudflare..."
cloudflared tunnel --config config/cloudflared_config.yml run helius-tunnel &
TUNNEL_PID=$!

# Attendre que le tunnel démarre
sleep 10

echo ""
echo "🎉 SYSTÈME OPÉRATIONNEL !"
echo "========================"
echo "✅ Serveur WebSocket: PID $SERVER_PID"
echo "✅ Tunnel Cloudflare: PID $TUNNEL_PID"
echo ""
echo "🌐 Interface locale: http://localhost:8080"
echo "🌐 Interface publique: https://0af91ac9-5f76-49c1-893e-acdb55bc223e.cfargotunnel.com"
echo "📡 Webhook URL: https://0af91ac9-5f76-49c1-893e-acdb55bc223e.cfargotunnel.com/helius-webhook"
echo ""
echo "💡 Testez maintenant le bouton 'Send Test Webhook' sur Helius"
echo "💡 Surveillez ce terminal pour voir les webhooks arriver"
echo ""
echo "🛑 Ctrl+C pour arrêter"

# Fonction de nettoyage
cleanup() {
    echo ""
    echo "🧹 Arrêt du système..."
    kill $SERVER_PID 2>/dev/null
    kill $TUNNEL_PID 2>/dev/null
    echo "✅ Système arrêté"
    exit 0
}

# Gérer Ctrl+C
trap cleanup SIGINT SIGTERM

# Attendre indéfiniment (sans surveillance qui cause les déconnexions)
echo "⏳ Système en cours d'exécution... (Ctrl+C pour arrêter)"
wait 