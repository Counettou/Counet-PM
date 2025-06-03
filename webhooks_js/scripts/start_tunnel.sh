#!/bin/bash

echo "🚀 SOLANA POSITION MANAGER - TUNNEL CLOUDFLARE PERMANENT"
echo "========================================================"

# Vérifier les prérequis
if [ ! -f ".env" ]; then
    echo "❌ Fichier .env manquant"
    echo "💡 Créez un fichier .env avec : HELIUS_API_KEY=votre_cle_api"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js non installé"
    echo "💡 Installez Node.js : https://nodejs.org"
    exit 1
fi

if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared non installé"
    echo "💡 Installez cloudflared : https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    exit 1
fi

if [ ! -f "config/cloudflared_config.yml" ]; then
    echo "❌ Fichier config/cloudflared_config.yml manquant"
    echo "💡 Le fichier de configuration du tunnel est requis"
    exit 1
fi

echo "✅ Prérequis OK"

# Variables globales
WEBSOCKET_PID=""
TUNNEL_PID=""
TUNNEL_ID="0af91ac9-5f76-49c1-893e-acdb55bc223e"

# Fonction de nettoyage
cleanup() {
    echo ""
    echo "🧹 Arrêt du système complet..."
    
    # Arrêter le serveur WebSocket
    if [ ! -z "$WEBSOCKET_PID" ]; then
        kill $WEBSOCKET_PID 2>/dev/null
        echo "✅ Serveur WebSocket arrêté"
    fi
    
    # Arrêter le tunnel Cloudflare
    if [ ! -z "$TUNNEL_PID" ]; then
        kill $TUNNEL_PID 2>/dev/null
        echo "✅ Tunnel Cloudflare arrêté"
    fi
    
    # Arrêter tous les processus liés
    pkill -f "scripts/start_helius_simple.js" 2>/dev/null
    pkill -f "cloudflared" 2>/dev/null
    
    echo "✅ Système arrêté proprement"
    exit 0
}

# Gérer Ctrl+C
trap cleanup SIGINT SIGTERM

# Fonction pour démarrer le serveur WebSocket
start_websocket_server() {
    echo "🌐 Démarrage du serveur WebSocket..."
    
    # Arrêter l'ancien serveur s'il existe
    pkill -f "scripts/start_helius_simple.js" 2>/dev/null || true
    
    # Démarrer le nouveau serveur en arrière-plan avec le script adapté
    node scripts/start_helius_simple.js &
    WEBSOCKET_PID=$!
    
    # Attendre que le serveur démarre (plus de temps pour l'initialisation Helius)
    echo "⏳ Attente de l'initialisation complète (15s)..."
    sleep 15
    
    # Vérification progressive du démarrage
    echo "🔍 Vérification du démarrage du serveur..."
    local retries=0
    local max_retries=5
    
    while [ $retries -lt $max_retries ]; do
        if curl -s http://localhost:8081/api/health > /dev/null 2>&1; then
            break
        fi
        retries=$((retries + 1))
        echo "⏳ Tentative $retries/$max_retries - Attente de 3s..."
        sleep 3
    done
    
    # Vérifier que le serveur fonctionne (sur le port du script simplifié)
    if curl -s http://localhost:8081/api/health > /dev/null 2>&1; then
        echo "✅ Serveur WebSocket démarré (PID: $WEBSOCKET_PID)"
        echo "🌐 Interface Web: http://localhost:8081"
        echo "🔌 WebSocket: ws://localhost:8081"
        echo "📡 API REST: http://localhost:8081/api/positions"
        return 0
    else
        echo "❌ Erreur démarrage serveur WebSocket"
        return 1
    fi
}

# Fonction pour démarrer le tunnel Cloudflare
start_cloudflare_tunnel() {
    echo "🌉 Démarrage du tunnel Cloudflare..."
    
    # Arrêter l'ancien tunnel s'il existe
    pkill -f "cloudflared" 2>/dev/null || true
    
    # Démarrer le tunnel en arrière-plan
    cloudflared tunnel --config config/cloudflared_config.yml run helius-tunnel &
    TUNNEL_PID=$!
    
    # Attendre que le tunnel démarre
    sleep 5
    
    echo "✅ Tunnel Cloudflare démarré (PID: $TUNNEL_PID)"
    echo "🌐 URL publique: https://$TUNNEL_ID.cfargotunnel.com"
    echo "📡 Webhook URL: https://$TUNNEL_ID.cfargotunnel.com/helius-webhook"
    
    return 0
}

