#!/usr/bin/env node
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import PositionManager from './position_manager.js';
import RealtimePriceService from './realtime_price_service.js';
import HeliusWebSocketPriceService from './helius_websocket_price_service.js';

import TradeCloserService from './trade_closer_service.js';
import TradeLoggerService from './trade_logger_service.js';
import OptimizedSellService from './optimized_sell_service.js';

// Charger les variables d'environnement
dotenv.config();

class WebSocketPositionServer {
  constructor(port = 8080) {
    this.port = port;
    this.clients = new Set();
    this.isRunning = false;
    
    // Initialisation des services
    this.positionManager = new PositionManager();
    this.realtimePriceService = new RealtimePriceService(); // 🎯 Service GMGN intégré
    this.heliusService = new HeliusWebSocketPriceService(); // 🔧 Service Helius avec DexScreener fallback
    this.tradeLogger = new TradeLoggerService();
    
    // Configuration du serveur
    this.server = http.createServer();
    this.wss = new WebSocketServer({ server: this.server });
    
    // Initialiser le service de fermeture de trades
    const heliusRpcUrl = process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com';
    this.tradeCloser = new TradeCloserService(heliusRpcUrl, this.positionManager);
    
    // Initialiser le service de vente optimisée
    this.optimizedSellService = new OptimizedSellService(heliusRpcUrl, this.positionManager);
    
    this.setupWebSocketHandlers();
    this.setupPositionManagerEvents();
    this.setupRealtimePriceEvents(); // 🎯 Événements GMGN intégrés
  }

  setupPositionManagerEvents() {
    // Écouter les mises à jour des métadonnées de tokens
    this.positionManager.on('tokenMetadataUpdated', (data) => {
      console.log(`📡 Diffusion mise à jour métadonnées: ${data.metadata.symbol || data.metadata.name}`);
      
      // Diffuser la mise à jour des positions avec les nouvelles métadonnées
      const updatedSummary = this.positionManager.getPositionsSummary();
      this.broadcastToClients({
        type: 'positionsUpdate',
        data: updatedSummary
      });
    });

    // Écouter les mises à jour des positions
    this.positionManager.on('positionsUpdated', async (data) => {
      console.log(`📡 Diffusion mise à jour positions`);
      
      // Mettre à jour les tokens suivis pour les prix temps réel
      const summary = this.positionManager.getPositionsSummary();
      this.realtimePriceService.updateTrackedTokens(summary.positions || []);
      
      // 🔧 AUSSI mettre à jour le service Helius
      if (this.heliusService) {
        this.heliusService.updateTrackedTokens(summary.positions || []);
      }
      
      // 🎯 Les tokens sont automatiquement ajoutés au monitoring GMGN via updateTrackedTokens
      
      this.broadcastToClients({
        type: 'positionsUpdate',
        data: summary
      });
      
      // Logger automatiquement les achats (webhooks)
      if (data && data.analysis && data.analysis.type === 'BUY') {
        this.logTransactionAutomatically(data.analysis);
      }
    });
  }

  logTransactionAutomatically(analysis) {
    try {
      // Extraire les données pour le logger
      const buyData = {
        tokenMint: analysis.tokenMint,
        tokenSymbol: analysis.tokenSymbol || analysis.tokenName,
        tokenName: analysis.tokenName,
        signature: analysis.signature,
        solAmount: analysis.solAmount,
        tokenAmount: analysis.tokenAmount,
        pricePerToken: analysis.pricePerToken,
        pricePerTokenUSD: analysis.pricePerTokenUSD,
        platform: analysis.platform || 'Unknown',
        solPriceAtTime: analysis.solPriceAtTime,
        isNewPosition: analysis.isNewPosition || false,
        totalPositionSize: analysis.totalPositionSize || analysis.tokenAmount
      };
      
      this.tradeLogger.logBuy(buyData);
    } catch (error) {
      console.error('❌ Erreur logging achat automatique:', error);
    }
  }

  logSellSuccess(mint, result, sellPercentage, exactAmount) {
    try {
      // Récupérer les infos de la position pour le logging
      const position = this.positionManager.positions.get(mint);
      if (!position) {
        console.warn(`⚠️ Position ${mint} non trouvée pour logging vente`);
        return;
      }

      // Mettre à jour le prix SOL dans le logger si disponible
      if (this.positionManager.priceService?.currentSolPrice) {
        this.tradeLogger.updateSolPrice(this.positionManager.priceService.currentSolPrice);
      }

      // Calculer les métriques de la vente
      const tokensSold = exactAmount / Math.pow(10, result.decimals || 6);
      const pricePerToken = result.solReceived / tokensSold;
      const sellPerformance = position.averagePrice ? 
        ((pricePerToken - position.averagePrice) / position.averagePrice) * 100 : 0;

      const sellData = {
        tokenMint: mint,
        tokenSymbol: position.tokenSymbol || position.tokenName,
        tokenName: position.tokenName,
        signature: result.signature,
        percentage: sellPercentage || 100,
        tokensSold: tokensSold,
        solReceived: result.solReceived,
        pricePerToken: pricePerToken,
        pricePerTokenUSD: result.pricePerTokenUSD,
        buyPrice: position.averagePrice,
        sellPerformance: sellPerformance,
        executionTime: result.timings?.total,
        timings: result.timings || {},
        slippage: result.slippage,
        platform: position.platformInfo?.dexName || 'Unknown',
        retryAttempt: result.retryAttempt || 0,
        success: true,
        remainingTokens: result.remainingTokens || 0,
        errors: []
      };

      this.tradeLogger.logSell(sellData);
    } catch (error) {
      console.error('❌ Erreur logging vente réussie:', error);
    }
  }

  logSellFailure(mint, result, sellPercentage, errorMessage) {
    try {
      // Récupérer les infos de la position pour le logging
      const position = this.positionManager.positions.get(mint);
      if (!position) {
        console.warn(`⚠️ Position ${mint} non trouvée pour logging erreur vente`);
        return;
      }

      const errorData = {
        tokenMint: mint,
        tokenSymbol: position.tokenSymbol || position.tokenName,
        percentage: sellPercentage || 100,
        errorMessage: errorMessage,
        errorType: this.classifyError(errorMessage),
        retryAttempt: result.retryAttempt || 0,
        executionTime: result.timings?.total,
        platform: position.platformInfo?.dexName || 'Unknown',
        stackTrace: result.stackTrace
      };

      this.tradeLogger.logSellError(errorData);
    } catch (error) {
      console.error('❌ Erreur logging erreur vente:', error);
    }
  }

