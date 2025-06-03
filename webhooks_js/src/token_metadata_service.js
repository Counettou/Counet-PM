#!/usr/bin/env node
import fs from 'fs';

class TokenMetadataService {
  constructor() {
    this.cache = new Map();
    this.cacheFile = 'positions/token_metadata_cache.json';
    this.loadCache();
    
    // Rate limiting
    this.lastApiCall = 0;
    this.minInterval = 1100; // 1.1 secondes entre les appels
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        this.cache = new Map(Object.entries(data));
        console.log(`📋 ${this.cache.size} métadonnées de tokens en cache`);
      }
    } catch (error) {
      console.log(`⚠️  Erreur chargement cache métadonnées: ${error.message}`);
    }
  }

  saveCache() {
    try {
      const cacheObj = Object.fromEntries(this.cache);
      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheObj, null, 2));
    } catch (error) {
      console.error(`❌ Erreur sauvegarde cache métadonnées: ${error.message}`);
    }
  }

  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    
    if (timeSinceLastCall < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastApiCall = Date.now();
  }

  // Méthode principale pour récupérer les métadonnées
  async getTokenMetadata(mintAddress) {
    // Vérifier le cache d'abord
    if (this.cache.has(mintAddress)) {
      const cached = this.cache.get(mintAddress);
      console.log(`📋 Métadonnées du cache: ${cached.name || cached.symbol || 'Inconnu'}`);
      return cached;
    }

    console.log(`🔍 Récupération métadonnées pour: ${mintAddress.substring(0, 8)}...`);

    // Essayer plusieurs sources dans l'ordre de fiabilité
    const sources = [
      () => this.fetchFromDexScreener(mintAddress),
      () => this.fetchFromJupiter(mintAddress),
      () => this.fetchFromSolscan(mintAddress),
      () => this.fetchFromCoinGecko(mintAddress)
    ];

    for (const fetchMethod of sources) {
      try {
        await this.waitForRateLimit();
        const metadata = await fetchMethod();
        
        if (metadata && (metadata.name || metadata.symbol)) {
          console.log(`✅ Métadonnées trouvées: ${metadata.name || metadata.symbol}`);
          
          // Sauvegarder en cache
          this.cache.set(mintAddress, metadata);
          this.saveCache();
          
          return metadata;
        }
      } catch (error) {
        console.log(`⚠️  Erreur source: ${error.message}`);
        continue;
      }
    }

    // Si aucune source n'a fonctionné, créer un objet par défaut
    const defaultMetadata = {
      mint: mintAddress,
      name: null,
      symbol: null,
      decimals: null,
      source: 'unknown',
      lastUpdated: new Date().toISOString()
    };

    this.cache.set(mintAddress, defaultMetadata);
    this.saveCache();
    
    console.log(`❌ Aucune métadonnée trouvée pour ${mintAddress.substring(0, 8)}...`);
    return defaultMetadata;
  }

  // Source 1: DexScreener (la plus fiable pour les tokens de trading)
  async fetchFromDexScreener(mintAddress) {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Counet-Position-Manager/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`DexScreener HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      const token = pair.baseToken.address === mintAddress ? pair.baseToken : pair.quoteToken;
      
      return {
        mint: mintAddress,
        name: token.name,
        symbol: token.symbol,
        decimals: null,
        source: 'dexscreener',
        lastUpdated: new Date().toISOString(),
        extra: {
          priceUsd: pair.priceUsd,
          liquidity: pair.liquidity?.usd,
          volume24h: pair.volume?.h24,
          dexId: pair.dexId
        }
      };
    }

    throw new Error('Token non trouvé sur DexScreener');
  }

  // Source 2: Jupiter Token List
  async fetchFromJupiter(mintAddress) {
    const url = 'https://token.jup.ag/strict';
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Counet-Position-Manager/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Jupiter HTTP ${response.status}`);
    }

    const tokens = await response.json();
    const token = tokens.find(t => t.address === mintAddress);
    
    if (token) {
      return {
        mint: mintAddress,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        source: 'jupiter',
        lastUpdated: new Date().toISOString(),
        extra: {
          logoURI: token.logoURI,
          tags: token.tags
        }
      };
    }

    throw new Error('Token non trouvé sur Jupiter');
  }

  // Source 3: Solscan
  async fetchFromSolscan(mintAddress) {
    const url = `https://public-api.solscan.io/token/meta?tokenAddress=${mintAddress}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Counet-Position-Manager/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Solscan HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.name || data.symbol) {
      return {
        mint: mintAddress,
        name: data.name,
        symbol: data.symbol,
        decimals: data.decimals,
        source: 'solscan',
        lastUpdated: new Date().toISOString(),
        extra: {
          supply: data.supply,
          holder: data.holder
        }
      };
    }

    throw new Error('Token non trouvé sur Solscan');
  }

  // Source 4: CoinGecko (pour les tokens majeurs)
  async fetchFromCoinGecko(mintAddress) {
    const url = `https://api.coingecko.com/api/v3/coins/solana/contract/${mintAddress}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Counet-Position-Manager/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.name || data.symbol) {
      return {
        mint: mintAddress,
        name: data.name,
        symbol: data.symbol?.toUpperCase(),
        decimals: null,
        source: 'coingecko',
        lastUpdated: new Date().toISOString(),
        extra: {
          marketCap: data.market_data?.market_cap?.usd,
          currentPrice: data.market_data?.current_price?.usd,
          description: data.description?.en?.substring(0, 200)
        }
      };
    }

    throw new Error('Token non trouvé sur CoinGecko');
  }

  // Méthode pour enrichir une position avec les métadonnées
  async enrichPosition(position) {
    try {
      const metadata = await this.getTokenMetadata(position.mint);
      
      return {
        ...position,
        tokenName: metadata.name,
        tokenSymbol: metadata.symbol,
        tokenDecimals: metadata.decimals,
        metadataSource: metadata.source,
        metadataExtra: metadata.extra
      };
    } catch (error) {
      console.error(`❌ Erreur enrichissement position ${position.mint}:`, error.message);
      return {
        ...position,
        tokenName: null,
        tokenSymbol: null,
        tokenDecimals: null,
        metadataSource: 'error'
      };
    }
  }

  // Méthode pour tester le service
  async testService() {
    console.log("🧪 TEST DU SERVICE DE MÉTADONNÉES");
    console.log("=================================");
    
    const testTokens = [
      "3FcnniRLtrW2kKSBoRBNofUUeM75EtNVMFVr24RDpump", // Token CUM
      "So11111111111111111111111111111111111111112",     // SOL
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"      // USDC
    ];

    for (const mint of testTokens) {
      console.log(`\n🔍 Test pour: ${mint.substring(0, 8)}...`);
      const metadata = await this.getTokenMetadata(mint);
      console.log("📊 Résultat:", {
        name: metadata.name,
        symbol: metadata.symbol,
        source: metadata.source
      });
    }
  }
}

export default TokenMetadataService;

// Test si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new TokenMetadataService();
  await service.testService();
} 