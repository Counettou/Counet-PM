#!/usr/bin/env node

console.log("🌐 CONFIGURATION DOMAINE PERSONNALISÉ COUNET.UK");
console.log("===============================================");

const TUNNEL_ID = "0af91ac9-5f76-49c1-893e-acdb55bc223e";
const CUSTOM_DOMAIN = "webhook.counet.uk";
const TUNNEL_TARGET = `${TUNNEL_ID}.cfargotunnel.com`;

console.log(`🎯 Domaine personnalisé: ${CUSTOM_DOMAIN}`);
console.log(`🌉 Tunnel cible: ${TUNNEL_TARGET}`);
console.log("");

console.log("📋 ÉTAPES À SUIVRE MANUELLEMENT :");
console.log("=================================");
console.log("");
console.log("1️⃣ **Connectez-vous au dashboard Cloudflare**");
console.log("   https://dash.cloudflare.com");
console.log("");
console.log("2️⃣ **Sélectionnez votre zone 'counet.uk'**");
console.log("");
console.log("3️⃣ **Allez dans DNS > Records**");
console.log("");
console.log("4️⃣ **Cliquez sur 'Add record'**");
console.log("");
console.log("5️⃣ **Créez un enregistrement CNAME :**");
console.log("   - Type: CNAME");
console.log(`   - Name: webhook`);
console.log(`   - Target: ${TUNNEL_TARGET}`);
console.log("   - Proxy status: Proxied (orange cloud)");
console.log("");
console.log("6️⃣ **Cliquez sur 'Save'**");
console.log("");

console.log("🔧 APRÈS AVOIR CRÉÉ L'ENREGISTREMENT DNS :");
console.log("==========================================");
console.log("");
console.log("✅ Votre nouvelle URL webhook sera :");
console.log(`   https://${CUSTOM_DOMAIN}/helius-webhook`);
console.log("");
console.log("✅ Cette URL sera accessible en IPv4 ET IPv6");
console.log("✅ Plus de problèmes de connectivité Helius");
console.log("");

console.log("🚀 PROCHAINES ÉTAPES :");
console.log("======================");
console.log("1. Créez l'enregistrement DNS comme indiqué ci-dessus");
console.log("2. Attendez 2-3 minutes que le DNS se propage");
console.log("3. Lancez le script de mise à jour du webhook :");
console.log("   node update_webhook_domain.js");
console.log("");

console.log("💡 AVANTAGES DU DOMAINE PERSONNALISÉ :");
console.log("- ✅ Résolution IPv4 + IPv6 stable");
console.log("- ✅ URL professionnelle et mémorable");
console.log("- ✅ Contrôle total sur le DNS");
console.log("- ✅ Compatible avec tous les services externes"); 