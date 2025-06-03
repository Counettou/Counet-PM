# 🚀 Test PumpPortal - Surveillance Multiple Tokens

## 📖 Description

Ce script teste la capacité de **[PumpPortal.fun](https://pumpportal.fun)** à surveiller **4 tokens simultanément** avec **un seul WebSocket**, conformément aux bonnes pratiques recommandées par PumpPortal.

## 🎯 Tokens Surveillés

- **CHAT**: `5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump`
- **BRIX**: `5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx` 
- **INC**: `Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA`
- **MASK**: `6MQpbiTC2YcogidTmKqMLK82qvE9z5QEm7EP3AEDpump`

## ✅ Bonnes Pratiques Implémentées

### 🔗 **Un Seul WebSocket**
Conformément aux recommandations PumpPortal :
> *"PLEASE ONLY USE ONE WEBSOCKET CONNECTION AT A TIME: You should NOT open a new Websocket connection for every token or account you subscribe to. Instead, you should send any new subscribe messages to the same connection."*

### 📊 **Abonnement en Tableau**
```javascript
const subscribeTokens = {
    method: "subscribeTokenTrade",
    keys: [
        "5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump", // CHAT
        "5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx", // BRIX  
        "Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA", // INC
        "6MQpbiTC2YcogidTmKqMLK82qvE9z5QEm7EP3AEDpump"  // MASK
    ]
};
```

## 🎛️ **Fonctionnalités du Test**

### **1. Surveillance Temps Réel**
- ✅ Trades de tous les tokens surveillés
- ✅ Nouveaux tokens créés (feed général)
- ✅ Migrations de tokens

### **2. Statistiques Avancées**
- 📊 Nombre de trades par token
- 💰 Volume total en SOL par token  
- ⏰ Dernière activité par token
- 📈 Taux de messages/minute global

### **3. Données Détaillées par Trade**
- 💰 Type (buy/sell)
- 🔢 Montants SOL et tokens
- 💲 Prix unitaire calculé
- 📊 Market cap et liquidité du pool
- 👤 Adresse du trader
- 📊 Signature de transaction

### **4. Affichage Intelligent**
- 🎯 Identification claire du token concerné
- 📊 Statistiques automatiques toutes les 10 trades
- ⏱️ Formatage du temps d'uptime
- 🛑 Arrêt propre avec résumé final

## 🚀 **Lancement du Test**

```bash
cd webhooks_js/test
node test_pumpportal_multiple_tokens.js
```

## 📈 **Sortie Attendue**

```
🚀 TEST PUMPPORTAL - SURVEILLANCE MULTIPLE TOKENS
📊 Tokens surveillés:
   🎯 CHAT: 5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump
   🎯 BRIX: 5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx
   🎯 INC: Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA
   🎯 MASK: 6MQpbiTC2YcogidTmKqMLK82qvE9z5QEm7EP3AEDpump
📡 Endpoint: wss://pumpportal.fun/api/data
⚡ API Data GRATUITE de PumpPortal
🔗 UN SEUL WebSocket pour 4 tokens
⏰ Démarrage du monitoring...

✅ WebSocket PumpPortal connecté!
📡 Abonnement aux TRADES de 4 tokens envoyé
   └─ Tokens: CHAT, BRIX, INC, MASK
📡 Abonnement aux NOUVEAUX TOKENS envoyé
📡 Abonnement aux MIGRATIONS envoyé

=== Message #1 - 10:15:32 - Uptime: 0.5s ===
✅ Confirmation: Successfully subscribed to keys.

🎯 *** TOKEN CHAT DÉTECTÉ! ***
   💰 Type: buy
   🔢 Montant SOL: 0.5
   🪙 Montant Token: 75324.32
   💲 Prix unitaire: 6.6376e-6 SOL/token
   📊 Market Cap: 6950.23 SOL
   👤 Trader: 9sQQfPmW...
   🏊 Pool: pump-amm
   💧 Liquidité Pool: 64,234,567 tokens / 445.23 SOL
```

## 🎯 **Avantages de Cette Approche**

### ✅ **Efficacité Réseau**
- Un seul WebSocket = moins de ressources
- Pas de risque de blacklist
- Latence optimisée

### ✅ **Surveillance Complète**
- 4 tokens en parallèle
- Statistiques comparatives
- Aucune donnée manquée

### ✅ **Facilité d'Extension**
- Ajout simple de nouveaux tokens
- Code modulaire et réutilisable
- Configuration centralisée

## ⚠️ **Recommandations**

1. **Pas plus de connexions** : Respecter la règle "un seul WebSocket"
2. **Rate Limits** : Surveiller le taux de messages pour éviter les limitations
3. **Gestion d'erreurs** : Le script inclut une reconnexion automatique
4. **Production** : Ajouter de la persistence pour les statistiques en production

## 🔧 **Personnalisation**

Pour surveiller d'autres tokens, modifiez simplement la configuration :

```javascript
const TOKENS_TO_WATCH = {
    'VOTRE_TOKEN': 'adresse_mint_ici',
    'AUTRE_TOKEN': 'autre_adresse_mint',
    // Ajoutez autant de tokens que nécessaire
};
```

L'approche est scalable et respecte les bonnes pratiques PumpPortal ! 🚀 