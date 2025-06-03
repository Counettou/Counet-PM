#!/bin/bash

echo "🧪 TEST DU TUNNEL CLOUDFLARE"
echo "============================"

TUNNEL_URL="https://0af91ac9-5f76-49c1-893e-acdb55bc223e.cfargotunnel.com"
WEBHOOK_URL="$TUNNEL_URL/helius-webhook"

echo "🌐 URL du tunnel: $TUNNEL_URL"
echo "📡 URL webhook: $WEBHOOK_URL"
echo ""

# Test 1: Vérifier que le tunnel répond
echo "🔍 Test 1: Vérification de l'accès au tunnel..."
response=$(curl -s -w "%{http_code}" -o /tmp/tunnel_test "$TUNNEL_URL" 2>/dev/null)

if [ "$response" = "200" ]; then
    echo "✅ Tunnel accessible (HTTP $response)"
else
    echo "❌ Tunnel non accessible (HTTP $response)"
    echo "💡 Vérifiez que le tunnel est démarré avec: npm run start-tunnel"
    exit 1
fi

# Test 2: Vérifier l'API health
echo ""
echo "🔍 Test 2: Vérification de l'API health..."
health_response=$(curl -s "$TUNNEL_URL/api/health" 2>/dev/null)

if echo "$health_response" | grep -q "healthy"; then
    echo "✅ API health opérationnelle"
    echo "📊 Réponse: $health_response"
else
    echo "❌ API health non accessible"
    echo "💡 Vérifiez que le serveur local est démarré"
fi

# Test 3: Test du webhook avec données simulées
echo ""
echo "🔍 Test 3: Test du webhook avec transaction simulée..."

test_transaction='{
  "signature": "test_tunnel_' $(date +%s) '",
  "type": "SWAP",
  "feePayer": "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB",
  "fee": 5000,
  "slot": 123456,
  "tokenTransfers": [{
    "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "tokenAmount": 1000000,
    "fromUserAccount": "11111111111111111111111111111111",
    "toUserAccount": "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB"
  }],
  "nativeTransfers": [{
    "fromUserAccount": "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB",
    "toUserAccount": "11111111111111111111111111111111",
    "amount": 100000000
  }]
}'

webhook_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$test_transaction" \
  "$WEBHOOK_URL" 2>/dev/null)

if echo "$webhook_response" | grep -q "success"; then
    echo "✅ Webhook opérationnel"
    echo "📊 Réponse: $webhook_response"
else
    echo "❌ Webhook non opérationnel"
    echo "📊 Réponse: $webhook_response"
fi

# Test 4: Vérifier les positions après le test
echo ""
echo "🔍 Test 4: Vérification des positions après test..."
positions_response=$(curl -s "$TUNNEL_URL/api/positions" 2>/dev/null)

if echo "$positions_response" | grep -q "positions"; then
    echo "✅ API positions opérationnelle"
    # Extraire le nombre de positions
    open_positions=$(echo "$positions_response" | grep -o '"openPositions":[0-9]*' | cut -d':' -f2)
    total_transactions=$(echo "$positions_response" | grep -o '"recentTransactions":\[[^]]*\]' | grep -o ',' | wc -l)
    echo "📊 Positions ouvertes: $open_positions"
    echo "📊 Transactions récentes: $((total_transactions + 1))"
else
    echo "❌ API positions non accessible"
fi

echo ""
echo "🎉 TESTS TERMINÉS"
echo "================"
echo ""
echo "🌐 Interface web publique: $TUNNEL_URL"
echo "📡 URL webhook pour Helius: $WEBHOOK_URL"
echo ""
echo "💡 Si tous les tests sont ✅, vous pouvez configurer Helius avec l'URL webhook ci-dessus" 