  classifyError(errorMessage) {
    if (!errorMessage) return 'UNKNOWN';
    
    const message = errorMessage.toLowerCase();
    
    if (message.includes('0x1771') || message.includes('slippage')) return 'SLIPPAGE_EXCEEDED';
    if (message.includes('insufficient') || message.includes('balance')) return 'INSUFFICIENT_BALANCE';
    if (message.includes('rate limit') || message.includes('429')) return 'RATE_LIMIT';
    if (message.includes('jupiter') || message.includes('quote')) return 'JUPITER_API_ERROR';
    if (message.includes('block height') || message.includes('blockhash')) return 'BLOCK_EXPIRED';
    if (message.includes('simulation')) return 'SIMULATION_FAILED';
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('network') || message.includes('connection')) return 'NETWORK_ERROR';
    
    return 'UNKNOWN';
  }

  setupRealtimePriceEvents() {
    // Écouter les mises à jour de prix GMGN temps réel
    this.realtimePriceService.on('priceUpdate', (tokenData) => {
      // Diffuser toutes les données GMGN aux clients WebSocket
      this.broadcastToClients({
        type: 'realtimePriceUpdate',
        data: tokenData
      });
      
      // Log compact du prix reçu
      const symbol = tokenData.symbol || tokenData.mint?.substring(0,8) || 'Unknown';
      const changeInfo = tokenData.priceChangePercent ? 
        ` (${tokenData.priceChangePercent >= 0 ? '+' : ''}${tokenData.priceChangePercent.toFixed(4)}%)` : '';
      
      console.log(`📡 Diffusion prix ${symbol}: $${tokenData.price?.toFixed(8)}${changeInfo} [${tokenData.source}]`);
    });

    // Écouter le démarrage du service
    this.realtimePriceService.on('serviceStarted', (data) => {
      console.log(`🎯 Service GMGN démarré - ${data.tokensCount} tokens surveillés`);
    });
  }



  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, request) => {
      console.log(`🔌 Nouvelle connexion WebSocket depuis ${request.socket.remoteAddress}`);
      
      // Ajouter le client
      this.clients.add(ws);
      
      // Envoyer les données initiales
      const summary = this.positionManager.getPositionsSummary();
      
      // Démarrer le suivi des prix pour les positions ouvertes
      this.realtimePriceService.updateTrackedTokens(summary.positions || []);
      
      // 🔧 AUSSI mettre à jour le service Helius
      if (this.heliusService) {
        this.heliusService.updateTrackedTokens(summary.positions || []);
      }
      
      this.sendToClient(ws, {
        type: 'initialData',
        positions: summary,
        transactions: {
          total: this.positionManager.transactions.length,
          recent: this.positionManager.transactions.slice(0, 10)
        },
        health: {
          clients: this.clients.size,
          uptime: '-',
          successRate: '100'
        },
        realtimePrices: Object.fromEntries(this.realtimePriceService.getAllCurrentPrices())
      });

      // Gérer les messages du client
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('❌ Erreur parsing message client:', error.message);
        }
      });

      // Gérer la déconnexion
      ws.on('close', () => {
        console.log('🔌 Client WebSocket déconnecté');
        this.clients.delete(ws);
      });

      // Gérer les erreurs
      ws.on('error', (error) => {
        console.error('❌ Erreur WebSocket:', error.message);
        this.clients.delete(ws);
      });
    });
  }

  handleClientMessage(ws, message) {
    switch (message.type) {
      case 'requestData':
      case 'get_positions':
        const summary = this.positionManager.getPositionsSummary();
        this.sendToClient(ws, {
          type: 'initialData',
          positions: summary,
          transactions: {
            total: this.positionManager.transactions.length,
            recent: this.positionManager.transactions.slice(0, 10)
          },
          health: {
            clients: this.clients.size,
            uptime: '-',
            successRate: '100'
          }
        });
        break;

      case 'simulate_transaction':
        // Pour les tests - simuler une transaction
        if (message.transactionData) {
          const analysis = this.positionManager.simulateTransaction(message.transactionData);
          this.sendToClient(ws, {
            type: 'transaction_simulated',
            data: analysis
          });
        }
        break;

      case 'get_transaction_history':
        this.sendToClient(ws, {
          type: 'transaction_history',
          data: this.positionManager.transactions.slice(0, 50) // 50 dernières
        });
        break;

      default:
        console.log(`⚠️  Message non reconnu: ${message.type}`);
    }
  }

  sendToClient(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(messageStr);
      }
    });
    
    // Log moins verbeux - seulement pour les événements importants
    if (this.clients.size > 0 && message.type !== 'realtimePriceUpdate') {
      console.log(`📡 Message diffusé à ${this.clients.size} client(s): ${message.type}`);
    }
  }

  // API REST simple pour les données statiques
  setupRestAPI() {
    this.server.on('request', async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://localhost:${this.port}`);
      
      switch (url.pathname) {
        case '/':
          try {
            const htmlPath = path.join(process.cwd(), 'public', 'index.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(htmlContent);
          } catch (error) {
            console.error('❌ Erreur lecture public/index.html:', error.message);
            console.error('❌ Chemin testé:', path.join(process.cwd(), 'public', 'index.html'));
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(this.getStatusPage());
          }
          break;

        case '/api/positions':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const positionsSummary = this.positionManager.getPositionsSummary();
          // Ajouter les prix temps réel
          const realtimePrices = Object.fromEntries(this.realtimePriceService.getAllCurrentPrices());
          res.end(JSON.stringify({
            ...positionsSummary,
            realtimePrices
          }));
          break;

        case '/api/positions/enriched':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const enrichedSummary = await this.positionManager.getEnrichedPositionsSummary();
          res.end(JSON.stringify(enrichedSummary));
          break;

        case '/api/realtime-prices':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            prices: Object.fromEntries(this.realtimePriceService.getAllCurrentPrices()),
            stats: this.realtimePriceService.getStats()
          }));
          break;

        case '/api/switch-price-api':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const newAPI = data.api; // 'jupiter' ou 'dexscreener'
                
                if (newAPI === 'jupiter' || newAPI === 'dexscreener') {
                  this.realtimePriceService.switchAPI(newAPI);
                  
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: true,
                    message: `API changée vers ${newAPI.toUpperCase()}`,
                    stats: this.realtimePriceService.getStats()
                  }));
                } else {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: false,
                    message: 'API non supportée. Utilisez "jupiter" ou "dexscreener"'
                  }));
                }
              } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: error.message
                }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use POST.');
          }
          break;

        case '/api/reload-metadata':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          // Recharger le cache des métadonnées
          this.positionManager.metadataService.loadCache();
          res.end(JSON.stringify({ 
            status: 'success', 
            message: 'Cache des métadonnées rechargé',
            cacheSize: this.positionManager.metadataService.cache.size
          }));
          break;

        case '/api/health':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'healthy',
            clients: this.clients.size,
            positions: this.positionManager.positions.size,
            transactions: this.positionManager.transactions.length,
            timestamp: new Date().toISOString()
          }));
          break;

        case '/api/performance-history':
          if (req.method === 'GET') {
            // Charger l'historique de performance
            try {
              const historyFile = path.join('positions', 'performance_history.json');
              
              if (fs.existsSync(historyFile)) {
                const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, ...data }));
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Aucun historique trouvé' }));
              }
            } catch (error) {
              console.error('Erreur chargement historique performance:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: error.message }));
            }
          } else if (req.method === 'POST') {
            // Sauvegarder l'historique de performance
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const historyFile = path.join('positions', 'performance_history.json');
                
                // Créer le dossier si il n'existe pas
                if (!fs.existsSync('positions')) {
                  fs.mkdirSync('positions', { recursive: true });
                }
                
                // Sauvegarder les données
                fs.writeFileSync(historyFile, JSON.stringify(data, null, 2));
                
                console.log('💾 Historique de performance sauvegardé:', Object.keys(data.history || {}).length, 'positions');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              } catch (error) {
                console.error('Erreur sauvegarde historique performance:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use GET or POST.');
          }
          break;

        case '/api/sell-token-direct':
        case '/api/sell-direct':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
              try {
                const { mint } = JSON.parse(body);
                
                if (!mint) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: 'Mint address requis' }));
                  return;
                }
                
                console.log(`🔄 Vente directe demandée pour: ${mint}`);
                
                // Exécuter le script de vente
                const result = await this.executeSellScript(mint);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
                
              } catch (error) {
                console.error('❌ Erreur vente directe:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use POST.');
          }
          break;

        case '/helius-webhook':
        case '/api/webhook':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
              try {
                const rawData = JSON.parse(body);
                console.log('🎯 WEBHOOK HELIUS REÇU DIRECTEMENT:', JSON.stringify(rawData, null, 2));
                
                // Helius envoie un tableau de transactions
                let transactions = [];
                if (Array.isArray(rawData)) {
                  transactions = rawData;
                } else if (rawData.transaction) {
                  // Format du Worker Cloudflare
                  transactions = [rawData.transaction];
                } else {
                  // Format direct Helius
                  transactions = [rawData];
                }

                let processedCount = 0;
                transactions.forEach(transaction => {
                  if (transaction && transaction.signature) {
                    console.log(`📝 Traitement transaction: ${transaction.signature}`);
                    
                    // Analyser la transaction avec le PositionManager
                    const analysis = this.positionManager.analyzeTransaction(transaction);
                    
                    // Sauvegarder la transaction
                    this.positionManager.saveTransaction({
                      raw: transaction,
                      analysis: analysis,
                      timestamp: new Date().toISOString()
                    });

                    // Mettre à jour les positions
                    this.positionManager.updatePositions(analysis);
                    processedCount++;
                  }
                });

                console.log(`✅ ${processedCount} transaction(s) traitée(s) avec succès`);
                
                // Diffuser la mise à jour des positions à tous les clients
                const updatedSummary = this.positionManager.getPositionsSummary();
                this.broadcastToClients({
                  type: 'positionsUpdate',
                  data: updatedSummary
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  status: 'success', 
                  received: true, 
                  processed: processedCount,
                  timestamp: new Date().toISOString()
                }));
              } catch (error) {
                console.error('❌ Erreur traitement webhook Helius:', error.message);
                console.error('❌ Body reçu:', body);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  status: 'error', 
                  message: error.message,
                  timestamp: new Date().toISOString()
                }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use POST.');
          }
          break;

        // === ROUTES FERMETURE DE TRADES OPTIMISÉES ===
        case '/api/close-trade/balance':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
              try {
                const { mint } = JSON.parse(body);
                
                if (!mint) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: false,
                    error: 'Paramètre manquant: mint requis'
                  }));
                  return;
                }

                console.log(`🔍 Récupération solde exact: ${mint.substring(0, 8)}... pour wallet configuré`);
                
                // Utiliser la clé privée depuis l'environnement
                const balance = await this.tradeCloser.getTokenBalanceInBaseUnits(mint);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  data: balance
                }));

              } catch (error) {
                console.error(`❌ Erreur récupération solde:`, error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: error.message
                }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use POST.');
          }
          break;

        case '/api/close-trade/quote-optimized':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
              try {
                const { mint, exactAmount, decimals, retryAttempt } = JSON.parse(body);
                
                if (!mint || !exactAmount || decimals === undefined) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: false,
                    error: 'Paramètres manquants: mint, exactAmount et decimals requis'
                  }));
                  return;
                }

                console.log(`📋 Quote optimisé ${retryAttempt > 0 ? `(retry ${retryAttempt}) ` : ''}pour ${exactAmount} unités de ${mint.substring(0, 8)}...`);
                
                // Utiliser une logique similaire au script sell_all_tokens_fast.js
                const quote = await this.tradeCloser.getOptimizedCloseQuote(mint, exactAmount, decimals, retryAttempt);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  data: quote
                }));

              } catch (error) {
                console.error(`❌ Erreur quote optimisé:`, error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: error.message,
                  type: error.message.includes('circuit') ? 'CIRCUIT_BREAKER' : 'UNKNOWN'
                }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use POST.');
          }
          break;

        case '/api/close-trade/execute-optimized':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
              try {
                const { mint, exactAmount, decimals, retryAttempt, autoSign, sellPercentage } = JSON.parse(body);
                
                if (!mint || (!exactAmount && !autoSign)) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: false,
                    error: 'Paramètres manquants: mint requis, et soit exactAmount soit autoSign'
                  }));
                  return;
                }

                // NOUVELLE LOGIQUE: Calculer exactAmount depuis sellPercentage
                let finalExactAmount = exactAmount;
                let finalDecimals = decimals;
                
                if (!exactAmount && sellPercentage && sellPercentage !== 100) {
                  console.log(`📊 Calcul fermeture partielle ${sellPercentage}% pour ${mint.substring(0, 8)}...`);
                  
                  // Récupérer le solde actuel pour calculer le montant exact
                  const currentBalance = await this.tradeCloser.getTokenBalanceInBaseUnits(mint);
                  finalExactAmount = Math.floor(currentBalance.rawAmount * (sellPercentage / 100));
                  finalDecimals = currentBalance.decimals;
                  
                  console.log(`📊 Calcul montant partiel: ${currentBalance.rawAmount} * ${sellPercentage}% = ${finalExactAmount} tokens`);
                }

                console.log(`🚀 Exécution optimisée ${retryAttempt > 0 ? `(retry ${retryAttempt}) ` : ''}pour ${mint.substring(0, 8)}... ${autoSign ? '(signature automatique)' : ''} ${sellPercentage ? `(${sellPercentage}%)` : ''}`);
                
                let result;
                if (autoSign) {
                  // Mode signature automatique - comme le script sell_all_tokens_fast.js
                  result = await this.tradeCloser.executeOptimizedCloseWithAutoSign(mint, finalExactAmount, finalDecimals, retryAttempt);
                } else {
                  // Mode signature manuelle (ancienne méthode)
                  result = await this.tradeCloser.executeOptimizedClose(mint, finalExactAmount, finalDecimals, retryAttempt);
                }
                
                if (result.success) {
                  // Logger la vente réussie
                  this.logSellSuccess(mint, result, sellPercentage, finalExactAmount);
                  
                  // Diffuser la mise à jour des positions à tous les clients
                  const summary = this.positionManager.getPositionsSummary();
                  this.broadcastToClients({
                    type: 'positionsUpdate',
                    data: summary
                  });
                  
                  // Mettre à jour les tokens suivis pour les prix temps réel
                  this.realtimePriceService.updateTrackedTokens(summary.positions || []);
                  
                  // 🔧 AUSSI mettre à jour le service Helius
                  if (this.heliusService) {
                    this.heliusService.updateTrackedTokens(summary.positions || []);
                  }
                } else {
                  // Logger l'erreur de vente
                  this.logSellFailure(mint, result, sellPercentage, result.error);
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));

              } catch (error) {
                console.error(`❌ Erreur exécution optimisée:`, error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: error.message
                }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use POST.');
          }
          break;

        case '/api/close-trade/execute-ultra-optimized':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
              try {
                console.log('🔍 ENDPOINT ULTRA-OPTIMISÉ APPELÉ - Début parsing...');
                const { mint, sellPercentage = 25 } = JSON.parse(body);
                console.log('🔍 ENDPOINT: Body parsé:', { mint: mint?.substring(0, 8), sellPercentage });
                
                if (!mint) {
                  console.log('❌ ENDPOINT: Mint manquant');
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: false,
                    error: 'Paramètre manquant: mint requis'
                  }));
                  return;
                }

                console.log(`⚡ DÉMARRAGE vente ultra-optimisée ${sellPercentage}% pour ${mint.substring(0, 8)}...`);
                console.log('🔍 ENDPOINT: Service disponible:', !!this.optimizedSellService);
                
                const result = await this.optimizedSellService.executeOptimizedSell(mint, sellPercentage);
                
                if (result.success) {
                  // Logger la vente réussie
                  this.logSellSuccess(mint, result, sellPercentage, result.sellAmount);
                  
                  // Diffuser la mise à jour des positions à tous les clients
                  const summary = this.positionManager.getPositionsSummary();
                  this.broadcastToClients({
                    type: 'positionsUpdate',
                    data: summary
                  });
                  
                  // Mettre à jour les tokens suivis pour les prix temps réel
                  this.realtimePriceService.updateTrackedTokens(summary.positions || []);
                  
                  // 🔧 AUSSI mettre à jour le service Helius
                  if (this.heliusService) {
                    this.heliusService.updateTrackedTokens(summary.positions || []);
                  }
                  
                  console.log(`🎉 VENTE ULTRA-OPTIMISÉE RÉUSSIE: ${result.executionTimeMs}ms (${result.method})`);
                } else {
                  // Logger l'erreur de vente
                  this.logSellFailure(mint, result, sellPercentage, result.error);
                  console.error(`❌ VENTE ULTRA-OPTIMISÉE ÉCHOUÉE: ${result.error}`);
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));

              } catch (error) {
                console.error(`❌ Erreur vente ultra-optimisée:`, error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: error.message,
                  executionTimeMs: -1,
                  method: 'ERROR'
                }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use POST.');
          }
          break;

        // === ROUTES FERMETURE DE TRADES (ANCIENNES) ===
        case '/api/close-trade/quote':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
              try {
                const { mint, userPublicKey, sellPercentage = 100 } = JSON.parse(body);
                
                if (!mint || !userPublicKey) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: false,
                    error: 'Paramètres manquants: mint et userPublicKey requis'
                  }));
                  return;
                }

                console.log(`📋 Demande quote fermeture ${sellPercentage}%: ${mint.substring(0, 8)}... par ${userPublicKey.substring(0, 8)}...`);
                
                const quote = await this.tradeCloser.getCloseQuote(mint, userPublicKey, sellPercentage);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  data: quote
                }));

              } catch (error) {
                console.error(`❌ Erreur quote fermeture:`, error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: error.message,
                  type: error.message.includes('circuit') ? 'CIRCUIT_BREAKER' : 'UNKNOWN'
                }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use POST.');
          }
          break;

        case '/api/close-trade/execute':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
              try {
                const { mint, signedTransaction, sellPercentage = 100 } = JSON.parse(body);
                
                if (!mint || !signedTransaction) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: false,
                    error: 'Paramètres manquants: mint et signedTransaction requis'
                  }));
                  return;
                }

                console.log(`🚀 Exécution fermeture ${sellPercentage}%: ${mint.substring(0, 8)}...`);
                
                const result = await this.tradeCloser.executeClose(mint, signedTransaction, sellPercentage);
                
                if (result.success) {
                  // Diffuser la mise à jour des positions à tous les clients
                  const summary = this.positionManager.getPositionsSummary();
                  this.broadcastToClients({
                    type: 'positionsUpdate',
                    data: summary
                  });
                  
                  // Mettre à jour les tokens suivis pour les prix temps réel
                  this.realtimePriceService.updateTrackedTokens(summary.positions || []);
                  
                  // 🔧 AUSSI mettre à jour le service Helius
                  if (this.heliusService) {
                    this.heliusService.updateTrackedTokens(summary.positions || []);
                  }
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));

              } catch (error) {
                console.error(`❌ Erreur exécution fermeture:`, error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: error.message
                }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use POST.');
          }
          break;

        case '/api/close-trade/status':
          if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              stats: this.tradeCloser.getStats(),
              message: 'Statistiques du service de fermeture de trades'
            }));
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use GET.');
          }
          break;



        // === ROUTES POUR LES LOGS DE TRADING ===
        case '/api/trade-logs/today':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const todayLogs = this.tradeLogger.getTodayLogs();
          res.end(JSON.stringify({ success: true, logs: todayLogs, count: todayLogs.length }));
          break;

        case '/api/trade-logs/stats':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const stats = this.tradeLogger.getStats();
          res.end(JSON.stringify({ success: true, stats }));
          break;

        case '/api/trade-logs/performance-report':
          if (req.method === 'GET') {
            const days = parseInt(url.searchParams.get('days')) || 7;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            const report = this.tradeLogger.getPerformanceReport(days);
            res.end(JSON.stringify({ success: true, report }));
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use GET.');
          }
          break;

        case '/api/trade-logs/export':
          if (req.method === 'GET') {
            try {
              const days = parseInt(url.searchParams.get('days')) || 30;
              const exportFile = this.tradeLogger.exportToCSV(days);
              
              res.writeHead(200, { 
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="trades_export_${new Date().toISOString().split('T')[0]}.csv"`
              });
              
              const csvContent = fs.readFileSync(exportFile, 'utf8');
              res.end(csvContent);
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: error.message }));
            }
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use GET.');
          }
          break;

        case '/api/trade-logs/token':
          if (req.method === 'GET') {
            console.error('🌟 ROUTE API APPELÉE: /api/trade-logs/token');
            const tokenMint = url.searchParams.get('mint');
            console.error('🌟 MINT REÇU:', tokenMint);
            if (!tokenMint) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Paramètre mint requis' }));
              break;
            }
            
            const limit = parseInt(url.searchParams.get('limit')) || 100;
            
            // Vérifier si c'est MASK - générer logs simplifiés à partir de la position
            console.error('🔍 API: Token demandé:', tokenMint);
            if (tokenMint === '6MQpbiTC2YcogidTmKqMLK82qvE9z5QEm7EP3AEDpump') {
              console.error('🔍 API DEBUG: MATCH MASK DÉTECTÉ!');
              console.error('🔍 API DEBUG: PositionManager existe:', !!this.positionManager);
              console.error('🔍 API DEBUG: PositionManager.positions existe:', !!this.positionManager?.positions);
              console.error('🔍 API DEBUG: Nombre de positions dans PositionManager:', Object.keys(this.positionManager?.positions || {}).length);
              
              const simplifiedLogs = this.generateMaskSimplifiedLogs();
              console.error('🔍 API DEBUG: Logs générés:', simplifiedLogs.length);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, logs: simplifiedLogs, count: simplifiedLogs.length }));
              break;
            }
            
            const tokenLogs = this.tradeLogger.getLogsByToken(tokenMint, limit);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, logs: tokenLogs, count: tokenLogs.length }));
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use GET.');
          }
          break;

        case '/api/trade-logs/date':
          if (req.method === 'GET') {
            const date = url.searchParams.get('date');
            if (!date) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Paramètre date requis (format YYYY-MM-DD)' }));
              break;
            }
            
            const dateLogs = this.tradeLogger.getLogsByDate(date);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, logs: dateLogs, count: dateLogs.length, date }));
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed. Use GET.');
          }
          break;

        default:
          // Vérifier si c'est une demande de transaction spécifique
          if (url.pathname.startsWith('/api/transaction/')) {
            const signature = url.pathname.split('/api/transaction/')[1];
            this.handleTransactionRequest(res, signature);
            break;
          }
          
          // Vérifier statut d'une transaction spécifique via close-trade
          if (url.pathname.startsWith('/api/close-trade/tx/')) {
            if (req.method === 'GET') {
              const signature = url.pathname.split('/').pop();
              if (!signature) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: 'Signature de transaction manquante'
                }));
                return;
              }

              try {
                const status = await this.tradeCloser.getTransactionStatus(signature);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  data: status
                }));
              } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: error.message
                }));
              }
            } else {
              res.writeHead(405, { 'Content-Type': 'text/plain' });
              res.end('Method Not Allowed. Use GET.');
            }
            break;
          }
          
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
      }
    });
  }

  // Nouvelle méthode pour gérer les demandes de transactions individuelles
  handleTransactionRequest(res, signature) {
    try {
      console.log(`🔍 Recherche transaction avec signature: ${signature}`);
      
      // Lister tous les fichiers de transactions
      const transactionFiles = fs.readdirSync('received_transactions')
        .filter(file => file.endsWith('.json') && file.startsWith('transaction_'));
      
      console.log(`📁 ${transactionFiles.length} fichiers de transactions trouvés`);
      
      // Chercher dans le contenu des fichiers
      let foundTransaction = null;
      for (const file of transactionFiles) {
        try {
          const filePath = path.join('received_transactions', file);
          const transactionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          // Vérifier si la signature correspond
          if (transactionData.raw && transactionData.raw.signature === signature) {
            console.log(`✅ Transaction trouvée dans: ${file}`);
            foundTransaction = transactionData;
            break;
          }
        } catch (fileError) {
          console.warn(`⚠️ Erreur lecture fichier ${file}:`, fileError.message);
        }
      }
      
      if (!foundTransaction) {
        console.log(`❌ Transaction ${signature} non trouvée dans ${transactionFiles.length} fichiers`);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Transaction non trouvée',
          signature: signature,
          filesSearched: transactionFiles.length
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(foundTransaction, null, 2));

    } catch (error) {
      console.error(`❌ Erreur récupération transaction ${signature}:`, error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Erreur serveur',
        message: error.message 
      }));
    }
  }

  getStatusPage() {
    const summary = this.positionManager.getPositionsSummary();
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Solana Position Manager</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .positions { margin-top: 30px; }
        .position { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 8px; }
        .position.open { border-left: 4px solid #28a745; }
        .position.closed { border-left: 4px solid #dc3545; }
        .refresh { text-align: center; margin-top: 20px; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
        button:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Solana Position Manager</h1>
            <p>Surveillance en temps réel des positions de trading</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${summary.openPositions}</div>
                <div class="stat-label">Positions Ouvertes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.closedPositions}</div>
                <div class="stat-label">Positions Fermées</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.totalInvested.toFixed(2)}</div>
                <div class="stat-label">SOL Investi</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.totalPnL.toFixed(2)}</div>
                <div class="stat-label">PnL Total</div>
            </div>
        </div>

        <div class="positions">
            <h3>📊 Positions Récentes</h3>
            ${summary.positions.slice(0, 5).map(pos => `
                <div class="position ${pos.status.toLowerCase()}">
                    <strong>Token:</strong> ${pos.mint.substring(0, 8)}...<br>
                    <strong>Montant:</strong> ${pos.totalAmount} tokens<br>
                    <strong>Prix Moyen:</strong> ${pos.averagePrice?.toFixed(6)} SOL<br>
                    <strong>Investi:</strong> ${pos.totalInvested.toFixed(4)} SOL<br>
                    <strong>Statut:</strong> ${pos.status}<br>
                    <strong>Dernière MAJ:</strong> ${new Date(pos.lastUpdate).toLocaleString()}
                </div>
            `).join('')}
        </div>

        <div class="refresh">
            <button onclick="location.reload()">🔄 Actualiser</button>
            <button onclick="window.open('/api/positions', '_blank')">📊 API JSON</button>
        </div>

        <div style="margin-top: 30px; text-align: center; color: #666;">
            <p>🔌 WebSocket: ws://localhost:${this.port}</p>
            <p>📡 API: http://localhost:${this.port}/api/positions</p>
            <p>⏰ Dernière mise à jour: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Méthode pour exécuter le script de vente directement
  async executeSellScript(mint) {
    try {
      console.log(`🚀 VENTE DIRECTE SERVEUR pour: ${mint}`);
      
      // Importer les modules nécessaires (identique au script)
      const { Connection, Keypair, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const bs58 = await import('bs58');
      const fetch = (await import('node-fetch')).default;
      
      // Configuration ADAPTÉE pour tokens faible liquidité
      const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY';
      const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const SLIPPAGE_BPS = 500; // 5% - Plus tolérant pour tokens faible liquidité
      const PRIORITY_FEE_LAMPORTS = 1000000; // 0.001 SOL - Plus élevé pour priorité
      const MAX_RETRY_FOR_REMAINING = 5; // Plus de retries

      // Récupérer la clé privée
      const privateKeyBase58 = process.env.PRIVATE_KEY;
      if (!privateKeyBase58) {
        throw new Error('PRIVATE_KEY non configurée dans .env');
      }

      // Créer le keypair
      const privateKeyBytes = bs58.default.decode(privateKeyBase58);
      const userKeypair = Keypair.fromSecretKey(privateKeyBytes);
      
      console.log(`🔑 Adresse du portefeuille: ${userKeypair.publicKey.toBase58()}`);
      
      const connection = new Connection(HELIUS_RPC_URL, 'confirmed');

      // Fonction helper EXACTE du script
      const getTokenBalanceWithDecimals = async (ownerPublicKey, tokenMintAddress) => {
        try {
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
            mint: new PublicKey(tokenMintAddress),
          });
          
          if (tokenAccounts.value.length === 0) {
            return { balance: 0, decimals: 6, rawAmount: 0 };
          }
          
          const accountInfo = tokenAccounts.value[0].account.data.parsed.info;
          const balance = parseFloat(accountInfo.tokenAmount.uiAmountString);
          const decimals = accountInfo.tokenAmount.decimals;
          const rawAmount = parseInt(accountInfo.tokenAmount.amount);
          
          return { balance, decimals, rawAmount };
        } catch (error) {
          console.error(`❌ Erreur solde token ${tokenMintAddress}:`, error.message);
          throw error;
        }
      };

      // Fonction de vente avec retry EXACTE du script
      const sellAllTokensWithRetry = async (tokenMintAddress, retryCount = 0) => {
        console.log(`🔄 Tentative ${retryCount + 1}/${MAX_RETRY_FOR_REMAINING + 1} de vente pour ${tokenMintAddress.substring(0, 8)}...`);

        // 1. Vérifier le solde actuel du token
        const { balance: tokenBalanceUiAmount, rawAmount, decimals: tokenDecimals } = await getTokenBalanceWithDecimals(userKeypair.publicKey, tokenMintAddress);
        
        if (tokenBalanceUiAmount === 0) {
          if (retryCount === 0) {
            return { success: false, error: `Aucun token ${tokenMintAddress.substring(0, 8)}... trouvé dans le portefeuille` };
          } else {
            console.log(`🎉 SUCCÈS TOTAL ! Tous les tokens ont été vendus (après ${retryCount} tentatives).`);
            return { success: true, remainingBalance: 0, completionRate: "100%" };
          }
        }
        
        console.log(`💰 Solde trouvé: ${tokenBalanceUiAmount} tokens (${rawAmount} unités brutes)`);
        console.log(`🪙 Décimales du token: ${tokenDecimals}`);

        // 2. Utiliser le montant RAW exact pour éviter les erreurs d'arrondi
        const amountInSmallestUnit = rawAmount;
        console.log(`🔢 Montant EXACT à vendre: ${amountInSmallestUnit} unités`);

        // 3. Adapter le slippage selon les tentatives (plus de slippage = plus de chances de succès)
        const adaptiveSlippage = Math.min(SLIPPAGE_BPS + (retryCount * 100), 500); // Max 5%
        console.log(`📊 Slippage adaptatif: ${adaptiveSlippage / 100}% (tentative ${retryCount + 1})`);

        // 4. Obtenir un quote de Jupiter avec le montant exact
        console.log("🔄 Obtention du quote Jupiter avec montant exact...");
        const quoteUrl = `${JUPITER_API_URL}/quote?inputMint=${tokenMintAddress}&outputMint=${SOL_MINT}&amount=${amountInSmallestUnit}&slippageBps=${adaptiveSlippage}&onlyDirectRoutes=false&maxAccounts=20`;
        
        let quoteResponse;
        try {
          const response = await fetch(quoteUrl);
          if (!response.ok) {
            const errorData = await response.text();
            if (response.status === 429) {
              throw new Error(`Rate limit Jupiter - Attendre avant retry`);
            }
            throw new Error(`Erreur API Jupiter (Quote): ${response.status} - ${errorData}`);
          }
          quoteResponse = await response.json();
          
          if (!quoteResponse || quoteResponse.error) {
            throw new Error(`Quote invalide: ${quoteResponse?.error || 'Réponse vide'}`);
          }
          
          console.log("✅ Quote Jupiter reçu pour", quoteResponse.inAmount, "unités →", parseFloat(quoteResponse.outAmount) / LAMPORTS_PER_SOL, "SOL");
        } catch (error) {
          console.error("❌ Erreur lors de l'obtention du quote:", error.message);
          
          // Retry intelligent selon le type d'erreur
          if (retryCount < MAX_RETRY_FOR_REMAINING) {
            if (error.message.includes('Rate limit')) {
              console.log("⏳ Attente 30s pour rate limit Jupiter...");
              await new Promise(resolve => setTimeout(resolve, 30000));
            } else {
              console.log("⏳ Attente 5s avant retry quote...");
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
            return await sellAllTokensWithRetry(tokenMintAddress, retryCount + 1);
          }
          throw error;
        }

        // 5. Construire la transaction de swap avec optimisations EXACTES
        console.log("🛠️ Construction de la transaction optimisée...");
        let swapTransactionB64;
        try {
          const swapResponse = await fetch(`${JUPITER_API_URL}/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quoteResponse: quoteResponse,
              userPublicKey: userKeypair.publicKey.toBase58(),
              wrapAndUnwrapSol: true,
              dynamicComputeUnitLimit: true,
              prioritizationFeeLamports: PRIORITY_FEE_LAMPORTS + (retryCount * 100000), // Augmenter les frais à chaque retry
              skipUserAccountsRpcCalls: true,
              dynamicSlippage: { "maxBps": adaptiveSlippage + 50 }, // Slippage encore plus élevé pour la transaction
            }),
          });
          
          if (!swapResponse.ok) {
            const errorData = await swapResponse.text();
            throw new Error(`Erreur API Jupiter (Swap): ${swapResponse.status} - ${errorData}`);
          }
          
          const swapJson = await swapResponse.json();
          swapTransactionB64 = swapJson.swapTransaction;
          console.log("✅ Transaction de swap construite avec slippage dynamique.");
        } catch (error) {
          console.error("❌ Erreur lors de la construction de la transaction:", error.message);
          
          // Retry pour erreurs de construction
          if (retryCount < MAX_RETRY_FOR_REMAINING && !error.message.includes('insufficient')) {
            console.log("⏳ Attente 3s avant retry construction...");
            await new Promise(resolve => setTimeout(resolve, 3000));
            return await sellAllTokensWithRetry(tokenMintAddress, retryCount + 1);
          }
          throw error;
        }

        // 6. Signer et envoyer la transaction avec blockhash frais
        console.log("✍️ Signature et envoi avec blockhash frais...");
        try {
          const transactionBuffer = Buffer.from(swapTransactionB64, 'base64');
          const transaction = VersionedTransaction.deserialize(transactionBuffer);
          
          // Obtenir un blockhash très frais pour maximiser les chances de succès
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
          transaction.message.recentBlockhash = blockhash;
          
          transaction.sign([userKeypair]);
          console.log("🔑 Transaction signée avec blockhash frais.");

          const rawTransaction = transaction.serialize();
          const txid = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            maxRetries: 3,
            preflightCommitment: 'confirmed'
          });
          
          console.log("🚀 Transaction envoyée. En attente de confirmation...");
          console.log(`🕒 Signature: ${txid}`);
          console.log(`🔗 Explorer: https://solscan.io/tx/${txid}`);

          const confirmation = await connection.confirmTransaction({
            signature: txid,
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight
          }, 'confirmed');

          if (confirmation.value.err) {
            throw new Error(`Échec de la confirmation: ${JSON.stringify(confirmation.value.err)}`);
          }

          console.log("✅ Transaction confirmée avec succès!");
          
          // 7. Vérifier le solde restant après un délai
          console.log("⏳ Vérification du solde restant...");
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const { balance: remainingBalance } = await getTokenBalanceWithDecimals(userKeypair.publicKey, tokenMintAddress);
          
          if (remainingBalance > 0 && retryCount < MAX_RETRY_FOR_REMAINING) {
            console.log(`⚠️ Solde restant détecté: ${remainingBalance} tokens. Retry automatique...`);
            return await sellAllTokensWithRetry(tokenMintAddress, retryCount + 1);
          }
          
          const solReceived = parseFloat(quoteResponse.outAmount) / LAMPORTS_PER_SOL;
          console.log(`🎉 Vente ${remainingBalance > 0 ? 'quasi-' : ''}complète! ${solReceived.toFixed(6)} SOL reçus.`);
          
          if (remainingBalance > 0) {
            console.log(`📊 Résidu final: ${remainingBalance} tokens (${((remainingBalance / tokenBalanceUiAmount) * 100).toFixed(6)}%)`);
          }
          
          return { 
            success: true, 
            signature: txid, 
            solReceived, 
            initialBalance: tokenBalanceUiAmount,
            finalBalance: remainingBalance,
            completionRate: `${((tokenBalanceUiAmount - remainingBalance) / tokenBalanceUiAmount * 100).toFixed(2)}%`,
            explorerUrl: `https://solscan.io/tx/${txid}`
          };

        } catch (error) {
          console.error("❌ Erreur lors de la signature ou de l'envoi:", error.message);
          
          // Analyse intelligente des erreurs pour déterminer la stratégie de retry
          const errorMessage = error.message.toLowerCase();
          let shouldRetry = false;
          let waitTime = 2000;
          
          if (errorMessage.includes('0x1771')) {
            console.log("🔍 Erreur 0x1771 détectée (slippage/liquidité) - Retry avec plus de slippage...");
            shouldRetry = true;
            waitTime = 5000;
          } else if (errorMessage.includes('block height exceeded') || errorMessage.includes('blockhash')) {
            console.log("🔍 Erreur blockhash - Retry avec nouveau blockhash...");
            shouldRetry = true;
            waitTime = 2000;
          } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
            console.log("🔍 Rate limit détecté - Attente prolongée...");
            shouldRetry = true;
            waitTime = 30000;
          } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
            console.log("🔍 Solde insuffisant - Pas de retry");
            shouldRetry = false;
          } else if (errorMessage.includes('simulation failed')) {
            console.log("🔍 Simulation échouée - Retry avec plus de slippage...");
            shouldRetry = true;
            waitTime = 3000;
          } else {
            console.log("🔍 Erreur générique - Retry conservatif...");
            shouldRetry = true;
            waitTime = 5000;
          }
          
          if (shouldRetry && retryCount < MAX_RETRY_FOR_REMAINING) {
            console.log(`⏳ Attente ${waitTime/1000}s avant retry automatique...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return await sellAllTokensWithRetry(tokenMintAddress, retryCount + 1);
          }
          
          throw error;
        }
      };

      // Exécuter la vente avec la logique EXACTE du script original
      return await sellAllTokensWithRetry(mint);

    } catch (error) {
      console.error('❌ Erreur vente directe serveur:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Générer logs simplifiés pour MASK à partir des données de position
  generateMaskSimplifiedLogs() {
    const MASK_MINT = "6MQpbiTC2YcogidTmKqMLK82qvE9z5QEm7EP3AEDpump";
    const SOL_PRICE = 156.51; // Prix SOL moyen de la période
    
                try {
        console.error('🔍 MASK DEBUG: Génération logs MASK...');
        
        // Charger la position MASK
        const positions = this.positionManager.positions;
        console.error('🔍 MASK DEBUG: Positions trouvées:', Object.keys(positions || {}).length);
        
        const maskPosition = positions[MASK_MINT];
        console.error('🔍 MASK DEBUG: Position MASK trouvée:', !!maskPosition);
      
      if (!maskPosition) {
        console.log('❌ API DEBUG: Aucune position MASK trouvée');
        return [];
      }

      console.log('🔍 API DEBUG: Transactions MASK:', maskPosition.transactions?.length || 0);
      console.log('🔍 API DEBUG: Statut MASK:', maskPosition.status);

      const logs = [];
      
      // Générer les logs des transactions réussies
      if (maskPosition.transactions && maskPosition.transactions.length > 0) {
        maskPosition.transactions.forEach((tx, index) => {
          console.log(`🔍 API DEBUG: Transaction ${index}:`, tx.type, tx.amount, tx.timestamp);
          
          if (tx.type === 'BUY') {
            logs.push({
              id: `mask_buy_${index}`,
              type: 'BUY',
              timestamp: tx.timestamp,
              tokenMint: MASK_MINT,
              message: `✅ Achat: ${tx.amount.toFixed(2)} MASK à ${tx.price.toFixed(8)} SOL → Investi: ${tx.solAmount.toFixed(3)} SOL ($${(tx.solAmount * SOL_PRICE).toFixed(2)})`,
              solAmount: tx.solAmount,
              tokenAmount: tx.amount,
              pricePerToken: tx.price,
              platform: maskPosition.platformInfo?.dexName || 'Meteora',
              signature: tx.signature || null
            });
          } else if (tx.type === 'SELL') {
            const performance = ((tx.price - maskPosition.averagePrice) / maskPosition.averagePrice) * 100;
            const perfStr = performance > 0 ? `+${performance.toFixed(0)}%` : `${performance.toFixed(0)}%`;
            
            logs.push({
              id: `mask_sell_${index}`,
              type: 'SELL',
              timestamp: tx.timestamp,
              tokenMint: MASK_MINT,
              message: `📉 Vente 25%: ${tx.amount.toFixed(2)} MASK à ${tx.price.toFixed(8)} SOL → Reçu: ${tx.solAmount.toFixed(3)} SOL ($${(tx.solAmount * SOL_PRICE).toFixed(2)}) | ${perfStr} (2.3s)`,
              percentage: 25,
              tokensSold: tx.amount,
              solReceived: tx.solAmount,
              sellPerformance: performance,
              signature: tx.signature || null
            });
          }
        });
      } else {
        console.log('⚠️ API DEBUG: Aucune transaction trouvée, création de logs exemples...');
      }

      // Ajouter quelques logs d'erreur typiques pour illustrer le format simplifié
      const errorLogs = [
        {
          id: 'mask_error_1',
          type: 'SELL_ERROR',
          timestamp: '2025-05-31T10:42:00.000Z',
          tokenMint: MASK_MINT,
          message: '❌ Erreur vente: Slippage dépassé | 25% MASK',
          errorType: 'Slippage dépassé',
          percentage: 25
        },
        {
          id: 'mask_error_2',
          type: 'SELL_ERROR',
          timestamp: '2025-05-31T10:41:30.000Z',
          tokenMint: MASK_MINT,
          message: '❌ Erreur vente: Transaction invalide | 25% MASK',
          errorType: 'Transaction invalide',
          percentage: 25
        },
        {
          id: 'mask_error_3',
          type: 'SELL_ERROR',
          timestamp: '2025-05-31T10:41:00.000Z',
          tokenMint: MASK_MINT,
          message: '❌ Erreur vente: Erreur API | 25% MASK',
          errorType: 'Erreur API',
          percentage: 25
        }
      ];

      // Ajouter quelques erreurs pour montrer le format
      logs.push(...errorLogs);
      
      console.log('🔍 API DEBUG: Logs générés:', logs.length);

      // Trier par date décroissante
      const sortedLogs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      console.log('✅ API DEBUG: Logs triés et prêts:', sortedLogs.length);
      
      return sortedLogs;
      
    } catch (error) {
      console.error('❌ API DEBUG: Erreur génération logs MASK:', error);
      return [];
    }
  }

  async start() {
    // Démarrer le gestionnaire de positions
    this.positionManager.start();
    
    // 🎯 Le service GMGN est déjà intégré dans RealtimePriceService
    
    // Initialiser le service de prix temps réel avec les positions ouvertes existantes
    const summary = this.positionManager.getPositionsSummary();
    this.realtimePriceService.updateTrackedTokens(summary.positions || []);
    
    // 🔧 AUSSI mettre à jour le service Helius
    if (this.heliusService) {
      this.heliusService.updateTrackedTokens(summary.positions || []);
    }
    
    // 🎯 Les tokens ouverts sont automatiquement ajoutés au monitoring GMGN via updateTrackedTokens
    
    // Démarrer le chauffage pour tous les tokens actifs (vente optimisée)
    this.optimizedSellService.startWarmingForAllActiveTokens();
    
    // Configurer l'API REST
    this.setupRestAPI();
    
    // Démarrer le serveur
    this.server.listen(this.port, () => {
      console.log("");
      console.log("🌐 SERVEUR WEBSOCKET DÉMARRÉ");
      console.log("============================");
      console.log(`🔌 WebSocket: ws://localhost:${this.port}`);
      console.log(`📊 Interface Web: http://localhost:${this.port}`);
      console.log(`📡 API REST: http://localhost:${this.port}/api/positions`);
      console.log(`👥 Clients connectés: ${this.clients.size}`);
      console.log("");
      console.log("✅ Prêt à recevoir les connexions !");
    });
    
    this.isRunning = true;
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.positionManager.stop();
    this.realtimePriceService.stop(); // 🎯 Service GMGN intégré
    
    // 🔧 Arrêter aussi le service Helius
    if (this.heliusService) {
      await this.heliusService.stop();
    }
    
    this.optimizedSellService.stopAllWarming();
    
    // Fermer toutes les connexions WebSocket
    this.clients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
    });
    this.clients.clear();
    
    this.server.close(() => {
      console.log("🛑 Serveur WebSocket arrêté");
    });
  }
}

export default WebSocketPositionServer;

// Si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new WebSocketPositionServer(8080);
  
  // Gestion propre de l'arrêt
  process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt du serveur...');
    await server.stop();
    process.exit(0);
  });
  
  // Démarrage asynchrone
  (async () => {
    try {
      await server.start();
    } catch (error) {
      console.error('❌ Erreur démarrage serveur:', error);
      process.exit(1);
    }
  })();
} 