#!/bin/bash

# 🧹 Script de Nettoyage Complet des Données
# ==========================================

echo "🧹 NETTOYAGE COMPLET DES DONNÉES"
echo "================================="

# Créer un dossier d'archive avec timestamp
ARCHIVE_DIR="archive/$(date +%Y-%m-%d_%H-%M-%S)_before_clean"
mkdir -p "$ARCHIVE_DIR"

echo "📦 Création de l'archive: $ARCHIVE_DIR"

# Sauvegarder les données existantes
if [ -d "positions" ]; then
    cp -r positions/ "$ARCHIVE_DIR/"
    echo "✅ Positions sauvegardées"
fi

if [ -d "received_transactions" ]; then
    cp -r received_transactions/ "$ARCHIVE_DIR/"
    echo "✅ Transactions sauvegardées"
fi

# Créer un README dans l'archive
echo "📦 ARCHIVE COMPLÈTE - $(date)" > "$ARCHIVE_DIR/README.txt"
echo "🎯 Données avant nettoyage complet" >> "$ARCHIVE_DIR/README.txt"
echo "🔧 Système avec montants nets v2.4+" >> "$ARCHIVE_DIR/README.txt"

# Nettoyer toutes les positions (sauf caches)
echo ""
echo "🗑️  Nettoyage des positions..."
rm -f positions/*.json 2>/dev/null || true

# Nettoyer toutes les transactions
echo "🗑️  Nettoyage des transactions..."
rm -f received_transactions/*.json 2>/dev/null || true

# Recréer les fichiers de base vides
echo "📝 Recréation des fichiers de base..."

# Cache de prix vide
echo "{}" > positions/price_cache.json

# Cache de métadonnées vide  
echo "{}" > positions/token_metadata_cache.json

# Transactions récentes vides
echo "[]" > received_transactions/recent_transactions.json

echo ""
echo "✅ NETTOYAGE TERMINÉ !"
echo "====================="
echo "📦 Archive créée: $ARCHIVE_DIR"
echo "🆕 Base de données vierge prête pour nouveaux tests"
echo "🚀 Le système est prêt avec les montants nets exacts !"
echo ""
echo "Pour restaurer les données:"
echo "  cp -r $ARCHIVE_DIR/positions/* positions/"
echo "  cp -r $ARCHIVE_DIR/received_transactions/* received_transactions/" 