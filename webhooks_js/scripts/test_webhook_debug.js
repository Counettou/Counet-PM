#!/usr/bin/env node

console.log("🔧 DIAGNOSTIC WEBHOOK HELIUS");
console.log("============================");

// Test 1: Vérifier l'accès local
console.log("\n1️⃣ Test serveur local...");
try {
  const response = await fetch('http://localhost:8080/api/health');
  if (response.ok) {
    const data = await response.json();
    console.log("✅ Serveur local accessible");
    console.log("📊 Statut:", data.status);
  } else {
    console.log("❌ Serveur local non accessible");
  }
} catch (error) {
  console.log("❌ Erreur serveur local:", error.message);
}

// Test 2: Vérifier l'accès via tunnel
console.log("\n2️⃣ Test tunnel Cloudflare...");
try {
  const response = await fetch('https://0af91ac9-5f76-49c1-893e-acdb55bc223e.cfargotunnel.com/api/health');
  if (response.ok) {
    const data = await response.json();
    console.log("✅ Tunnel Cloudflare accessible");
    console.log("📊 Statut:", data.status);
  } else {
    console.log("❌ Tunnel Cloudflare non accessible");
    console.log("📊 Code:", response.status);
  }
} catch (error) {
  console.log("❌ Erreur tunnel:", error.message);
}

// Test 3: Test webhook local
console.log("\n3️⃣ Test webhook local...");
try {
  const testData = [{
    signature: `test_local_${Date.now()}`,
    type: "SWAP",
    feePayer: "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB",
    fee: 5000,
    slot: 123456,
    tokenTransfers: [{
      mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      tokenAmount: 1000000,
      fromUserAccount: "11111111111111111111111111111111",
      toUserAccount: "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB"
    }],
    nativeTransfers: [{
      fromUserAccount: "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB",
      toUserAccount: "11111111111111111111111111111111",
      amount: 100000000
    }]
  }];

  const response = await fetch('http://localhost:8080/helius-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });

  if (response.ok) {
    const result = await response.json();
    console.log("✅ Webhook local fonctionne");
    console.log("📊 Réponse:", result);
  } else {
    console.log("❌ Webhook local échoué");
  }
} catch (error) {
  console.log("❌ Erreur webhook local:", error.message);
}

// Test 4: Test webhook via tunnel
console.log("\n4️⃣ Test webhook via tunnel...");
try {
  const testData = [{
    signature: `test_tunnel_${Date.now()}`,
    type: "SWAP",
    feePayer: "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB",
    fee: 5000,
    slot: 123456,
    tokenTransfers: [{
      mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      tokenAmount: 1000000,
      fromUserAccount: "11111111111111111111111111111111",
      toUserAccount: "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB"
    }],
    nativeTransfers: [{
      fromUserAccount: "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB",
      toUserAccount: "11111111111111111111111111111111",
      amount: 100000000
    }]
  }];

  const response = await fetch('https://0af91ac9-5f76-49c1-893e-acdb55bc223e.cfargotunnel.com/helius-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });

  if (response.ok) {
    const result = await response.json();
    console.log("✅ Webhook via tunnel fonctionne");
    console.log("📊 Réponse:", result);
  } else {
    console.log("❌ Webhook via tunnel échoué");
    console.log("📊 Code:", response.status);
  }
} catch (error) {
  console.log("❌ Erreur webhook tunnel:", error.message);
}

console.log("\n🎯 RÉSUMÉ");
console.log("=========");
console.log("Si tous les tests sont ✅, le problème vient de Helius");
console.log("Si le tunnel échoue, le problème vient de Cloudflare");
console.log("Si le serveur local échoue, le problème vient du serveur"); 