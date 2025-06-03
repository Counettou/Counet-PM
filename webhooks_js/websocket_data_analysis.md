# Analyse des Données Reçues via les WebSockets Helius

## 1. Introduction

Ce document sert de référence pour comprendre les données collectées via le script `complete_helius_websocket_test.js`. L'objectif est d'exploiter ces données pour un suivi avancé de tokens spécifiques sur la blockchain Solana, notamment pour extraire des informations clés telles que les prix, les volumes d'échange, la liquidité des pools, et les mouvements de portefeuilles importants ("whales").

## 2. Architecture des Abonnements WebSocket

Le script `complete_helius_websocket_test.js` utilise plusieurs types d'abonnements Helius pour collecter un large éventail de données on-chain.

### Tokens Cibles Principaux :
- **BRIX**: `5XEStNFNenRkAB9BtfteEL7yeM5XDZb8TZaPMJvNaPwx`
- **chat**: `5umKhqeUvXWhs1vusXkf6CbZLvHbDt3bHZGQez7vpump`
- **INC**: `Fe5c469ADZyvnZrB8gdDsYt5eLKodaVYhYJCdunVr1nA`
- **UselessRWD**: `6KTefwGvQ4wgmNeobuzhTCKKE55vFoj5dJryAMp8Hau6`

### Programmes Importants Surveillés (Exemples) :
- **SPL Token**: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- **Raydium AMM**: `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`
- **Jupiter V6**: `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`
- **Pump.fun**: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
- D'autres AMM et programmes DeFi pertinents.

