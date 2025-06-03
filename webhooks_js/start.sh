#!/bin/bash

# Script principal pour lancer le système de Webhooks Solana depuis le dossier webhooks_js

# S'assurer que les commandes sont exécutées depuis le répertoire du script (c'est-à-dire webhooks_js)
# Cette commande change le répertoire courant au répertoire où se trouve le script.
cd "$(dirname "$0")"

echo "🚀 Lancement du système de Webhooks Solana depuis $PWD..."

# Vérification des dépendances Node.js
echo "🔍 Vérification des dépendances..."
if [ ! -f "package.json" ]; then
    echo "❌ Fichier package.json introuvable dans $PWD"
    exit 1
fi

if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo "📦 Installation des dépendances npm requises..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Échec de l'installation des dépendances npm"
        exit 1
    fi
    echo "✅ Dépendances installées avec succès"
else
    echo "✅ Dépendances déjà installées"
fi

# Lancer le script de démarrage du tunnel et du serveur local via 'npm start'.
# 'npm start' est configuré dans package.json (dans ce même dossier)
# pour exécuter './scripts/start_tunnel.sh'.
if [ -f "./scripts/start_tunnel.sh" ]; then
    npm start
else
    echo "❌ Le script ./scripts/start_tunnel.sh est introuvable dans $PWD."
    echo "   Ce script est nécessaire et devrait être appelé par 'npm start'."
    echo "💡 Assurez-vous que le projet webhooks_js est correctement configuré."
    exit 1
fi 