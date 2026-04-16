import { Telegraf } from 'telegraf';
import { Wallet } from 'ethers';
import * as dotenv from 'dotenv';
import crypto from 'crypto';
import express from 'express'; // The Cloud Keepalive Server
import { initDb, getUserWallet, writeData, readData } from './db';
import { startCronJobs } from './cron';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN as string);

// --- 1. INITIALIZATION ---
bot.start(async (ctx) => {
    const existingWallet = await getUserWallet(String(ctx.from.id));
    if (existingWallet) return ctx.reply(`Welcome back to Z-Lite.\nUse /monitor [TOKEN] [PERCENTAGE] to set up an autonomous portfolio alert.`);
    ctx.reply(
        "Welcome to Z-Lite. Your autonomous onchain agent is standing by.\n\n" +
        "👉 Send `/wallet new` to generate a fresh agent wallet.\n" +
        "👉 Send `/wallet import [private_key]` to connect an existing wallet.", 
        { parse_mode: 'Markdown' }
    );
});

// --- 2. WALLET MANAGEMENT ---
bot.command('wallet', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const command = args[1];
    const userId = String(ctx.from.id);
    const wallets = await readData<any>('wallets.json');

    if (command === 'new') {
        const newWallet = Wallet.createRandom();
        wallets[userId] = { address: newWallet.address, privateKey: newWallet.privateKey };
        await writeData('wallets.json', wallets);
        return ctx.reply(`✅ Agent wallet generated!\nAddress: \`${newWallet.address}\`\n\nUse \`/policy limit 50\` to set guardrails, or \`/monitor SOL 50\` to set an alert.`, { parse_mode: 'Markdown' });
    }
    
    if (command === 'import') {
        const pk = args[2];
        if (!pk) return ctx.reply("❌ Please provide a private key. Format: `/wallet import [private_key]`", { parse_mode: 'Markdown' });

        try {
            const importedWallet = new Wallet(pk);
            wallets[userId] = { address: importedWallet.address, privateKey: importedWallet.privateKey };
            await writeData('wallets.json', wallets);
            return ctx.reply(`✅ Wallet imported successfully.\nActive Address: \`${importedWallet.address}\``, { parse_mode: 'Markdown' });
        } catch (error) {
            return ctx.reply("❌ Invalid private key format.");
        }
    }
});

// --- 3. POLICY ENGINE GUARDRAILS ---
bot.command('policy', async (ctx) => {
    const userId = String(ctx.from.id);
    const args = ctx.message.text.trim().split(' ');

    if (args.length < 3) {
        return ctx.reply(
            "❌ Invalid format. Use:\n`/policy limit [amount]`\n`/policy chain [chain_name]`",
            { parse_mode: 'Markdown' }
        );
    }

    const action = args[1].toLowerCase();
    const value = args[2].toLowerCase();

    const policies = await readData<any>('policies.json');
    if (!policies[userId]) policies[userId] = {};

    if (action === 'limit') {
        policies[userId].maxSpend = parseFloat(value);
        await writeData('policies.json', policies);
        return ctx.reply(`✅ *Policy Updated:*\nMaximum agent spend limit set to **${value}** per transaction.`, { parse_mode: 'Markdown' });
    } else if (action === 'chain') {
        policies[userId].chainLock = value;
        await writeData('policies.json', policies);
        return ctx.reply(`✅ *Policy Updated:*\nAgent execution strictly locked to the **${value}** network.`, { parse_mode: 'Markdown' });
    }
});

// --- 4. PORTFOLIO MONITOR COMMAND ---
bot.command('monitor', async (ctx) => {
    const userId = String(ctx.from.id);
    const existingWallet = await getUserWallet(userId);

    if (!existingWallet) return ctx.reply("❌ Create a wallet first: `/wallet new`", { parse_mode: 'Markdown' });

    const match = ctx.message.text.trim().match(/^\/monitor\s+([a-zA-Z0-9]+)\s+(\d+)$/i);
    
    if (!match) return ctx.reply("❌ Invalid format. Use: `/monitor [TOKEN] [MIN_PERCENTAGE]`\nExample: `/monitor SOL 50`", { parse_mode: 'Markdown' });

    const [_, token, threshold] = match;
    const taskId = crypto.randomBytes(4).toString('hex');
    const tasks = await readData<any>('tasks.json');
    
    if (!tasks[userId]) tasks[userId] = [];
    // Clear old tasks to keep the demo clean, add the new one
    tasks[userId] = [{ id: taskId, type: 'monitor', token: token.toUpperCase(), threshold: parseInt(threshold), status: 'active' }];
    await writeData('tasks.json', tasks);

    ctx.reply(`✅ *Autonomous Monitor Activated*\n\nZ-Lite will background-check your wallet via the Zerion CLI.\nYou will receive an alert if **${token.toUpperCase()}** drops below **${threshold}%** of your total portfolio.`, { parse_mode: 'Markdown' });
});

// --- 5. THE CLOUD KEEPALIVE SERVER ---
const app = express();

app.get('/', (req, res) => {
    res.send('Z-Lite Autonomous Agent is online and monitoring. ⚡');
});

const PORT = process.env.PORT || 3000;

// --- 6. BOOT SEQUENCE ---
initDb().then(() => {
    bot.launch();
    startCronJobs(bot); // Passes the bot to cron so it can send alerts
    console.log('⚡ Z-Lite Telegram Listener is online.');
    
    app.listen(PORT, () => {
        console.log(`🌍 Cloud web server bound to port ${PORT}`);
    });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));