# Fonction pour afficher le statut du système
show_status() {
    echo ""
    echo "📊 STATUT DU SYSTÈME"
    echo "===================="
    
    # Vérifier le serveur WebSocket
    if curl -s http://localhost:8081/api/health > /dev/null 2>&1; then
        echo "✅ Serveur WebSocket: Opérationnel"
        
        # Récupérer les statistiques
        local stats=$(curl -s http://localhost:8081/api/health 2>/dev/null)
        if [ ! -z "$stats" ]; then
            echo "   📊 $(echo "$stats" | grep -o '\"positions\":[0-9]*' | cut -d':' -f2) positions"
            echo "   📝 $(echo "$stats" | grep -o '\"transactions\":[0-9]*' | cut -d':' -f2) transactions"
            echo "   👥 $(echo "$stats" | grep -o '\"clients\":[0-9]*' | cut -d':' -f2) clients connectés"
        fi
    else
        echo "❌ Serveur WebSocket: Non accessible"
    fi
    
    # Vérifier le tunnel
    if ps -p $TUNNEL_PID > /dev/null 2>&1; then
        echo "✅ Tunnel Cloudflare: Opérationnel"
    else
        echo "❌ Tunnel Cloudflare: Non accessible"
    fi
    
    echo "🎯 Wallet surveillé: CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB"
    echo "🌐 URL publique: https://$TUNNEL_ID.cfargotunnel.com"
}

# DÉMARRAGE PRINCIPAL
echo ""
echo "🎯 PHASE 1: Démarrage du Serveur Local"
echo "======================================"

if ! start_websocket_server; then
    echo "❌ Échec démarrage serveur"
    cleanup
fi

echo ""
echo "🎯 PHASE 2: Démarrage du Tunnel Cloudflare"
echo "=========================================="

if ! start_cloudflare_tunnel; then
    echo "❌ Échec démarrage tunnel"
    cleanup
fi

echo ""
echo "🎉 SYSTÈME TUNNEL CLOUDFLARE OPÉRATIONNEL !"
echo "============================================"

show_status

echo ""
echo "✨ FONCTIONNALITÉS ACTIVES:"
echo "- 📡 Réception directe des webhooks Helius"
echo "- 💾 Sauvegarde automatique des transactions"
echo "- 📊 Suivi des positions en temps réel"
echo "- 🌐 Interface web interactive"
echo "- 🔌 API WebSocket pour applications"
echo "- 🌉 Tunnel Cloudflare permanent"
echo ""
echo "🌐 ACCÈS:"
echo "- Interface Web: http://localhost:8081"
echo "- Interface Web Publique: https://$TUNNEL_ID.cfargotunnel.com"
echo "- API REST: http://localhost:8081/api/positions"
echo "- WebSocket: ws://localhost:8081"
echo ""
echo "📡 WEBHOOK HELIUS:"
echo "- URL à configurer: https://$TUNNEL_ID.cfargotunnel.com/helius-webhook"
echo ""
echo "📁 DONNÉES SAUVÉES:"
echo "- Positions: ./positions/"
echo "- Transactions: ./received_transactions/"
echo ""
echo "🛑 Ctrl+C pour arrêter tout le système"
echo ""

# Surveillance continue
while true; do
    sleep 30
    
    # Vérifier que le serveur fonctionne toujours
    if ! curl -s http://localhost:8081/api/health > /dev/null 2>&1; then
        echo "⚠️  [$(date)] Serveur WebSocket non accessible - redémarrage..."
        start_websocket_server
    fi
    
    # Vérifier que le tunnel fonctionne toujours
    if ! ps -p $TUNNEL_PID > /dev/null 2>&1; then
        echo "⚠️  [$(date)] Tunnel Cloudflare non accessible - redémarrage..."
        start_cloudflare_tunnel
    fi
    
    # Afficher un statut périodique (toutes les 5 minutes)
    if [ $(($(date +%s) % 300)) -eq 0 ]; then
        echo "📊 [$(date)] Système actif - Webhook: https://$TUNNEL_ID.cfargotunnel.com/helius-webhook"
    fi
done 