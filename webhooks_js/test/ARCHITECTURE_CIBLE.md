# 🏗️ Architecture Cible - Système de Monitoring Solana

*Version finale après analyse approfondie du code existant*

## 🎯 Objectifs de la Refactorisation

### Principes Directeurs
- **Simplicité** : Pas de complexité inutile, architecture pragmatique
- **Robustesse** : Code fiable et stable pour un fonctionnement 24/7
- **Modularité** : Composants séparés et réutilisables
- **Évolutivité** : Préparation pour migration BDD et déploiement cloud
- **Maintenabilité** : Structure claire pour développement futur
- **Performance de Vente Optimisée** : Introduction d'une logique de pré-calcul pour minimiser la latence des opérations de vente, visant une exécution quasi-instantanée post-clic.

### Préparation pour l'Évolution
- Migration des fichiers JSON vers base de données
- Déploiement en ligne pour fonctionnement continu
- Extensibilité pour nouvelles fonctionnalités

## 📁 Structure Cible Recommandée

```
webhooks_js/
├── 📂 src/                          # Code source principal
│   ├── 📂 core/                     # Services métier principaux
│   │   ├── position-manager.js      # Gestionnaire positions (refactoré)
│   │   ├── transaction-analyzer.js  # Analyse transactions (extrait)
│   │   └── platform-detector.js     # Détection DEX (extrait)
│   ├── 📂 services/                 # Services techniques
│   │   ├── price-service.js         # Service prix (simplifié)
│   │   ├── metadata-service.js      # Service métadonnées
│   │   ├── realtime-price.js        # Prix temps réel
│   │   └── webhook-processor.js     # Traitement webhooks
│   ├── 📂 server/                   # Infrastructure serveur
│   │   ├── websocket-server.js      # Serveur WebSocket (simplifié)
│   │   ├── api-routes.js            # Routes API REST
│   │   └── middleware.js            # Middlewares HTTP
│   ├── 📂 storage/                  # Couche de stockage
│   │   ├── file-storage.js          # Stockage fichiers (actuel)
│   │   └── storage-interface.js     # Interface (prêt pour BDD)
│   └── app.js                       # Point d'entrée principal
├── 📂 data/                         # Données persistantes SEULEMENT
│   ├── 📂 positions/                # Positions actuelles
│   │   └── current_positions.json   # État actuel uniquement
│   ├── 📂 cache/                    # Caches temporaires
│   │   ├── token_metadata.json      # Cache métadonnées
│   │   └── price_cache.json         # Cache prix
│   └── 📂 backups/                  # Sauvegardes automatiques
│       └── daily/                   # Sauvegardes quotidiennes
├── 📂 config/                       # Configuration
│   ├── cloudflared.yml              # Configuration tunnel
│   ├── webhook.json                 # Config webhook
│   └── app.json                     # Configuration app
├── 📂 scripts/                      # Scripts utilitaires
│   ├── 📂 setup/                    # Installation et configuration
│   │   ├── install-tunnel.sh        # Installation tunnel
│   │   └── configure-webhook.sh     # Configuration webhook
│   ├── 📂 maintenance/              # Maintenance
│   │   ├── backup-data.sh           # Sauvegarde données
│   │   └── clean-old-files.sh       # Nettoyage
│   └── 📂 development/              # Développement
│       └── test-webhook.js          # Tests webhook
├── 📂 public/                       # Interface web
│   ├── index.html                   # Interface principale
│   ├── assets/                      # CSS, JS, images
│   └── docs/                        # Documentation API
├── 📂 logs/                         # Logs applicatifs
│   ├── app.log                      # Log principal
│   ├── errors.log                   # Erreurs
│   └── webhook.log                  # Log webhooks
├── 📂 temp/                         # Fichiers temporaires
│   └── transactions/                # Transactions en cours
└── 📂 docs/                         # Documentation technique
    ├── CHANGELOG.md                 # Historique versions
    ├── API.md                       # Documentation API
    └── DEPLOYMENT.md                # Guide déploiement
```

## 🔧 Refactorisation des Composants

### Core Components (src/core/)

#### 1. PositionManager (Simplifié)
```javascript
// Responsabilités réduites :
- Gestion état des positions
- Coordination entre services
- Émission d'événements

// Services extraits :
- Analyse des transactions → TransactionAnalyzer
- Détection plateforme → PlatformDetector
```

#### 2. TransactionAnalyzer (Nouveau)
```javascript
// Logique métier pure :
- Analyse des transactions Solana
- Calcul prix d'achat/vente
- Détection type d'opération (BUY/SELL)
```

#### 3. PlatformDetector (Nouveau)
```javascript
// Détection intelligente :
- Pump.fun, Raydium, CPMM, Meteora
- Logique de fallback native
- Traçabilité des méthodes
```

### Services Layer (src/services/)

