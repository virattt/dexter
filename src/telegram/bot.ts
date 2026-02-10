import 'dotenv/config';
import { Bot } from 'grammy';
import { handleMessage } from './handler.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Please add it to your .env file.');
  process.exit(1);
}

const bot = new Bot(token);

bot.command('start', (ctx) =>
  ctx.reply(
    'Welcome to Dexter! Send me a financial research question and I\'ll look into it for you.'
  )
);

bot.on('message:text', handleMessage);

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  bot.stop();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('Dexter Telegram bot is running...');
bot.start();
