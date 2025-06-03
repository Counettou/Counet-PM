#!/bin/bash

echo "🔧 CONFIGURATION WEBHOOK HELIUS"
echo "================================"
echo ""

# Vérifier si le fichier .env existe
if [ ! -f ".env" ]; then
    echo "❌ Fichier .env manquant"
    echo "💡 Création du fichier .env..."
    echo "HELIUS_API_KEY=your_helius_api_key_here" > .env
    echo "✅ Fichier .env créé"
    echo ""
fi

# Vérifier la clé API
source .env
if [ "$HELIUS_API_KEY" = "your_helius_api_key_here" ] || [ -z "$HELIUS_API_KEY" ]; then
    echo "⚠️  CONFIGURATION REQUISE"
    echo "========================="
    echo ""
    echo "Vous devez configurer votre clé API Helius dans le fichier .env"
    echo ""
    echo "📋 Étapes :"
    echo "1. Allez sur https://dev.helius.xyz/"
    echo "2. Créez un compte ou connectez-vous"
    echo "3. Créez un nouveau projet"
    echo "4. Copiez votre clé API"
    echo "5. Remplacez 'your_helius_api_key_here' dans le fichier .env"
    echo ""
    echo "📝 Exemple :"
    echo "   HELIUS_API_KEY=cc507f3f-f8a4-44ea-8ef8-a851f356bc0d"
    echo ""
    echo "💡 Puis relancez ce script : ./configure_webhook.sh"
    exit 1
fi

echo "✅ Clé API Helius configurée"
echo "🔑 Clé : ${HELIUS_API_KEY:0:10}..."
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non installé"
    echo "💡 Installez Node.js : https://nodejs.org"
    exit 1
fi

echo "✅ Node.js disponible"
echo ""

# Vérifier les dépendances
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    echo ""
fi

echo "✅ Dépendances installées"
echo ""

# Lancer la configuration du webhook
echo "🚀 Lancement de la configuration du webhook..."
echo ""

node scripts/setup_helius_webhook.js

echo ""
echo "🎉 Configuration terminée !"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Démarrez votre système : npm run start-tunnel"
echo "2. Vérifiez que le tunnel fonctionne"
echo "3. Surveillez les logs pour voir les transactions" 