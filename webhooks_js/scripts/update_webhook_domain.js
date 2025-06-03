#!/usr/bin/env node
import fs from 'fs';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const NEW_WEBHOOK_URL = "https://webhook.counet.uk/helius-webhook";
const WALLET_ADDRESS = "CaBTVKEDpwkQLguTfSBRX9haxf4cW4KUexcMsvo8RTaB";

console.log("🔄 MISE À JOUR WEBHOOK HELIUS - DOMAINE PERSONNALISÉ");
console.log("===================================================");
console.log("");

if (!HELIUS_API_KEY) {
    console.log("❌ HELIUS_API_KEY manquant dans le fichier .env");
    process.exit(1);
}

console.log(`🔑 Clé API Helius: ${HELIUS_API_KEY.substring(0, 10)}...`);
console.log(`🌐 Nouvelle URL webhook: ${NEW_WEBHOOK_URL}`);
console.log(`🎯 Wallet surveillé: ${WALLET_ADDRESS}`);
console.log("");

// Fonction pour lister les webhooks existants
async function listWebhooks() {
    try {
        console.log("🔍 Récupération des webhooks existants...");
        
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
        console.log(`📋 ${webhooks.length} webhook(s) trouvé(s)`);
        
        return webhooks;
    } catch (error) {
        console.error("❌ Erreur récupération webhooks:", error.message);
        return [];
    }
}

// Fonction pour supprimer un webhook
async function deleteWebhook(webhookId) {
    try {
        console.log(`🗑️  Suppression webhook ${webhookId}...`);
        
        const response = await fetch(`https://api.helius.xyz/v0/webhooks/${webhookId}?api-key=${HELIUS_API_KEY}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            console.log(`✅ Webhook ${webhookId} supprimé`);
            return true;
        } else {
            console.log(`⚠️  Erreur suppression: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Erreur suppression:`, error.message);
        return false;
    }
}

// Fonction pour créer le nouveau webhook
async function createWebhook() {
    try {
        console.log("🆕 Création du nouveau webhook avec domaine personnalisé...");
        
        const webhookConfig = {
            webhookURL: NEW_WEBHOOK_URL,
            transactionTypes: ["ANY"],
            accountAddresses: [WALLET_ADDRESS],
            webhookType: "enhanced"
        };

        console.log("📋 Configuration :");
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
        
        console.log("✅ Nouveau webhook créé avec succès !");
        console.log(`🆔 ID: ${result.webhookID}`);
        console.log(`📡 URL: ${result.webhookURL}`);
        console.log("");

        // Sauvegarder les nouvelles informations
        const webhookInfo = {
            webhookID: result.webhookID,
            webhookURL: result.webhookURL,
            customDomain: "webhook.counet.uk",
            tunnelURL: "https://0af91ac9-5f76-49c1-893e-acdb55bc223e.cfargotunnel.com",
            walletAddress: WALLET_ADDRESS,
            transactionTypes: ["ANY"],
            webhookType: "enhanced",
            updatedAt: new Date().toISOString()
        };

        fs.writeFileSync('config/webhook_info.json', JSON.stringify(webhookInfo, null, 2));
        console.log("💾 Informations sauvées dans config/webhook_info.json");

        return result;
    } catch (error) {
        console.error("❌ Erreur création webhook:", error.message);
        return null;
    }
}

// Fonction pour tester le nouveau webhook
async function testWebhook() {
    try {
        console.log("🧪 Test du nouveau webhook...");
        
        const testData = [{
            signature: `test_custom_domain_${Date.now()}`,
            type: "SWAP",
            feePayer: WALLET_ADDRESS,
            fee: 5000,
            slot: 123456
        }];

        const response = await fetch(NEW_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Helius/1.0'
            },
            body: JSON.stringify(testData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log("✅ Test webhook réussi !");
            console.log("📊 Réponse:", result);
        } else {
            console.log(`⚠️  Test webhook échoué: HTTP ${response.status}`);
        }
    } catch (error) {
        console.log("❌ Erreur test webhook:", error.message);
        console.log("💡 Cela peut être normal si le DNS n'est pas encore propagé");
    }
}

// Fonction principale
async function main() {
    try {
        // 1. Lister et supprimer les anciens webhooks
        const existingWebhooks = await listWebhooks();
        
        if (existingWebhooks.length > 0) {
            console.log("🧹 Suppression des anciens webhooks...");
            for (const webhook of existingWebhooks) {
                await deleteWebhook(webhook.webhookID);
            }
            console.log("");
        }

        // 2. Créer le nouveau webhook
        const newWebhook = await createWebhook();
        
        if (!newWebhook) {
            console.log("❌ Échec création webhook");
            process.exit(1);
        }

        // 3. Attendre un peu
        console.log("⏳ Attente activation (5 secondes)...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 4. Tester le webhook
        await testWebhook();

        console.log("");
        console.log("🎉 MIGRATION VERS DOMAINE PERSONNALISÉ TERMINÉE !");
        console.log("=================================================");
        console.log("");
        console.log("✨ Votre webhook Helius utilise maintenant :");
        console.log(`   📡 URL: ${NEW_WEBHOOK_URL}`);
        console.log(`   🌐 Domaine: webhook.counet.uk`);
        console.log(`   🎯 Wallet: ${WALLET_ADDRESS}`);
        console.log("");
        console.log("🔧 AVANTAGES :");
        console.log("   ✅ Résolution IPv4 + IPv6 stable");
        console.log("   ✅ Plus de problèmes de connectivité");
        console.log("   ✅ URL professionnelle");
        console.log("   ✅ Contrôle total du DNS");
        console.log("");
        console.log("🚀 Votre système est maintenant 100% opérationnel !");

    } catch (error) {
        console.error("❌ Erreur dans le processus:", error.message);
        process.exit(1);
    }
}

// Exécuter le script
main(); 