### Types d'Abonnements Utilisés :
Le script est configuré pour utiliser (ou peut facilement utiliser) :
- `accountSubscribe`: Pour surveiller les changements de solde de comptes spécifiques.
- `programSubscribe`: Pour être notifié des transactions impliquant des programmes spécifiques.
- `logsSubscribe`: Pour recevoir les logs détaillés des transactions (crucial pour l'analyse de swaps).
- `slotSubscribe`, `slotsUpdatesSubscribe`, `rootSubscribe`: Pour suivre la progression et la finalité des blocs.

## 3. Analyse des Données Reçues par Type d'Abonnement et Utilité

### 3.1. Abonnements Spécifiques aux Tokens Cibles

Ces abonnements permettent un suivi direct de l'activité de `BRIX`, `chat`, `INC`, et `UselessRWD`.

#### a. `accountSubscribe` (sur les comptes principaux des tokens cibles)
- **Ce que nous recevons**: Notifications lors de changements de balance (SOL ou token) pour les comptes surveillés.
  - *Exemple de log*: `[Account-5XEStNFN-...] 📊 ACCOUNT: Slot ... | Token: 5XEStN..NaPx | Amount: ...`
- **Utilité directe**:
    - Suivi des mouvements de fonds sur des comptes d'intérêt (gros détenteurs, trésorerie, etc.).
    - Détection de ventes/achats importants par ces comptes.
- **Potentiel pour l'analyse**:
    - **Whale Watching**: Alerter sur des mouvements significatifs de gros portefeuilles.
    - **Suivi de l'activité de l'équipe/projet**.
    - **Corrélation avec les prix**: Analyser l'impact des mouvements de ces comptes sur le prix.

#### b. `logsSubscribe` (avec `mentions: [TOKEN_MINT_ADDRESS]`)
- **Ce que nous recevons**: Logs bruts de toute transaction mentionnant l'adresse du token cible.
  - *Exemple de log*: `[TokenLogs-5XEStNFN] 📝 LOGS: Slot ...` (marqué `🔄 SWAP DETECTED!` si pertinent).
- **Utilité directe**:
    - **Visibilité complète**: Enregistrement de chaque interaction on-chain avec le token.
    - **Détection de swaps directs**: Identifier les échanges impliquant directement le token.
- **Potentiel pour l'analyse**:
    - **Analyse de la vélocité du token**.
    - **Identification de nouveaux pools/DEX** où le token est listé.
    - **Détection d'activités suspectes** ou d'interactions avec des contrats inconnus.
    - **Base pour le calcul du volume spécifique au token** à partir des données de swap.

### 3.2. Abonnements aux Programmes DeFi et au Programme SPL Token

Ces abonnements fournissent une vision des interactions avec les contrats au cœur des échanges.

#### a. Programme SPL Token (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
- **Abonnements**: `[Program-Tokenkeg]` (via `programSubscribe`) et `[Logs-Tokenkeg]` (via `logsSubscribe`).
- **Ce que nous recevons**:
    - `[Program-Tokenkeg]`: Notifications très fréquentes d'invocation du programme Token.
    - `[Logs-Tokenkeg]`: Logs détaillés des instructions (`Transfer`, `MintTo`, etc.). Peut inclure des `SWAP DETECTED!` si le mot "Swap" apparaît dans les logs d'une transaction plus large impliquant un transfert de token.
- **Utilité**:
    - `[Program-Tokenkeg]`: Indicateur d'activité générale, potentiellement bruyant mais peut signaler des pics d'activité.
    - `[Logs-Tokenkeg]`:
        - **Tracer des transferts spécifiques de tokens**.
        - **Comprendre les étapes de transfert au sein d'un swap**.
        - **Analyse forensique** pour reconstituer des actions.

#### b. Programmes AMM & Agrégateurs (Jupiter, Pump.fun, Raydium, etc.)
- **Abonnements**: `[Program-JUP6LkbZ]`, `[Logs-JUP6LkbZ]`, etc.
- **Ce que nous recevons**:
    - `[Program-XXX]`: Notifications d'interaction avec le DEX/agrégateur.
    - `[Logs-XXX]`: **Source principale pour les données de trading**. Contient les logs détaillés des swaps, y compris les erreurs (slippage, `0x6eb`). Les `Program data` encodées peuvent contenir des informations précises sur les montants.
      - *Exemple (MSG #338069)*: Transaction de swap complexe impliquant Jupiter, Saber, Voyager, et le programme Token, avec des instructions `Swap`, `Withdraw`, `Transfer`.
- **Utilité**:
    - **Extraction détaillée des données de swap**:
        - **Identifier les tokens échangés** (vos tokens cibles vs SOL/stables).
        - **Déterminer les montants échangés**.
        - **Calculer le prix d'exécution**.
    - **Analyse des échecs de transaction** pour comprendre les causes (slippage, liquidité).
    - **Détection de nouvelles paires de trading et pools de liquidité** pour vos tokens.
    - **Calculer le volume de trading et la liquidité** sur ces plateformes.

### 3.3. Abonnements Généraux à l'État du Réseau
- **Abonnements**: `[SlotUpdates]`, `[SlotsUpdatesDetailed]`, `[RootUpdates]`.
- **Ce que nous recevons**: Informations sur la progression des slots et la finalisation des blocs (`optimisticConfirmation`, `completed`, `frozen`, `root`).
- **Utilité**:
    - **Confirmer la finalité des transactions importantes** (swaps, transferts de "whales").
    - **Monitoring de la santé et de la performance du réseau Solana**.
    - **Horodatage relatif** des événements de trading par rapport au cycle de vie des blocs.

## 4. Prochaines Étapes Stratégiques

La collecte de données est une base solide. Les prochaines étapes pour valoriser ces données incluent :

1.  **Extraction d'Informations Clés (Priorité Haute)**:
    *   **Développer un parseur robuste** dans le script (ou un module séparé) pour les `logsNotification` des AMM/Agrégateurs afin d'extraire :
        *   La paire de tokens échangée (en identifiant les mints de vos tokens cibles et le token de contrepartie).
        *   Les montants exacts de chaque token impliqué dans le swap.
        *   Le prix d'exécution du swap.
        *   La signature de la transaction et le timestamp.
        *   Le DEX ou le pool source.
    *   **Filtrer** pour ne traiter que les swaps impliquant `BRIX`, `chat`, `INC`, ou `UselessRWD`.
    *   **Calculer le volume de trading** en agrégeant les montants échangés pour chaque token cible.

2.  **Améliorations du Script de Collecte et d'Analyse**:
    *   **Stockage Structuré**: Enregistrer les données de swap traitées (et potentiellement d'autres événements clés comme les transferts de "whales") dans un format structuré (CSV, JSON, base de données type SQLite ou une base de données NoSQL) pour une interrogation et une analyse facilitées.
    *   **Décodage Avancé des "Program Data"**: Pour certains programmes, les informations cruciales sont dans le champ `data` des instructions. L'utilisation d'IDL (Interface Description Language) des programmes concernés peut être nécessaire pour un décodage précis si Helius ne le fait pas nativement pour tous.
    *   **Gestion Affinée des Erreurs**: Catégoriser les erreurs de transaction (slippage, liquidité insuffisante, etc.) et potentiellement les logger de manière moins verbeuse ou les agréger pour des statistiques.
    *   **Optimisation et Filtrage à la Source**: Si certains abonnements génèrent trop de bruit (ex: `[Program-Tokenkeg]` sans contexte), envisager de les rendre optionnels ou de ne logger que des résumés pour éviter la surcharge de logs non essentiels.

3.  **Développement de Modules d'Analyse Spécifiques**:
    *   **Calculateur de Prix en Temps Réel**: Basé sur les swaps extraits.
    *   **Tracker de Volume et de Liquidité**: Pour chaque token sur différents DEX.
    *   **Détecteur de "Whale Movements"**: Basé sur les `accountSubscribe` et l'analyse des gros transferts/swaps.
    *   **Système d'Alerting**: Pour les événements importants (gros dump/pump, ajout à un nouveau DEX, etc.).

## 5. Conclusion

Les données collectées via les WebSockets Helius offrent une vision profonde et en temps réel de l'activité on-chain. En structurant l'analyse et en développant des outils pour parser et interpréter ces données, nous pouvons construire un système de surveillance puissant pour les tokens cibles, fournissant des informations précieuses pour la prise de décision, le trading, ou l'analyse de marché. Ce document servira de guide pour ces développements futurs. 