#!/bin/bash

echo "🔧 INSTALLATION DU TUNNEL CLOUDFLARE COMME SERVICE"
echo "=================================================="

# Vérifier les prérequis
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared non installé"
    echo "💡 Installez cloudflared d'abord"
    exit 1
fi

if [ ! -f "config/cloudflared_config.yml" ]; then
    echo "❌ Fichier config/cloudflared_config.yml manquant"
    echo "💡 Le fichier de configuration du tunnel est requis"
    exit 1
fi

# Copier le fichier de configuration vers le répertoire cloudflared
echo "📁 Copie du fichier de configuration..."
cp config/cloudflared_config.yml ~/.cloudflared/config.yml

# Installer le service
echo "⚙️  Installation du service cloudflared..."
sudo cloudflared service install

echo "🚀 Démarrage du service..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sudo launchctl start com.cloudflare.cloudflared
    echo "✅ Service démarré sur macOS"
    echo "📊 Statut: sudo launchctl list | grep cloudflared"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    sudo systemctl start cloudflared
    sudo systemctl enable cloudflared
    echo "✅ Service démarré sur Linux"
    echo "📊 Statut: sudo systemctl status cloudflared"
else
    echo "⚠️  OS non reconnu, démarrage manuel requis"
fi

echo ""
echo "🎉 TUNNEL CLOUDFLARE INSTALLÉ COMME SERVICE !"
echo "============================================="
echo ""
echo "🌐 URL publique: https://0af91ac9-5f76-49c1-893e-acdb55bc223e.cfargotunnel.com"
echo "📡 Webhook URL: https://0af91ac9-5f76-49c1-893e-acdb55bc223e.cfargotunnel.com/helius-webhook"
echo ""
echo "✨ Le tunnel démarrera automatiquement au boot du système"
echo ""
echo "🔧 COMMANDES UTILES:"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "- Arrêter: sudo launchctl stop com.cloudflare.cloudflared"
    echo "- Démarrer: sudo launchctl start com.cloudflare.cloudflared"
    echo "- Statut: sudo launchctl list | grep cloudflared"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "- Arrêter: sudo systemctl stop cloudflared"
    echo "- Démarrer: sudo systemctl start cloudflared"
    echo "- Statut: sudo systemctl status cloudflared"
    echo "- Logs: sudo journalctl -u cloudflared -f"
fi
echo ""
echo "💡 Vous pouvez maintenant configurer Helius avec l'URL webhook ci-dessus" 