import { Telegraf } from 'telegraf';
import { Wallet } from 'ethers';
import * as dotenv from 'dotenv';
import crypto from 'crypto';
import { initDb, getUserWallet, writeData, readData } from './db';
import { startCronJobs } from './cron';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN as string);

bot.start(async (ctx) => {
    const existingWallet = await getUserWallet(String(ctx.from.id));
    if (existingWallet) return ctx.reply(`Welcome back to Z-Lite.\nUse /monitor [TOKEN] [PERCENTAGE] to set up an autonomous portfolio alert.`);
    ctx.reply("Welcome to Z-Lite.\n👉 Send `/wallet new` to generate an agent wallet.", { parse_mode: 'Markdown' });
});

bot.command('wallet', async (ctx) => {
    const command = ctx.message.text.split(' ')[1];
    const userId = String(ctx.from.id);
    const wallets = await readData<any>('wallets.json');

    if (command === 'new') {
        const newWallet = Wallet.createRandom();
        wallets[userId] = { address: newWallet.address, privateKey: newWallet.privateKey };
        await writeData('wallets.json', wallets);
        return ctx.reply(`✅ Agent wallet generated!\nAddress: \`${newWallet.address}\`\n\nUse \`/monitor SOL 50\` to set a rebalance alert.`, { parse_mode: 'Markdown' });
    }
});

// --- NEW PORTFOLIO MONITOR COMMAND ---
bot.command('monitor', async (ctx) => {
    const userId = String(ctx.from.id);
    const existingWallet = await getUserWallet(userId);

    if (!existingWallet) return ctx.reply("❌ Create a wallet first: `/wallet new`", { parse_mode: 'Markdown' });

    // Format: /monitor SOL 50
    const match = ctx.message.text.trim().match(/^\/monitor\s+([a-zA-Z0-9]+)\s+(\d+)$/i);
    
    if (!match) return ctx.reply("❌ Invalid format. Use: `/monitor [TOKEN] [MIN_PERCENTAGE]`\nExample: `/monitor SOL 50`", { parse_mode: 'Markdown' });

    const [_, token, threshold] = match;
    const taskId = crypto.randomBytes(4).toString('hex');
    const tasks = await readData<any>('tasks.json');
    
    if (!tasks[userId]) tasks[userId] = [];
    // Clear old tasks to keep the demo clean
    tasks[userId] = [{ id: taskId, type: 'monitor', token: token.toUpperCase(), threshold: parseInt(threshold), status: 'active' }];
    await writeData('tasks.json', tasks);

    ctx.reply(`✅ *Autonomous Monitor Activated*\n\nZ-Lite will background-check your wallet via the Zerion CLI.\nYou will receive an alert if **${token.toUpperCase()}** drops below **${threshold}%** of your total portfolio.`, { parse_mode: 'Markdown' });
});

initDb().then(() => {
    bot.launch();
    startCronJobs(bot); // WE PASS THE BOT HERE SO CRON CAN SEND MESSAGES!
    console.log('⚡ Z-Lite Telegram Listener is online.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));