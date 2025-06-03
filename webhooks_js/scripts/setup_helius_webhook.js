#!/usr/bin/env node
import fs from 'fs';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

// Configuration
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const TUNNEL_URL = "https://0af91ac9-5f76-49c1-893e-acdb55bc223e.cfargotunnel.com";
const WEBHOOK_URL = `${TUNNEL_URL}/helius-webhook`;
const WALLET_ADDRESS = "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB";

console.log("🔧 CONFIGURATION WEBHOOK HELIUS");
console.log("================================");
console.log("");

// Vérifier la clé API
if (!HELIUS_API_KEY) {
    console.log("❌ HELIUS_API_KEY manquant dans le fichier .env");
    console.log("💡 Créez un fichier .env avec votre clé API Helius :");
    console.log("   echo 'HELIUS_API_KEY=votre_cle_api' > .env");
    process.exit(1);
}

console.log(`🔑 Clé API Helius: ${HELIUS_API_KEY.substring(0, 10)}...`);
console.log(`🌐 URL du tunnel: ${TUNNEL_URL}`);
console.log(`📡 URL webhook: ${WEBHOOK_URL}`);
console.log(`🎯 Wallet surveillé: ${WALLET_ADDRESS}`);
console.log("");

// Fonction pour lister les webhooks existants
async function listWebhooks() {
    try {
        console.log("🔍 Vérification des webhooks existants...");
        
        const response = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const webhooks = await response.json();
        
        if (webhooks.length === 0) {
            console.log("📭 Aucun webhook existant trouvé");
            return [];
        }

        console.log(`📋 ${webhooks.length} webhook(s) existant(s) :`);
        webhooks.forEach((webhook, index) => {
            console.log(`   ${index + 1}. ID: ${webhook.webhookID}`);
            console.log(`      URL: ${webhook.webhookURL}`);
            console.log(`      Type: ${webhook.webhookType}`);
            console.log(`      Wallets: ${webhook.accountAddresses?.length || 0}`);
            console.log("");
        });

        return webhooks;
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des webhooks:", error.message);
        return [];
    }
}

// Fonction pour supprimer un webhook
async function deleteWebhook(webhookId) {
    try {
        console.log(`🗑️  Suppression du webhook ${webhookId}...`);
        
        const response = await fetch(`https://api.helius.xyz/v0/webhooks/${webhookId}?api-key=${HELIUS_API_KEY}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            console.log(`✅ Webhook ${webhookId} supprimé avec succès`);
            return true;
        } else {
            console.log(`⚠️  Erreur suppression webhook ${webhookId}: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Erreur suppression webhook ${webhookId}:`, error.message);
        return false;
    }
}

// Fonction pour créer le nouveau webhook
async function createWebhook() {
    try {
        console.log("🆕 Création du nouveau webhook...");
        
        const webhookConfig = {
            webhookURL: WEBHOOK_URL,
            transactionTypes: ["ANY"],
            accountAddresses: [WALLET_ADDRESS],
            webhookType: "enhanced"
        };

        console.log("📋 Configuration du webhook :");
        console.log(JSON.stringify(webhookConfig, null, 2));
        console.log("");

        const response = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookConfig)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        
        console.log("✅ Webhook créé avec succès !");
        console.log(`🆔 ID du webhook: ${result.webhookID}`);
        console.log(`📡 URL: ${result.webhookURL}`);
        console.log("");

        // Sauvegarder l'ID du webhook
        const webhookInfo = {
            webhookID: result.webhookID,
            webhookURL: result.webhookURL,
            tunnelURL: TUNNEL_URL,
            walletAddress: WALLET_ADDRESS,
            transactionTypes: ["ANY"],
            webhookType: "enhanced",
            createdAt: new Date().toISOString()
        };

        fs.writeFileSync('config/webhook_info.json', JSON.stringify(webhookInfo, null, 2));
        console.log("💾 Informations sauvées dans config/webhook_info.json");

        return result;
    } catch (error) {
        console.error("❌ Erreur création webhook:", error.message);
        return null;
    }
}

// Fonction pour tester le webhook
async function testWebhook() {
    try {
        console.log("🧪 Test du webhook...");
        
        const testData = {
            signature: `test_${Date.now()}`,
            type: "SWAP",
            feePayer: WALLET_ADDRESS,
            fee: 5000,
            slot: 123456,
            tokenTransfers: [{
                mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
                tokenAmount: 1000000,
                fromUserAccount: "11111111111111111111111111111111",
                toUserAccount: WALLET_ADDRESS
            }],
            nativeTransfers: [{
                fromUserAccount: WALLET_ADDRESS,
                toUserAccount: "11111111111111111111111111111111",
                amount: 100000000
            }]
        };

        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([testData])
        });

        if (response.ok) {
            const result = await response.json();
            console.log("✅ Test webhook réussi !");
            console.log("📊 Réponse:", result);
        } else {
            console.log(`⚠️  Test webhook échoué: HTTP ${response.status}`);
            const errorText = await response.text();
            console.log("📊 Erreur:", errorText);
        }
    } catch (error) {
        console.error("❌ Erreur test webhook:", error.message);
    }
}

// Fonction principale
async function main() {
    try {
        // 1. Lister les webhooks existants
        const existingWebhooks = await listWebhooks();
        
        // 2. Supprimer les anciens webhooks si nécessaire
        if (existingWebhooks.length > 0) {
            console.log("🧹 Nettoyage des anciens webhooks...");
            for (const webhook of existingWebhooks) {
                await deleteWebhook(webhook.webhookID);
            }
            console.log("");
        }

        // 3. Créer le nouveau webhook
        const newWebhook = await createWebhook();
        
        if (!newWebhook) {
            console.log("❌ Échec de la création du webhook");
            process.exit(1);
        }

        // 4. Attendre un peu que le webhook soit actif
        console.log("⏳ Attente de l'activation du webhook (5 secondes)...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 5. Tester le webhook
        await testWebhook();

        console.log("");
        console.log("🎉 CONFIGURATION TERMINÉE AVEC SUCCÈS !");
        console.log("=======================================");
        console.log("");
        console.log("✨ Votre webhook Helius est maintenant configuré pour :");
        console.log(`   📡 Recevoir les transactions de: ${WALLET_ADDRESS}`);
        console.log(`   🌐 Sur l'URL: ${WEBHOOK_URL}`);
        console.log(`   🔄 Types: ANY (toutes les transactions)`);
        console.log("");
        console.log("🚀 Votre système est prêt à recevoir les transactions en temps réel !");
        console.log("");
        console.log("📋 Prochaines étapes :");
        console.log("   1. Démarrez votre système: npm run start-tunnel");
        console.log("   2. Surveillez les logs pour voir les transactions");
        console.log("   3. Accédez à l'interface: https://0af91ac9-5f76-49c1-893e-acdb55bc223e.cfargotunnel.com");

    } catch (error) {
        console.error("❌ Erreur dans le processus principal:", error.message);
        process.exit(1);
    }
}

// Exécuter le script
main(); 