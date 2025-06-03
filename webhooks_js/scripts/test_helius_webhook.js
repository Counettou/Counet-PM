#!/usr/bin/env node

console.log("🧪 TEST WEBHOOK HELIUS DIRECT");
console.log("==============================");

// Simuler exactement ce que Helius envoie
const heliusWebhookData = [
  {
    "signature": `helius_test_${Date.now()}`,
    "type": "SWAP",
    "feePayer": "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB",
    "fee": 5000,
    "slot": 342768050,
    "timestamp": Math.floor(Date.now() / 1000),
    "tokenTransfers": [
      {
        "mint": "So11111111111111111111111111111111111111112", // SOL
        "tokenAmount": 1000000,
        "fromUserAccount": "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB",
        "toUserAccount": "11111111111111111111111111111111"
      }
    ],
    "nativeTransfers": [
      {
        "fromUserAccount": "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB",
        "toUserAccount": "11111111111111111111111111111111",
        "amount": 5000000 // 0.005 SOL
      }
    ],
    "accountData": [
      {
        "account": "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB",
        "nativeBalanceChange": -5000000
      }
    ]
  }
];

console.log("📡 Envoi du webhook de test vers le serveur local...");

try {
  const response = await fetch('http://localhost:8080/helius-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Helius/1.0'
    },
    body: JSON.stringify(heliusWebhookData)
  });

  if (response.ok) {
    const result = await response.json();
    console.log("✅ Webhook reçu et traité avec succès !");
    console.log("📊 Réponse du serveur:", result);
    
    // Vérifier que la transaction a été sauvée
    console.log("\n🔍 Vérification de la sauvegarde...");
    
    setTimeout(async () => {
      try {
        const positionsResponse = await fetch('http://localhost:8080/api/positions');
        const positions = await positionsResponse.json();
        
        console.log("📊 Positions mises à jour:");
        console.log(`   - Positions ouvertes: ${positions.openPositions}`);
        console.log(`   - Total investi: ${positions.totalInvested} SOL`);
        console.log(`   - Transactions récentes: ${positions.recentTransactions.length}`);
        
        if (positions.recentTransactions.length > 0) {
          const lastTx = positions.recentTransactions[0];
          console.log(`   - Dernière transaction: ${lastTx.analysis?.type || 'N/A'}`);
        }
        
      } catch (error) {
        console.log("❌ Erreur vérification:", error.message);
      }
    }, 1000);
    
  } else {
    console.log("❌ Erreur HTTP:", response.status, response.statusText);
  }
  
} catch (error) {
  console.log("❌ Erreur connexion:", error.message);
}

console.log("\n💡 Si ce test fonctionne, votre système est opérationnel !");
console.log("💡 Le problème de 'fetch failed' sur le tunnel peut être normal");
console.log("💡 Testez maintenant le bouton 'Send Test Webhook' sur Helius"); 