#### Services Techniques Spécialisés
- **PriceService** : Prix historiques uniquement
- **MetadataService** : Métadonnées tokens
- **RealtimePriceService** : Prix temps réel
- **WebhookProcessor** : Traitement webhooks entrants
- **OptimizedSellService (Nouveau)** : Service pour ventes ultra-rapides.
  // Responsabilités principales :
  // - Orchestration des ventes avec pré-calcul intensif.
  // - Maintien en cache du solde actuel des tokens pertinents.
  // - Pré-calcul des quantités à vendre pour les pourcentages clés (25%, 50%, 100%).
  // - "Chauffage" (warm-up) et mise en cache périodiques des quotes de transaction (ex: via Jupiter API).
  // - Validation rapide de la pertinence du quote avant envoi (ex: déviation du solde).
  // - Construction, signature et envoi de la transaction optimisée (ex: via Helius RPC).
  // - Suivi de la confirmation de la transaction.

### Server Layer (src/server/)

#### Infrastructure Simplifiée
- **WebSocketServer** : WebSocket pur, sans logique métier
- **ApiRoutes** : Routes REST organisées
- **Middleware** : CORS, authentification, logging

### Storage Layer (src/storage/)

#### Abstraction Stockage
```javascript
// Interface unifiée pour migration BDD
class StorageInterface {
  async savePosition(position) {}
  async getPositions() {}
  async saveTransaction(tx) {}
  // Implémentations : FileStorage (actuel) → DatabaseStorage (futur)
}
```

## 🗂️ Gestion des Données

### Nettoyage Radical du Dossier Positions
**SUPPRESSION** de tous les fichiers temporaires :
- `*_backup_*.json` (78+ fichiers de backup)
- `positions_2025-*.json` (snapshots temporels)
- `*_correction_backup_*.json` (corrections ponctuelles)
- `validation_report_*.json` (rapports temporaires)

**CONSERVATION** uniquement :
- `current_positions.json` (état actuel)
- `token_metadata_cache.json` (cache métadonnées)
- `price_cache.json` (cache prix)

### Système de Backup Intelligent
```bash
# Sauvegarde quotidienne automatique
scripts/maintenance/backup-data.sh
├── Sauvegarde vers data/backups/daily/
├── Rétention 30 jours
└── Compression automatique
```

### Nettoyage Transactions
- Dossier `received_transactions/` : conservation 7 derniers jours
- Compression et archivage automatique
- Purge des doublons et fichiers corrompus

## 📋 Plan de Migration

### Phase 1 : Restructuration (2-3 heures)
1. **Création nouvelle structure** de dossiers
2. **Déplacement et renommage** des fichiers existants
3. **Nettoyage radical** des données temporaires
4. **Mise à jour imports** et chemins
5. **Tests de non-régression**

### Phase 2 : Refactorisation (4-6 heures)
1. **Extraction TransactionAnalyzer** du PositionManager
2. **Extraction PlatformDetector** avec logique métier
3. **Simplification WebSocketServer** (suppression logique métier)
4. **Création couche Storage** avec interface abstraite
5. **Réorganisation scripts** par catégorie

### Phase 3 : Optimisation (2-4 heures)
1. **Amélioration gestion erreurs** et logging
2. **Optimisation performances** et mémoire
3. **Documentation API** et guides
4. **Configuration environnements** (dev/prod)
5. **Tests d'intégration** complets
6. **Implémentation de `OptimizedSellService`** avec la logique de pré-calcul des soldes, quantités, et chauffage/caching des quotes de transaction.

### Phase 4 : Préparation Évolution (optionnel)
1. **Interface BDD** prête pour migration
2. **Configuration déploiement** cloud
3. **Monitoring** et observabilité
4. **Sécurisation** et authentification

## 🎯 Bénéfices Attendus

### Immédiat
- **Réduction 80%** du nombre de fichiers dans positions/
- **Clarté** de la structure et responsabilités
- **Performance** améliorée (moins d'I/O fichiers)
- **Maintenance** simplifiée
- **Latence des ventes drastiquement réduite** (expérience utilisateur quasi-instantanée pour les ventes pré-calculées).

### Moyen Terme
- **Migration BDD** facilitée par couche d'abstraction
- **Déploiement** simplifié avec structure claire
- **Évolutivité** pour nouvelles fonctionnalités
- **Robustesse** accrue du système

### Long Terme
- **Scalabilité** pour traitement volume élevé
- **Monitoring** et observabilité avancés
- **Intégration** avec autres systèmes
- **Architecture** microservices prête

## ⚡ Points d'Attention

### Compatibilité
- **Zéro régression** fonctionnelle
- **Migration transparente** des données existantes
- **Sauvegarde complète** avant migration

### Performance
- **Optimisation I/O** avec moins de fichiers
- **Cache intelligent** pour métadonnées
- **Gestion mémoire** améliorée

### Sécurité
- **Validation** des données importées
- **Gestion erreurs** robuste
- **Isolation** des composants

## 🚀 Prochaines Étapes

1. **Validation de l'architecture** par vous
2. **Planification détaillée** de la migration
3. **Sauvegarde complète** du système actuel
4. **Exécution phase par phase** avec tests
5. **Documentation** et formation

---

*Cette architecture respecte vos principes : simple, robuste, modulable et évolutive, sans complexité inutile. Elle prépare parfaitement les évolutions futures tout en améliorant l'existant.* 