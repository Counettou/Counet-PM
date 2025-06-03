# 🚀 Tests PumpPortal - Token CHAT

## 📖 Description

Ces scripts testent les capacités de **[PumpPortal.fun](https://pumpportal.fun)** pour surveiller le token **CHAT** (`5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump`).

## 🎯 Avantages de PumpPortal

### ✅ **API Data GRATUITE**
- Pas de coûts comme Helius Enhanced
- Limites de taux raisonnables
- Données spécialisées Pump.fun

### ⚡ **WebSocket Temps Réel**
- `subscribeTokenTrade` : Trades en temps réel
- `subscribeNewToken` : Nouveaux tokens
- `subscribeAccountTrade` : Trades par account
- `subscribeMigration` : Migrations de tokens

### 📊 **Données Disponibles**
- Prix en temps réel
- Volume de trading
- Informations sur les pools
- Événements de création
- Migrations vers Raydium

## 🧪 Scripts de Test

### 1. **test_pumpportal_chat.js** - WebSocket Temps Réel
```bash
cd webhooks_js/test
node test_pumpportal_chat.js
```

**Fonctionnalités :**
- ✅ Connexion WebSocket PumpPortal
- 🎯 Surveillance spécifique token CHAT
- 📊 Affichage des trades en temps réel
- 🆕 Détection nouveaux tokens
- 🔄 Reconnexion automatique
- 📈 Statistiques en temps réel

### 2. **test_pumpportal_http.js** - APIs HTTP & Données
```bash
cd webhooks_js/test
node test_pumpportal_http.js
```

**Fonctionnalités :**
- 🔍 Test Solscan API (métadonnées)
- 📊 Test DexScreener (prix/volume)
- 💰 Test Jupiter (prix)
- 🏦 Test Solana RPC (infos token)
- 🎮 Simulation trading PumpPortal

## 📋 Données Récupérées

### ⚡ **En Temps Réel (WebSocket)**
- Type de transaction (buy/sell)
- Montant en SOL
- Montant en tokens
- Valeur USD
- Signature de transaction
- Adresse utilisateur
- Pool utilisé
- Timestamp

### 📊 **Historiques (HTTP)**
- Prix actuel USD
- Volume 24h
- Liquidité
- Changement de prix
- Métadonnées du token
- Supply total
- Informations du mint

## 🔄 Comparaison avec Helius

| Critère | PumpPortal | Helius Standard | Helius Enhanced |
|---------|------------|-----------------|-----------------|
| **Coût** | ✅ GRATUIT | ✅ GRATUIT | ❌ PAYANT |
| **Données Pump.fun** | ✅ Spécialisé | ⚠️ Généraliste | ✅ Complet |
| **Facilité** | ✅ Simple | ⚠️ Complexe | ⚠️ Complexe |
| **Temps réel** | ✅ Optimisé | ✅ Standard | ✅ Premium |
| **Rate limits** | ⚠️ Présents | ⚠️ Présents | ✅ Élevés |

## 🎮 Utilisation Pratique

### **Lancement des Tests**
```bash
# Terminal 1 - WebSocket temps réel
cd webhooks_js/test
node test_pumpportal_chat.js

# Terminal 2 - Tests HTTP
cd webhooks_js/test  
node test_pumpportal_http.js
```

### **Arrêt Propre**
- **WebSocket** : `Ctrl+C` pour arrêt avec statistiques
- **HTTP** : Se termine automatiquement

## 📈 Monitoring en Production

Pour intégrer PumpPortal dans votre système :

1. **WebSocket** pour données temps réel
2. **HTTP APIs** pour données historiques  
3. **Gestion d'erreurs** avec reconnexion
4. **Rate limiting** respect des limites
5. **Backup sources** (DexScreener, Jupiter)

## 🔗 Ressources

- **Documentation** : [https://pumpportal.fun](https://pumpportal.fun)
- **WebSocket** : `wss://pumpportal.fun/api/data`
- **Trading API** : `https://pumpportal.fun/api/trade-local`
- **Support** : Telegram PumpPortal

## ⚠️ Notes Importantes

- **API Data** : Gratuite avec rate limits
- **Trading API** : Nécessite clé API (0.5% frais)
- **Une connexion** : N'ouvrez qu'un WebSocket à la fois
- **Blacklist** : Respectez les limites pour éviter le ban

## 🏆 Recommandation

**PumpPortal est idéal pour :**
- ✅ Surveillance gratuite de tokens Pump.fun
- ✅ Développement rapide de bots
- ✅ Données temps réel spécialisées
- ✅ Alternative économique à Helius Enhanced

**Utilisez Helius si :**
- Besoin de données Solana complètes
- Budget pour Enhanced API
- Surveillance multi-protocoles 