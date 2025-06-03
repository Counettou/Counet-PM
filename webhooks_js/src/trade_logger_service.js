#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * 📊 Service de Logging des Trades
 * 
 * Trace toutes les activités de trading avec métriques détaillées :
 * - Achats automatiques (webhooks)
 * - Ventes manuelles (boutons interface)
 * - Performances, timing, erreurs
 * - Historique consultable
 */
class TradeLoggerService {
    constructor() {
        this.logsDir = 'logs/trades';
        this.ensureDirectories();
        
        // Fichiers de logs
        this.dailyLogFile = this.getDailyLogFile();
        this.summaryFile = path.join(this.logsDir, 'trade_summary.json');
        this.performanceFile = path.join(this.logsDir, 'performance_history.json');
        
        // Cache en mémoire pour éviter trop d'I/O
        this.todayLogs = this.loadTodayLogs();
        this.summary = this.loadSummary();
        
        // Prix SOL par défaut (sera mis à jour dynamiquement)
        this.currentSolPrice = 156.51;
    }

    /**
     * Mettre à jour le prix SOL actuel pour les calculs USD
     */
    updateSolPrice(price) {
        this.currentSolPrice = price;
    }

    ensureDirectories() {
        const dirs = [this.logsDir, path.join(this.logsDir, 'daily'), path.join(this.logsDir, 'exports')];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    getDailyLogFile() {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return path.join(this.logsDir, 'daily', `trades_${today}.json`);
    }

    loadTodayLogs() {
        try {
            if (fs.existsSync(this.dailyLogFile)) {
                return JSON.parse(fs.readFileSync(this.dailyLogFile, 'utf8'));
            }
        } catch (error) {
            console.error('❌ Erreur chargement logs du jour:', error.message);
        }
        return [];
    }

    loadSummary() {
        try {
            if (fs.existsSync(this.summaryFile)) {
                return JSON.parse(fs.readFileSync(this.summaryFile, 'utf8'));
            }
        } catch (error) {
            console.error('❌ Erreur chargement résumé:', error.message);
        }
        return {
            totalTrades: 0,
            totalVolume: 0,
            totalPnL: 0,
            successRate: 100,
            averageExecutionTime: 0,
            byToken: {},
            byPlatform: {},
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * 📈 Logger un achat automatique (webhook)
     */
    logBuy(buyData) {
        const logEntry = {
            id: this.generateLogId(),
            type: 'BUY',
            timestamp: new Date().toISOString(),
            
            // Informations token
            tokenMint: buyData.tokenMint,
            tokenSymbol: buyData.tokenSymbol || 'Unknown',
            tokenName: buyData.tokenName || '',
            
            // Détails transaction
            signature: buyData.signature,
            solAmount: buyData.solAmount,
            tokenAmount: buyData.tokenAmount,
            pricePerToken: buyData.pricePerToken,
            pricePerTokenUSD: buyData.pricePerTokenUSD || null,
            
            // Contexte
            platform: buyData.platform || 'Unknown',
            source: 'WEBHOOK_AUTO',
            
            // Métriques
            solPriceAtTime: buyData.solPriceAtTime,
            isNewPosition: buyData.isNewPosition || false,
            totalPositionSize: buyData.totalPositionSize || buyData.tokenAmount,
            
            // Extras
            explorerUrl: `https://solscan.io/tx/${buyData.signature}`,
            notes: buyData.notes || ''
        };

        this.addLogEntry(logEntry);
        this.updateSummary(logEntry);
        
        // FORMAT SIMPLIFIÉ POUR ACHATS
        const tokenSymbol = buyData.tokenSymbol || 'Token';
        const usdAmount = buyData.usdAmount || (buyData.solAmount * this.currentSolPrice);
        console.log(`✅ Achat: ${buyData.tokenAmount.toFixed(2)} à ${buyData.pricePerToken.toFixed(6)} SOL → Investi: ${buyData.solAmount.toFixed(3)} SOL ($${usdAmount.toFixed(2)})`);
        return logEntry.id;
    }

    /**
     * 📉 Logger une vente manuelle (interface)
     */
    logSell(sellData) {
        const startTime = Date.now();
        
        const logEntry = {
            id: this.generateLogId(),
            type: 'SELL',
            timestamp: new Date().toISOString(),
            
            // Informations token
            tokenMint: sellData.tokenMint,
            tokenSymbol: sellData.tokenSymbol || 'Unknown',
            tokenName: sellData.tokenName || '',
            
            // Détails vente
            signature: sellData.signature || null,
            percentage: sellData.percentage,
            tokensSold: sellData.tokensSold,
            solReceived: sellData.solReceived,
            pricePerToken: sellData.pricePerToken,
            pricePerTokenUSD: sellData.pricePerTokenUSD || null,
            
            // Performance de cette vente spécifique
            buyPrice: sellData.buyPrice,
            sellPrice: sellData.pricePerToken,
            sellPerformance: sellData.sellPerformance || this.calculateSellPerformance(sellData.buyPrice, sellData.pricePerToken),
            
            // Timing et métriques
            executionTime: sellData.executionTime || null,
            timings: sellData.timings || {},
            slippage: sellData.slippage || null,
            
            // Contexte
            platform: sellData.platform || 'Unknown',
            source: 'MANUAL_UI',
            retryAttempt: sellData.retryAttempt || 0,
            success: sellData.success !== false, // Par défaut true sauf si explicitement false
            
            // Position restante
            remainingTokens: sellData.remainingTokens || 0,
            positionClosed: sellData.remainingTokens <= 0.000001,
            
            // Erreurs
            errors: sellData.errors || [],
            
            // Extras
            explorerUrl: sellData.signature ? `https://solscan.io/tx/${sellData.signature}` : null,
            notes: sellData.notes || ''
        };

        this.addLogEntry(logEntry);
        this.updateSummary(logEntry);
        
        // FORMAT SIMPLIFIÉ AVEC TIMING
        const tokenSymbol = sellData.tokenSymbol || 'Token';
        const performance = logEntry.sellPerformance;
        const timing = sellData.executionTime ? ` (${(sellData.executionTime/1000).toFixed(1)}s)` : '';
        
        if (sellData.percentage && sellData.percentage < 100) {
            // Vente partielle
            console.log(`📉 Vente ${sellData.percentage}%: ${sellData.tokensSold.toFixed(2)} à ${sellData.pricePerToken.toFixed(6)} SOL → Reçu: ${sellData.solReceived.toFixed(3)} SOL ($${(sellData.solReceived * this.currentSolPrice).toFixed(2)})${timing}`);
        } else {
            // Vente complète avec performance
            const perfStr = performance !== undefined && performance !== null ? 
                (performance > 0 ? ` | +${performance.toFixed(0)}%` : ` | ${performance.toFixed(0)}%`) : '';
            console.log(`💰 Vente: ${sellData.tokensSold.toFixed(2)} à ${sellData.pricePerToken.toFixed(6)} SOL → Reçu: ${sellData.solReceived.toFixed(3)} SOL ($${(sellData.solReceived * this.currentSolPrice).toFixed(2)})${perfStr}${timing}`);
        }
        
        return logEntry.id;
    }

    /**
     * ⚠️ Logger une erreur de vente
     */
    logSellError(errorData) {
        const logEntry = {
            id: this.generateLogId(),
            type: 'SELL_ERROR',
            timestamp: new Date().toISOString(),
            
            // Informations token
            tokenMint: errorData.tokenMint,
            tokenSymbol: errorData.tokenSymbol || 'Unknown',
            
            // Détails erreur
            percentage: errorData.percentage,
            errorMessage: errorData.errorMessage,
            errorType: errorData.errorType || 'UNKNOWN',
            retryAttempt: errorData.retryAttempt || 0,
            
            // Timing
            executionTime: errorData.executionTime || null,
            
            // Contexte
            source: 'MANUAL_UI',
            platform: errorData.platform || 'Unknown',
            
            // Stack trace si disponible
            stackTrace: errorData.stackTrace || null,
            
            notes: errorData.notes || ''
        };

        this.addLogEntry(logEntry);
        this.updateSummary(logEntry);
        
        // FORMAT SIMPLIFIÉ POUR ERREURS
        const tokenSymbol = errorData.tokenSymbol || 'Token';
        const percentage = errorData.percentage ? `${errorData.percentage}% ` : '';
        const errorSimple = this.simplifyErrorMessage(errorData.errorMessage);
        
        console.log(`❌ Erreur vente: ${errorSimple} | ${percentage}`);
        return logEntry.id;
    }

    /**
     * Simplifier les messages d'erreur pour l'affichage
     */
    simplifyErrorMessage(errorMessage) {
        if (!errorMessage) return 'Erreur inconnue';
        
        const message = errorMessage.toLowerCase();
        
        if (message.includes('0x1771') || message.includes('slippage')) return 'Slippage dépassé';
        if (message.includes('insufficient') || message.includes('balance')) return 'Solde insuffisant';
        if (message.includes('rate limit') || message.includes('429')) return 'API temporairement surchargée';
        if (message.includes('jupiter') || message.includes('quote')) return 'Service Jupiter indisponible';
        if (message.includes('block height') || message.includes('blockhash')) return 'Transaction expirée';
        if (message.includes('simulation')) return 'Simulation échouée';
        if (message.includes('timeout')) return 'Délai dépassé';
        if (message.includes('network') || message.includes('connection')) return 'Erreur réseau';
        if (message.includes('private_key')) return 'Configuration serveur manquante';
        
        return 'Erreur soumission transaction';
    }

    calculateSellPerformance(buyPrice, sellPrice) {
        if (!buyPrice || !sellPrice) return 0;
        return ((sellPrice - buyPrice) / buyPrice) * 100;
    }

    addLogEntry(logEntry) {
        // Ajouter au cache du jour
        this.todayLogs.push(logEntry);
        
        // Sauvegarder immédiatement
        this.saveTodayLogs();
        
        // Sauvegarder aussi dans un fichier global
        this.appendToGlobalLog(logEntry);
    }

    saveTodayLogs() {
        try {
            fs.writeFileSync(this.dailyLogFile, JSON.stringify(this.todayLogs, null, 2));
        } catch (error) {
            console.error('❌ Erreur sauvegarde logs du jour:', error.message);
        }
    }

    appendToGlobalLog(logEntry) {
        try {
            const globalLogFile = path.join(this.logsDir, 'all_trades.jsonl');
            const logLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(globalLogFile, logLine);
        } catch (error) {
            console.error('❌ Erreur ajout log global:', error.message);
        }
    }

    updateSummary(logEntry) {
        this.summary.totalTrades++;
        this.summary.lastUpdated = new Date().toISOString();
        
        if (logEntry.type === 'BUY') {
            this.summary.totalVolume += logEntry.solAmount || 0;
        } else if (logEntry.type === 'SELL') {
            this.summary.totalVolume += logEntry.solReceived || 0;
            
            if (logEntry.sellPerformance !== undefined) {
                // Calculer PnL de cette vente spécifique
                const sellPnL = ((logEntry.solReceived || 0) - (logEntry.tokensSold * logEntry.buyPrice));
                this.summary.totalPnL += sellPnL;
            }
            
            // Mettre à jour temps d'exécution moyen
            if (logEntry.executionTime) {
                const currentAvg = this.summary.averageExecutionTime || 0;
                const sellCount = this.summary.sellCount || 0;
                this.summary.averageExecutionTime = (currentAvg * sellCount + logEntry.executionTime) / (sellCount + 1);
                this.summary.sellCount = sellCount + 1;
            }
        }
        
        // Statistiques par token
        const token = logEntry.tokenSymbol || logEntry.tokenMint;
        if (!this.summary.byToken[token]) {
            this.summary.byToken[token] = { trades: 0, volume: 0, pnl: 0 };
        }
        this.summary.byToken[token].trades++;
        this.summary.byToken[token].volume += logEntry.solAmount || logEntry.solReceived || 0;
        
        // Statistiques par plateforme
        const platform = logEntry.platform || 'Unknown';
        if (!this.summary.byPlatform[platform]) {
            this.summary.byPlatform[platform] = { trades: 0, volume: 0 };
        }
        this.summary.byPlatform[platform].trades++;
        this.summary.byPlatform[platform].volume += logEntry.solAmount || logEntry.solReceived || 0;
        
        // Sauvegarder résumé
        this.saveSummary();
    }

    saveSummary() {
        try {
            fs.writeFileSync(this.summaryFile, JSON.stringify(this.summary, null, 2));
        } catch (error) {
            console.error('❌ Erreur sauvegarde résumé:', error.message);
        }
    }

    generateLogId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${timestamp}_${random}`;
    }

    /**
     * 📊 Obtenir les logs d'aujourd'hui
     */
    getTodayLogs() {
        return [...this.todayLogs];
    }

    /**
     * 📅 Obtenir les logs d'une date spécifique
     */
    getLogsByDate(date) {
        try {
            const dateFile = path.join(this.logsDir, 'daily', `trades_${date}.json`);
            if (fs.existsSync(dateFile)) {
                return JSON.parse(fs.readFileSync(dateFile, 'utf8'));
            }
        } catch (error) {
            console.error(`❌ Erreur chargement logs ${date}:`, error.message);
        }
        return [];
    }

    /**
     * 🔍 Obtenir les logs d'un token spécifique
     */
    getLogsByToken(tokenMint, limit = 100) {
        const allLogs = [];
        
        // Parcourir les fichiers quotidiens récents
        const now = new Date();
        for (let i = 0; i < 30; i++) { // 30 derniers jours
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            const dayLogs = this.getLogsByDate(dateStr);
            
            const tokenLogs = dayLogs.filter(log => log.tokenMint === tokenMint);
            allLogs.push(...tokenLogs);
        }
        
        return allLogs
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * 📈 Statistiques générales
     */
    getStats() {
        return {
            ...this.summary,
            todayTrades: this.todayLogs.length,
            todayVolume: this.todayLogs.reduce((sum, log) => sum + (log.solAmount || log.solReceived || 0), 0)
        };
    }

    /**
     * 📊 Rapport de performance détaillé
     */
    getPerformanceReport(days = 7) {
        const report = {
            period: `${days} derniers jours`,
            trades: [],
            summary: {
                totalTrades: 0,
                successfulSells: 0,
                failedSells: 0,
                averageExecutionTime: 0,
                totalVolume: 0,
                totalPnL: 0,
                winRate: 0
            }
        };
        
        // Collecter logs des X derniers jours
        const now = new Date();
        for (let i = 0; i < days; i++) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            const dayLogs = this.getLogsByDate(dateStr);
            report.trades.push(...dayLogs);
        }
        
        // Calculer statistiques
        report.summary.totalTrades = report.trades.length;
        report.summary.successfulSells = report.trades.filter(t => t.type === 'SELL' && t.success).length;
        report.summary.failedSells = report.trades.filter(t => t.type === 'SELL_ERROR' || (t.type === 'SELL' && !t.success)).length;
        
        const sellTrades = report.trades.filter(t => t.type === 'SELL' && t.executionTime);
        if (sellTrades.length > 0) {
            report.summary.averageExecutionTime = sellTrades.reduce((sum, t) => sum + t.executionTime, 0) / sellTrades.length;
        }
        
        report.summary.totalVolume = report.trades.reduce((sum, t) => sum + (t.solAmount || t.solReceived || 0), 0);
        
        const winTrades = report.trades.filter(t => t.type === 'SELL' && t.sellPerformance > 0);
        report.summary.winRate = report.summary.successfulSells > 0 ? (winTrades.length / report.summary.successfulSells) * 100 : 0;
        
        return report;
    }

    /**
     * 📤 Exporter les logs au format CSV
     */
    exportToCSV(days = 30) {
        const now = new Date();
        const allLogs = [];
        
        // Collecter logs
        for (let i = 0; i < days; i++) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            const dayLogs = this.getLogsByDate(dateStr);
            allLogs.push(...dayLogs);
        }
        
        // En-têtes CSV
        const headers = [
            'Date/Heure', 'Type', 'Token', 'Signature', 'SOL Amount', 'Token Amount', 
            'Prix/Token', 'Pourcentage', 'Performance%', 'Temps Exécution (ms)', 
            'Plateforme', 'Succès', 'Erreurs'
        ];
        
        // Données CSV
        const csvData = allLogs.map(log => [
            log.timestamp,
            log.type,
            log.tokenSymbol,
            log.signature || '',
            log.solAmount || log.solReceived || '',
            log.tokenAmount || log.tokensSold || '',
            log.pricePerToken || '',
            log.percentage || '',
            log.sellPerformance || '',
            log.executionTime || '',
            log.platform,
            log.success !== false ? 'Oui' : 'Non',
            log.errors ? log.errors.join('; ') : ''
        ]);
        
        // Générer CSV
        const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
        
        // Sauvegarder
        const exportFile = path.join(this.logsDir, 'exports', `trades_export_${now.toISOString().split('T')[0]}.csv`);
        fs.writeFileSync(exportFile, csvContent);
        
        return exportFile;
    }
}

export default TradeLoggerService; 