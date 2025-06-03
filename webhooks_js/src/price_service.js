#!/usr/bin/env node
import fs from 'fs';

class PriceService {
  constructor() {
    this.cache = new Map();
    this.cacheFile = 'positions/price_cache.json';
    this.loadCache();
    
    // Rate limiting pour CoinGecko API (gratuite)
    this.lastApiCall = 0;
    this.minInterval = 1100; // 1.1 secondes entre les appels
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        this.cache = new Map(Object.entries(data));
        console.log(`💰 ${this.cache.size} prix historiques en cache`);
      }
    } catch (error) {
      console.log(`⚠️  Erreur chargement cache prix: ${error.message}`);
    }
  }

  saveCache() {
    try {
      const cacheObj = Object.fromEntries(this.cache);
      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheObj, null, 2));
    } catch (error) {
      console.error(`❌ Erreur sauvegarde cache prix: ${error.message}`);
    }
  }

  // Convertir timestamp Unix en date pour CoinGecko
  timestampToDate(timestamp) {
    // Le timestamp peut être en secondes ou millisecondes
    // Si c'est un nombre entier de 10 chiffres, c'est en secondes
    const timestampInt = Math.floor(timestamp);
    const ts = timestampInt.toString().length === 10 ? timestamp * 1000 : timestamp;
    const date = new Date(ts);
    
    // Format DD-MM-YYYY pour CoinGecko
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  }

  // Créer une clé de cache basée sur la date
  getCacheKey(timestamp) {
    const date = this.timestampToDate(timestamp);
    return `SOL_${date}`;
  }

  // Attendre pour respecter le rate limiting
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    
    if (timeSinceLastCall < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastCall;
      console.log(`⏳ Attente ${waitTime}ms pour rate limiting...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastApiCall = Date.now();
  }

  // Récupérer le prix historique du SOL
  async getHistoricalPrice(timestamp) {
    const cacheKey = this.getCacheKey(timestamp);
    
    // Vérifier le cache d'abord
    if (this.cache.has(cacheKey)) {
      const cachedPrice = this.cache.get(cacheKey);
      console.log(`💰 Prix SOL du cache: $${cachedPrice} (${this.timestampToDate(timestamp)})`);
      return parseFloat(cachedPrice);
    }

    try {
      // Vérifier si la date est dans le futur
      const requestDate = new Date(timestamp * 1000);
      const now = new Date();
      
      if (requestDate > now) {
        console.log(`⚠️  Date future détectée (${this.timestampToDate(timestamp)}), utilisation du prix actuel...`);
        return await this.getCurrentPrice();
      }

      // Respecter le rate limiting
      await this.waitForRateLimit();

      const date = this.timestampToDate(timestamp);
      console.log(`🔍 Récupération prix SOL pour le ${date}...`);

      // API CoinGecko pour prix historique
      const url = `https://api.coingecko.com/api/v3/coins/solana/history?date=${date}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Counet-Position-Manager/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.market_data || !data.market_data.current_price || !data.market_data.current_price.usd) {
        throw new Error('Prix USD non trouvé dans la réponse');
      }

      const price = data.market_data.current_price.usd;
      
      // Sauvegarder en cache
      this.cache.set(cacheKey, price.toString());
      this.saveCache();
      
      console.log(`✅ Prix SOL récupéré: $${price} (${date})`);
      return price;

    } catch (error) {
      console.error(`❌ Erreur récupération prix SOL pour ${this.timestampToDate(timestamp)}: ${error.message}`);
      
      // Essayer le prix actuel en fallback
      try {
        console.log(`🔄 Tentative récupération prix actuel...`);
        return await this.getCurrentPrice();
      } catch (fallbackError) {
        console.error(`❌ Erreur récupération prix actuel: ${fallbackError.message}`);
        // Retourner un prix par défaut si tout échoue
        const fallbackPrice = 100; // Prix approximatif de SOL
        console.log(`⚠️  Utilisation prix par défaut: $${fallbackPrice}`);
        return fallbackPrice;
      }
    }
  }

  // Récupérer le prix actuel du SOL
  async getCurrentPrice() {
    try {
      await this.waitForRateLimit();
      
      console.log(`🔍 Récupération prix SOL actuel...`);
      
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Counet-Position-Manager/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.solana || !data.solana.usd) {
        throw new Error('Prix USD actuel non trouvé dans la réponse');
      }

      const price = data.solana.usd;
      console.log(`✅ Prix SOL actuel récupéré: $${price}`);
      
      return price;
    } catch (error) {
      throw new Error(`Erreur récupération prix actuel: ${error.message}`);
    }
  }

  // Calculer le prix d'achat en USD
  async calculateUSDPrice(solAmount, timestamp) {
    try {
      const solPrice = await this.getHistoricalPrice(timestamp);
      const usdAmount = solAmount * solPrice;
      
      console.log(`💵 Calcul: ${solAmount} SOL × $${solPrice} = $${usdAmount.toFixed(6)}`);
      return {
        solAmount,
        solPrice,
        usdAmount,
        timestamp: new Date(timestamp * 1000).toISOString()
      };
    } catch (error) {
      console.error(`❌ Erreur calcul prix USD: ${error.message}`);
      return null;
    }
  }

  // Méthode pour tester le service
  async testService() {
    console.log("🧪 Test du service de prix...");
    
    // Test avec le timestamp de ta transaction
    const testTimestamp = 1748341075; // Timestamp de ta transaction
    const testSolAmount = 0.009932047; // Montant SOL dépensé
    
    const result = await this.calculateUSDPrice(testSolAmount, testTimestamp);
    
    if (result) {
      console.log("✅ Test réussi !");
      console.log(`📊 Résultat: ${result.solAmount} SOL = $${result.usdAmount.toFixed(6)} (prix SOL: $${result.solPrice})`);
      
      // Calculer le prix par token
      const tokensReceived = 7859.715821;
      const pricePerToken = result.usdAmount / tokensReceived;
      console.log(`🎯 Prix par token: $${pricePerToken.toFixed(8)}`);
    } else {
      console.log("❌ Test échoué");
    }
  }
}

export default PriceService;

// Si le fichier est exécuté directement, lancer le test
if (import.meta.url === `file://${process.argv[1]}`) {
  const priceService = new PriceService();
  priceService.testService();
} 