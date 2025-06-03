#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import PriceService from './price_service.js';
import TokenMetadataService from './token_metadata_service.js';

class PositionManager extends EventEmitter {
  constructor() {
    super();
    this.positions = new Map(); // Token -> Position data
    this.transactions = [];
    this.isRunning = false;
    this.workerUrl = "https://blue-leaf-e8e9.rizzutonicolas.workers.dev";
    this.ourWallet = "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB";
    
    // Services
    this.priceService = new PriceService();
    this.metadataService = new TokenMetadataService();
    
    // Créer les dossiers nécessaires
    this.ensureDirectories();
    
    // Charger les données existantes
    this.loadExistingData();
  }

  ensureDirectories() {
    const dirs = ['received_transactions', 'positions', 'logs'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadExistingData() {
    try {
      // Charger les positions existantes
      const positionsFile = 'positions/current_positions.json';
      if (fs.existsSync(positionsFile)) {
        const data = JSON.parse(fs.readFileSync(positionsFile, 'utf8'));
        this.positions = new Map(Object.entries(data));
        console.log(`📊 ${this.positions.size} positions chargées`);
      }

      // Charger les transactions récentes
      const transactionsFile = 'received_transactions/recent_transactions.json';
      if (fs.existsSync(transactionsFile)) {
        this.transactions = JSON.parse(fs.readFileSync(transactionsFile, 'utf8'));
        console.log(`📝 ${this.transactions.length} transactions chargées`);
      }
    } catch (error) {
      console.log(`⚠️  Erreur chargement données: ${error.message}`);
    }
  }

  savePositions() {
    try {
      const positionsObj = Object.fromEntries(this.positions);
      fs.writeFileSync('positions/current_positions.json', JSON.stringify(positionsObj, null, 2));
      
      // Sauvegarder aussi un historique avec timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync(`positions/positions_${timestamp}.json`, JSON.stringify(positionsObj, null, 2));
    } catch (error) {
      console.error(`❌ Erreur sauvegarde positions: ${error.message}`);
    }
  }

  saveTransaction(transaction) {
    try {
      // Ajouter à la liste
      this.transactions.unshift(transaction);
      
      // Garder seulement les 1000 dernières
      if (this.transactions.length > 1000) {
        this.transactions = this.transactions.slice(0, 1000);
      }

      // Sauvegarder la liste récente
      fs.writeFileSync('received_transactions/recent_transactions.json', 
        JSON.stringify(this.transactions, null, 2));

      // Sauvegarder la transaction individuelle
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const signature = transaction.signature || `unknown_${Date.now()}`;
      const filename = `transaction_${timestamp}_${signature.substring(0, 8)}.json`;
      fs.writeFileSync(`received_transactions/${filename}`, 
        JSON.stringify(transaction, null, 2));

      console.log(`💾 Transaction sauvée: ${filename}`);
    } catch (error) {
      console.error(`❌ Erreur sauvegarde transaction: ${error.message}`);
    }
  }

  analyzeTransaction(rawTransaction) {
    const analysis = {
      signature: rawTransaction.signature || 'N/A',
      timestamp: new Date().toISOString(),
      type: rawTransaction.type || 'UNKNOWN',
      isOurWallet: false,
      isTrade: false,
      isSwap: false,
      fee: rawTransaction.fee || 0,
      slot: rawTransaction.slot || 0,
      tokensBought: [],
      tokensSold: [],
      solSpent: 0,
      solReceived: 0,
      platform: 'Unknown'
    };

    // Vérifier si c'est notre wallet
    if (rawTransaction.feePayer === this.ourWallet) {
      analysis.isOurWallet = true;
    }

    // Analyser les changements de balance (tokens et SOL natif)
    if (rawTransaction.accountData && rawTransaction.accountData.length > 0) {
      rawTransaction.accountData.forEach(account => {
        // Ne plus utiliser nativeBalanceChange car il inclut tous les frais
        // On se base uniquement sur les nativeTransfers filtrés pour plus de précision
        
        // Traiter les changements de balance de tokens
        if (account.tokenBalanceChanges && account.tokenBalanceChanges.length > 0) {
          account.tokenBalanceChanges.forEach(change => {
            // Ne traiter que les changements pour notre wallet
            if (change.userAccount === this.ourWallet) {
              analysis.isTrade = true;
              
              // Calculer le montant net réel
              const rawAmount = parseInt(change.rawTokenAmount.tokenAmount);
              const decimals = change.rawTokenAmount.decimals;
              const netAmount = Math.abs(rawAmount) / Math.pow(10, decimals);
              
              const tokenData = {
                mint: change.mint,
                amount: netAmount,
                fromUser: rawAmount < 0 ? this.ourWallet : 'pool',
                toUser: rawAmount > 0 ? this.ourWallet : 'pool',
                rawAmount: rawAmount
              };

              // Déterminer si c'est un achat ou une vente basé sur le signe
              if (rawAmount > 0) {
                // Ignorer les tokens WSOL reçus (comptes temporaires)
                if (change.mint === 'So11111111111111111111111111111111111111112') {
                  console.log(`⚠️  Token WSOL ignoré (compte temporaire): ${netAmount} WSOL`);
                  return;
                }
                // Montant positif = tokens reçus = ACHAT
                analysis.tokensBought.push(tokenData);
              } else {
                // Montant négatif = tokens envoyés = VENTE
                analysis.tokensSold.push(tokenData);
              }
            }
          });
        }
      });
    }

    // NOUVELLE LOGIQUE UNIVERSELLE : Analyser TOUS les transferts (natifs + WSOL)
    // Cette approche fonctionne pour tous les DEX : Pump.fun, Raydium, CPMM, Meteora, etc.
    
    // 1. Identifier les comptes token créés dans cette transaction (frais récupérables)
    const createdTokenAccounts = new Set();
    if (rawTransaction.accountData) {
      rawTransaction.accountData.forEach(account => {
        if (account.tokenBalanceChanges && account.tokenBalanceChanges.length > 0) {
          account.tokenBalanceChanges.forEach(change => {
            if (change.userAccount === this.ourWallet) {
              createdTokenAccounts.add(change.tokenAccount);
            }
          });
        }
      });
    }
    
    // 2. Analyser les transferts natifs SOL (frais directs)
    let hasNativeTransfers = false;
    if (rawTransaction.nativeTransfers && rawTransaction.nativeTransfers.length > 0) {
      hasNativeTransfers = true;
      const TOKEN_ACCOUNT_CREATION_FEE = 2039280; // lamports standard
      
      rawTransaction.nativeTransfers.forEach(transfer => {
        // SOL reçu par notre wallet
        if (transfer.toUserAccount === this.ourWallet) {
          const solAmount = transfer.amount / 1e9;
          
          // Exclure les remboursements de comptes token fermés (récupérables)
          const isTokenAccountRefund = createdTokenAccounts.has(transfer.fromUserAccount) ||
                                      transfer.amount === TOKEN_ACCOUNT_CREATION_FEE;
          
          if (isTokenAccountRefund) {
            console.log(`⚠️  Remboursement compte token exclu: ${solAmount} SOL (fermeture ${transfer.fromUserAccount.substring(0, 8)}...)`);
            return;
          }
          
          analysis.solReceived += solAmount;
          analysis.isTrade = true;
          console.log(`💰 SOL reçu via nativeTransfer: ${solAmount} SOL`);
        }
        
        // SOL envoyé par notre wallet (frais non-récupérables)
        if (transfer.fromUserAccount === this.ourWallet) {
          const solAmount = transfer.amount / 1e9;
          
          // Exclure SEULEMENT les frais de création de comptes token (montant exact)
          const isExactTokenAccountCreation = transfer.amount === TOKEN_ACCOUNT_CREATION_FEE;
          
          if (isExactTokenAccountCreation) {
            console.log(`⚠️  Frais récupérable exclu: ${solAmount} SOL (création compte ${transfer.toUserAccount.substring(0, 8)}...)`);
            return;
          }
          
          // CORRECTION PUMP.FUN : Pour les achats Pump.fun, le gros transfert vers le compte WSOL 
          // temporaire EST le montant principal du swap, pas un double comptage
          const hasTokensBought = analysis.tokensBought.length > 0;
          const hasTokensSold = analysis.tokensSold.length > 0;
          const platformInfo = this.detectPlatform(rawTransaction);
          
          // Seulement exclure pour les autres DEX (Raydium, etc.) où il y a vraiment double comptage
          if (hasTokensBought && !hasTokensSold && transfer.amount > 10000000 && 
              !platformInfo.dexName.includes('Pump') && rawTransaction.source !== 'PUMP_AMM') {
            console.log(`⚠️  Transfert principal WSOL achat exclu: ${solAmount} SOL (déjà comptabilisé dans tokenTransfers)`);
            return;
          }
          
          analysis.solSpent += solAmount;
          analysis.isTrade = true;
          console.log(`💸 Frais non-récupérable: ${solAmount} SOL → ${transfer.toUserAccount.substring(0, 8)}...`);
        }
      });
    }

    // NOUVEAU : Fallback pour les ventes Pump.fun quand nativeTransfers n'est pas disponible
    // Analyser directement les nativeBalanceChange pour notre wallet
    if (!hasNativeTransfers && analysis.tokensSold.length > 0) {
      const platformInfo = this.detectPlatform(rawTransaction);
      
      if (platformInfo.dexName.includes('Pump') || rawTransaction.source === 'PUMP_FUN') {
        // Trouver le nativeBalanceChange pour notre wallet
        const ourAccountData = rawTransaction.accountData?.find(account => 
          account.account === this.ourWallet
        );
        
        if (ourAccountData && ourAccountData.nativeBalanceChange) {
          const netBalanceChange = ourAccountData.nativeBalanceChange;
          const feeInLamports = rawTransaction.fee || 0;
          
          // Pour une vente, le balance change devrait être positif (SOL reçu)
          // On soustrait les frais pour obtenir le SOL net reçu
          if (netBalanceChange > 0) {
            const grossSolReceived = netBalanceChange / 1e9;
            const feeInSol = feeInLamports / 1e9;
            const netSolReceived = grossSolReceived + feeInSol; // Ajouter les frais car ils sont déjà déduits du balance
            
            analysis.solReceived = netSolReceived;
            analysis.isTrade = true;
            console.log(`💰 SOL reçu via nativeBalanceChange (Pump.fun vente): ${netSolReceived} SOL (brut: ${grossSolReceived}, frais: ${feeInSol})`);
          }
        }
      }
    }
    
    // 3. NOUVEAU : Analyser les transferts WSOL (crucial pour Raydium, CPMM, etc.)
    if (rawTransaction.tokenTransfers && rawTransaction.tokenTransfers.length > 0) {
      rawTransaction.tokenTransfers.forEach(transfer => {
        // Détecter les transferts WSOL depuis notre wallet (montant principal du swap)
        if (transfer.mint === 'So11111111111111111111111111111111111111112' && 
            transfer.fromUserAccount === this.ourWallet) {
          
          const solAmount = transfer.tokenAmount;
          const platformInfo = this.detectPlatform(rawTransaction);
          
          // CORRECTION DOUBLE COMPTAGE ACHATS : Éviter le double comptage par DEX
          if (platformInfo.dexName.includes('Pump') || rawTransaction.source === 'PUMP_AMM') {
            // PUMP.FUN : WSOL va vers pool, mais sera comptabilisé via nativeTransfers
            console.log(`⚠️  WSOL Pump.fun achat exclu: ${solAmount} SOL (sera comptabilisé via nativeTransfer)`);
            return;
          }
          
          // NOUVELLE BRANCHE SPÉCIALISÉE : Raydium CPMM vs Raydium AMM
          if (platformInfo.dexName.includes('Raydium CPMM')) {
            // RAYDIUM CPMM : WSOL sera comptabilisé via nativeTransfers
            console.log(`⚠️  WSOL Raydium CPMM achat exclu: ${solAmount} SOL (sera comptabilisé via nativeTransfer)`);
            return;
          }
          
          if (platformInfo.dexName.includes('Raydium AMM')) {
            // RAYDIUM AMM : WSOL N'apparaît PAS dans nativeTransfers pour certaines transactions
            // Vérifier si le montant principal apparaîtra réellement dans nativeTransfers
            const hasMatchingNativeTransfer = rawTransaction.nativeTransfers?.some(nt => 
              nt.fromUserAccount === this.ourWallet && 
              Math.abs(nt.amount / 1e9 - solAmount) < 0.000001  // Tolérance pour arrondi
            );
            
            if (hasMatchingNativeTransfer) {
              console.log(`⚠️  WSOL Raydium AMM achat exclu: ${solAmount} SOL (confirmé dans nativeTransfers)`);
              return;
            } else {
              // NOUVEAU : Raydium AMM sans nativeTransfer correspondant = inclure le WSOL
              analysis.solSpent += solAmount;
              analysis.isTrade = true;
              console.log(`💸 WSOL Raydium AMM principal inclus: ${solAmount} SOL → ${transfer.toUserAccount.substring(0, 8)}... (pas de nativeTransfer correspondant)`);
              return;
            }
          }
          
          // Pour les autres DEX (Jupiter, Orca, Meteora, etc.), inclure le WSOL
          analysis.solSpent += solAmount;
          analysis.isTrade = true;
          console.log(`💸 Transfert WSOL principal: ${solAmount} SOL → ${transfer.toUserAccount.substring(0, 8)}... (${platformInfo.dexName})`);
        }
        
        // Détecter les transferts WSOL vers notre wallet (ventes)
        if (transfer.mint === 'So11111111111111111111111111111111111111112' && 
            transfer.toUserAccount === this.ourWallet) {
          
          const solAmount = transfer.tokenAmount;
          const platformInfo = this.detectPlatform(rawTransaction);
          
          // CORRECTION DOUBLE COMPTAGE VENTES : Éviter le double comptage par DEX
          if (platformInfo.dexName.includes('Pump') || rawTransaction.source === 'PUMP_AMM') {
            // PUMP.FUN : WSOL va vers compte temporaire, sera comptabilisé via nativeTransfers
            console.log(`⚠️  WSOL Pump.fun exclu: ${solAmount} SOL (sera comptabilisé via nativeTransfer)`);
            return;
          }
          
          // NOUVELLE BRANCHE SPÉCIALISÉE : Raydium CPMM vs Raydium AMM
          if (platformInfo.dexName.includes('Raydium CPMM')) {
            // RAYDIUM CPMM : WSOL sera comptabilisé via nativeTransfers
            console.log(`⚠️  WSOL Raydium CPMM vente exclu: ${solAmount} SOL (sera comptabilisé via nativeTransfer)`);
            return;
          }
          
          if (platformInfo.dexName.includes('Raydium AMM')) {
            // RAYDIUM AMM : WSOL N'apparaît PAS dans nativeTransfers pour certaines transactions
            // Vérifier si le montant apparaîtra réellement dans nativeTransfers
            const hasMatchingNativeTransfer = rawTransaction.nativeTransfers?.some(nt => 
              nt.toUserAccount === this.ourWallet && 
              Math.abs(nt.amount / 1e9 - solAmount) < 0.000001  // Tolérance pour arrondi
            );
            
            if (hasMatchingNativeTransfer) {
              console.log(`⚠️  WSOL Raydium AMM vente exclu: ${solAmount} SOL (confirmé dans nativeTransfers)`);
              return;
            } else {
              // NOUVEAU : Raydium AMM sans nativeTransfer correspondant = inclure le WSOL
              analysis.solReceived += solAmount;
              analysis.isTrade = true;
              console.log(`💰 WSOL Raydium AMM vente inclus: ${solAmount} SOL ← ${transfer.fromUserAccount.substring(0, 8)}... (pas de nativeTransfer correspondant)`);
              return;
            }
          }
          
          // Pour les autres DEX (Jupiter, Orca, Meteora, etc.), inclure le WSOL
          analysis.solReceived += solAmount;
          analysis.isTrade = true;
          console.log(`💰 WSOL reçu via vente: ${solAmount} SOL ← ${transfer.fromUserAccount.substring(0, 8)}... (${platformInfo.dexName})`);
        }
      });
    }

    // Ajouter les frais de transaction (fee) au SOL dépensé
    if (rawTransaction.fee && rawTransaction.fee > 0) {
      const feeInSol = rawTransaction.fee / 1e9;
      analysis.solSpent += feeInSol;
      console.log(`💸 Frais de transaction: ${feeInSol} SOL`);
    }

    // Détecter le type de transaction
    if (analysis.tokensBought.length > 0 && analysis.solSpent > 0) {
      analysis.type = 'BUY';
      analysis.isSwap = true;
    } else if (analysis.tokensSold.length > 0 && analysis.solReceived > 0) {
      analysis.type = 'SELL';
      analysis.isSwap = true;
    }

    // Détecter la plateforme/DEX utilisé avec détails de branche logique
    const platformInfo = this.detectPlatform(rawTransaction);
    analysis.platform = platformInfo.dexName;
    analysis.platformInfo = platformInfo; // Stocker toutes les infos pour traçabilité

    return analysis;
  }

  // Méthode pour détecter la plateforme/DEX utilisé avec détails de la branche logique
  detectPlatform(rawTransaction) {
    if (!rawTransaction.instructions) {
      return {
        dexName: 'Unknown',
        logicBranch: 'No Instructions',
        calculationMethod: 'Mixed'
      };
    }
    
    // Vérifier d'abord le source field (plus fiable)
    if (rawTransaction.source === 'PUMP_FUN' || rawTransaction.source === 'PUMP_AMM') {
      return {
        dexName: 'Pump.fun',
        logicBranch: `Source: ${rawTransaction.source}`,
        calculationMethod: 'Native'
      };
    }
    
    // Analyser les programId des instructions pour identifier le DEX
    const programIds = rawTransaction.instructions.map(inst => inst.programId);
    
    // Pump.fun (programId direct)
    if (programIds.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')) {
      return {
        dexName: 'Pump.fun',
        logicBranch: 'PID: 6EF8rr...',
        calculationMethod: 'Native'
      };
    }
    
    // Pump.fun (via wrapper/router comme GMgnVFR8Jb39LoXsEVzb3DvBy3ywCmdmJquHUy1Lrkqb)
    if (programIds.includes('GMgnVFR8Jb39LoXsEVzb3DvBy3ywCmdmJquHUy1Lrkqb')) {
      return {
        dexName: 'Pump.fun',
        logicBranch: 'PID: GMgnVF...',
        calculationMethod: 'Native'
      };
    }
    
    // Raydium CPMM
    if (programIds.includes('CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C')) {
      return {
        dexName: 'Raydium CPMM',
        logicBranch: 'PID: CPMMoo...',
        calculationMethod: 'Native'
      };
    }
    
    // Raydium AMM
    if (programIds.includes('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')) {
      return {
        dexName: 'Raydium AMM',
        logicBranch: 'PID: 675kPX...',
        calculationMethod: 'Native'
      };
    }
    
    // Jupiter
    if (programIds.includes('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4')) {
      return {
        dexName: 'Jupiter',
        logicBranch: 'PID: JUP6Lk...',
        calculationMethod: 'WSOL'
      };
    }
    
    // Meteora - programme principal
    if (programIds.includes('Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB')) {
      return {
        dexName: 'Meteora',
        logicBranch: 'PID: Eo7WjK...',
        calculationMethod: 'WSOL'
      };
    }
    
    // Meteora - programme AMM Pool (utilisé pour MASK)
    if (programIds.includes('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA')) {
      return {
        dexName: 'Meteora',
        logicBranch: 'PID: pAMMBa...',
        calculationMethod: 'WSOL'
      };
    }
    
    // Orca
    if (programIds.includes('9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP')) {
      return {
        dexName: 'Orca',
        logicBranch: 'PID: 9W959D...',
        calculationMethod: 'WSOL'
      };
    }
    
    return {
      dexName: 'Unknown',
      logicBranch: 'Default Logic',
      calculationMethod: 'Mixed'
    };
  }

  async updatePositions(analysis) {
    if (!analysis.isOurWallet || !analysis.isTrade) return;

    // Récupérer le prix historique du SOL pour cette transaction
    let timestamp;
    if (typeof analysis.timestamp === 'string') {
      // Format ISO string
      timestamp = new Date(analysis.timestamp).getTime() / 1000;
    } else {
      // Timestamp Unix déjà en secondes
      timestamp = analysis.timestamp;
    }
    
    let solPriceUSD = null;
    let usdCalculation = null;

    try {
      usdCalculation = await this.priceService.calculateUSDPrice(analysis.solSpent, timestamp);
      solPriceUSD = usdCalculation ? usdCalculation.solPrice : null;
      
      if (usdCalculation) {
        console.log(`💰 Prix SOL au moment de la transaction: $${solPriceUSD}`);
        console.log(`💵 Montant investi: ${analysis.solSpent} SOL = $${usdCalculation.usdAmount.toFixed(6)}`);
      }
    } catch (error) {
      console.error(`⚠️  Erreur récupération prix USD: ${error.message}`);
    }

    // Traiter les achats (nouvelles positions ou augmentation)
    for (const token of analysis.tokensBought) {
      const tokenMint = token.mint;
      
      // Ignorer les positions SOL automatiques créées lors des ventes
      if (tokenMint === 'So11111111111111111111111111111111111111112') {
        console.log(`⚠️  Position SOL ignorée (SOL reçu lors d'une vente): ${token.amount} SOL`);
        continue;
      }
      
      // Calculer le prix par token en USD
      const pricePerTokenUSD = usdCalculation ? usdCalculation.usdAmount / token.amount : null;
      
      if (!this.positions.has(tokenMint)) {
        // Nouvelle position
        this.positions.set(tokenMint, {
          mint: tokenMint,
          totalAmount: token.amount,
          averagePrice: analysis.solSpent / token.amount,
          averagePriceUSD: pricePerTokenUSD,
          totalInvested: analysis.solSpent,
          totalInvestedUSD: usdCalculation ? usdCalculation.usdAmount : null,
          transactions: [],
          status: 'OPEN',
          openedAt: analysis.timestamp,
          lastUpdate: analysis.timestamp,
          platformInfo: analysis.platformInfo
        });
        
        console.log(`🆕 Nouvelle position: ${tokenMint.substring(0, 8)}... (${token.amount} tokens)`);
        if (pricePerTokenUSD) {
          console.log(`   💰 Prix d'achat: $${pricePerTokenUSD.toFixed(8)} par token`);
        }

        // Récupérer automatiquement les métadonnées du token en arrière-plan
        this.fetchTokenMetadataAsync(tokenMint);
      } else {
        const position = this.positions.get(tokenMint);
        
        // NOUVEAU: Gérer la réouverture d'une position fermée
        if (position.status === 'CLOSED') {
          console.log(`🔄 Réouverture position fermée: ${tokenMint.substring(0, 8)}...`);
          
          // Réinitialiser la position pour réouverture
          position.status = 'OPEN';
          position.totalAmount = token.amount;
          position.averagePrice = analysis.solSpent / token.amount;
          position.averagePriceUSD = pricePerTokenUSD;
          position.totalInvested = analysis.solSpent;
          position.totalInvestedUSD = usdCalculation ? usdCalculation.usdAmount : null;
          position.openedAt = analysis.timestamp; // Nouvelle date d'ouverture
          position.lastUpdate = analysis.timestamp;
          position.platformInfo = analysis.platformInfo;
          
          // Nettoyer les données de fermeture
          delete position.closedAt;
          delete position.finalPnL;
          delete position.finalPnLUSD;
          
          console.log(`✅ Position ré-ouverte: ${token.amount} tokens à $${pricePerTokenUSD ? pricePerTokenUSD.toFixed(8) : 'N/A'}`);
        } else {
          // Augmenter position existante ouverte (logique actuelle)
          const newTotalAmount = position.totalAmount + token.amount;
          const newTotalInvested = position.totalInvested + analysis.solSpent;
          
          // Calculer le nouveau prix moyen USD
          let newTotalInvestedUSD = position.totalInvestedUSD || 0;
          if (usdCalculation) {
            newTotalInvestedUSD += usdCalculation.usdAmount;
          }
          
          position.totalAmount = newTotalAmount;
          position.averagePrice = newTotalInvested / newTotalAmount;
          position.averagePriceUSD = newTotalInvestedUSD > 0 ? newTotalInvestedUSD / newTotalAmount : null;
          position.totalInvested = newTotalInvested;
          position.totalInvestedUSD = newTotalInvestedUSD > 0 ? newTotalInvestedUSD : null;
          position.lastUpdate = analysis.timestamp;
          
          console.log(`📈 Position augmentée: ${tokenMint.substring(0, 8)}... (+${token.amount} tokens)`);
          if (position.averagePriceUSD) {
            console.log(`   💰 Nouveau prix moyen: $${position.averagePriceUSD.toFixed(8)} par token`);
          }
        }
      }
      
      // Ajouter la transaction à l'historique
      this.positions.get(tokenMint).transactions.push({
        signature: analysis.signature,
        type: 'BUY',
        amount: token.amount,
        price: analysis.solSpent / token.amount,
        priceUSD: pricePerTokenUSD,
        solAmount: analysis.solSpent,
        usdAmount: usdCalculation ? usdCalculation.usdAmount : null,
        solPriceAtTime: solPriceUSD,
        timestamp: analysis.timestamp
      });
    }

    // Traiter les ventes (réduction ou fermeture de positions)
    for (const token of analysis.tokensSold) {
      const tokenMint = token.mint;
      
      if (this.positions.has(tokenMint)) {
        const position = this.positions.get(tokenMint);
        
        // Calculer la valeur USD de la vente
        let sellUsdCalculation = null;
        try {
          sellUsdCalculation = await this.priceService.calculateUSDPrice(analysis.solReceived, timestamp);
        } catch (error) {
          console.error(`⚠️  Erreur calcul USD vente: ${error.message}`);
        }
        
        const pricePerTokenUSD = sellUsdCalculation ? sellUsdCalculation.usdAmount / token.amount : null;
        
        // Vérifier si la position est fermée complètement (avec tolérance pour les erreurs d'arrondi)
        const remainingAmount = position.totalAmount - token.amount;
        if (Math.abs(remainingAmount) <= 0.000001) {
          // Position fermée complètement
          position.status = 'CLOSED';
          position.totalAmount = 0; // Mettre à zéro pour éviter les montants résiduels
          position.closedAt = analysis.timestamp;
          position.finalPnL = analysis.solReceived - position.totalInvested;
          position.finalPnLUSD = sellUsdCalculation && position.totalInvestedUSD ? 
            sellUsdCalculation.usdAmount - position.totalInvestedUSD : null;
          
          console.log(`🔴 Position fermée: ${tokenMint.substring(0, 8)}... (PnL: ${position.finalPnL.toFixed(4)} SOL)`);
          if (position.finalPnLUSD) {
            console.log(`   💵 PnL USD: $${position.finalPnLUSD.toFixed(6)}`);
          }
        } else {
          // Position partiellement fermée
          const soldRatio = token.amount / position.totalAmount;
          const soldInvestment = position.totalInvested * soldRatio;
          const soldInvestmentUSD = position.totalInvestedUSD ? position.totalInvestedUSD * soldRatio : null;
          
          position.totalAmount = remainingAmount;
          position.totalInvested -= soldInvestment;
          if (position.totalInvestedUSD && soldInvestmentUSD) {
            position.totalInvestedUSD -= soldInvestmentUSD;
          }
          position.lastUpdate = analysis.timestamp;
          
          console.log(`📉 Position réduite: ${tokenMint.substring(0, 8)}... (-${token.amount} tokens, restant: ${remainingAmount.toFixed(6)})`);
        }
        
        // Calculer le prix de vente par token (SOL reçu / tokens vendus)
        const sellPricePerToken = analysis.solReceived > 0 ? analysis.solReceived / token.amount : 0;
        const sellPricePerTokenUSD = sellUsdCalculation && analysis.solReceived > 0 ? 
          sellUsdCalculation.usdAmount / token.amount : 0;
        
        console.log(`💰 Prix de vente: ${sellPricePerToken.toFixed(10)} SOL par token`);
        if (sellPricePerTokenUSD > 0) {
          console.log(`💵 Prix de vente USD: $${sellPricePerTokenUSD.toFixed(8)} par token`);
        }
        
        // Ajouter la transaction de vente
        position.transactions.push({
          signature: analysis.signature,
          type: 'SELL',
          amount: token.amount,
          price: sellPricePerToken,
          priceUSD: sellPricePerTokenUSD > 0 ? sellPricePerTokenUSD : null,
          solAmount: analysis.solReceived,
          usdAmount: sellUsdCalculation ? sellUsdCalculation.usdAmount : null,
          solPriceAtTime: sellUsdCalculation ? sellUsdCalculation.solPrice : null,
          timestamp: analysis.timestamp
        });
      }
    }

    // Sauvegarder les positions mises à jour
    this.savePositions();
    
    // Émettre l'événement de mise à jour
    this.emit('positionsUpdated', {
      positions: Array.from(this.positions.values()),
      lastTransaction: analysis
    });
  }

  // Méthode pour récupérer les métadonnées d'un token en arrière-plan
  async fetchTokenMetadataAsync(tokenMint) {
    try {
      console.log(`🔍 Récupération métadonnées pour nouveau token: ${tokenMint.substring(0, 8)}...`);
      const metadata = await this.metadataService.getTokenMetadata(tokenMint);
      
      if (metadata && (metadata.name || metadata.symbol)) {
        const tokenDisplay = metadata.symbol || metadata.name;
        console.log(`✅ Métadonnées récupérées: ${tokenDisplay} (${metadata.source})`);
        
        // Émettre une mise à jour pour notifier les clients WebSocket
        this.emit('tokenMetadataUpdated', {
          mint: tokenMint,
          metadata: metadata
        });
      }
    } catch (error) {
      console.error(`❌ Erreur récupération métadonnées pour ${tokenMint}:`, error.message);
    }
  }

  // Méthode pour simuler une transaction (pour les tests)
  async simulateTransaction(transactionData) {
    console.log(`🧪 Simulation transaction: ${transactionData.signature}`);
    
    const analysis = this.analyzeTransaction(transactionData);
    
    // Sauvegarder la transaction
    this.saveTransaction({
      raw: transactionData,
      analysis: analysis,
      timestamp: analysis.timestamp
    });

    // Mettre à jour les positions
    await this.updatePositions(analysis);

    return analysis;
  }

  getPositionsSummary() {
    const openPositions = Array.from(this.positions.values()).filter(p => p.status === 'OPEN');
    const closedPositions = Array.from(this.positions.values()).filter(p => p.status === 'CLOSED');
    const allPositions = Array.from(this.positions.values());
    
    // Calculer le total investi sur toutes les positions (ouvertes et fermées)
    const totalInvested = allPositions.reduce((sum, p) => {
      // Pour les positions fermées, utiliser le montant investi initial
      // Pour les positions ouvertes, utiliser le montant investi actuel
      return sum + (p.totalInvested || 0);
    }, 0);
    
    const totalPnL = closedPositions.reduce((sum, p) => sum + (p.finalPnL || 0), 0);

    // Enrichir les positions avec les métadonnées du cache (synchrone)
    const enrichedPositions = allPositions.map((position) => {
      // Utiliser le cache des métadonnées si disponible
      if (this.metadataService.cache.has(position.mint)) {
        const metadata = this.metadataService.cache.get(position.mint);
        return {
          ...position,
          tokenName: metadata.name,
          tokenSymbol: metadata.symbol,
          tokenDecimals: metadata.decimals,
          metadataSource: metadata.source,
          metadataExtra: metadata.extra
        };
      }
      return position;
    });

    return {
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      totalInvested: totalInvested,
      totalPnL: totalPnL,
      positions: enrichedPositions,
      recentTransactions: this.transactions.slice(0, 10)
    };
  }

  // Version asynchrone pour enrichir complètement les positions
  async getEnrichedPositionsSummary() {
    const openPositions = Array.from(this.positions.values()).filter(p => p.status === 'OPEN');
    const closedPositions = Array.from(this.positions.values()).filter(p => p.status === 'CLOSED');
    const allPositions = Array.from(this.positions.values());
    
    // Calculer le total investi sur toutes les positions (ouvertes et fermées)
    const totalInvested = allPositions.reduce((sum, p) => {
      // Pour les positions fermées, utiliser le montant investi initial
      // Pour les positions ouvertes, utiliser le montant investi actuel
      return sum + (p.totalInvested || 0);
    }, 0);
    
    const totalPnL = closedPositions.reduce((sum, p) => sum + (p.finalPnL || 0), 0);

    // Enrichir les positions avec les métadonnées des tokens (asynchrone)
    const enrichedPositions = await Promise.all(
      allPositions.map(async (position) => {
        try {
          return await this.metadataService.enrichPosition(position);
        } catch (error) {
          console.error(`❌ Erreur enrichissement position ${position.mint}:`, error.message);
          return position;
        }
      })
    );

    return {
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      totalInvested: totalInvested,
      totalPnL: totalPnL,
      positions: enrichedPositions,
      recentTransactions: this.transactions.slice(0, 10)
    };
  }

  async start() {
    if (this.isRunning) {
      console.log("⚠️  Gestionnaire déjà en cours d'exécution");
      return;
    }

    this.isRunning = true;
    console.log("🚀 GESTIONNAIRE DE POSITIONS DÉMARRÉ");
    console.log("====================================");
    console.log(`🎯 Wallet surveillé: ${this.ourWallet}`);
    
    // Le mode direct webhook est maintenant le seul mode
    console.log(`📡 Mode: Réception directe des webhooks Helius via Tunnel Cloudflare`);
    
    console.log(`📊 Positions actuelles: ${this.positions.size}`);
    console.log("");

    // Afficher le résumé initial avec enrichissement complet
    const summary = await this.getEnrichedPositionsSummary();
    console.log(`📈 Positions ouvertes: ${summary.openPositions}`);
    console.log(`📉 Positions fermées: ${summary.closedPositions}`);
    console.log(`💰 Total investi: ${summary.totalInvested.toFixed(4)} SOL`);
    console.log(`📊 PnL total: ${summary.totalPnL.toFixed(4)} SOL`);
    
    // Afficher les noms des tokens si disponibles
    if (summary.positions.length > 0) {
      console.log("\n🪙 Tokens en portefeuille :");
      summary.positions.forEach(pos => {
        const tokenDisplay = pos.tokenSymbol || pos.tokenName || pos.mint.substring(0, 8) + '...';
        console.log(`   • ${tokenDisplay} (${pos.status})`);
      });
    }
    
    console.log("");
    console.log("✅ Système prêt à recevoir les webhooks Helius directement !");
  }

  stop() {
    this.isRunning = false;
    console.log("🛑 Gestionnaire de positions arrêté");
  }
}

export default PositionManager; 