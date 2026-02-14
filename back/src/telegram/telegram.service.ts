/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from './services/attendance.service';
import { ProfileService as TelegramProfileService } from './services/profile.service';

const COMMANDS = [
  { command: 'start', shortDescription: 'Начать', adminOnly: false },
  { command: 'profile', shortDescription: '👤 Профиль', adminOnly: false },
  { command: 'register', shortDescription: '📝 Регистрация', adminOnly: false },
  {
    command: 'setrehearsal',
    shortDescription: '📅 Создать репетицию',
    adminOnly: true,
  },
  { command: 'who', shortDescription: '👥 Кто будет', adminOnly: false },
  {
    command: 'setgroup',
    shortDescription: '⚙️ Настроить группу',
    adminOnly: true,
  },
  { command: 'help', shortDescription: '❓ Помощь', adminOnly: false },
  { command: 'menu', shortDescription: '📋 Меню', adminOnly: false },
];

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf;
  private userStates: Map<number, any> = new Map();
  private ownerId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly telegramProfile: TelegramProfileService,
  ) {
    const token = process.env.BOT_TOKEN?.trim();
    if (!token) {
      console.warn('⚠️ BOT_TOKEN not set or empty, telegram bot will not start');
      console.warn(`   BOT_TOKEN value: "${process.env.BOT_TOKEN}"`);
      return;
    }

    console.log(`🤖 Initializing Telegram bot (token: ${token.substring(0, 10)}...)`);
    this.bot = new Telegraf(token);
    this.ownerId = process.env.OWNER_TELEGRAM_ID || '';

    // Инжектим зависимости в сервисы
    this.attendance.init(this.bot, this.userStates, this.prisma);
    this.telegramProfile.init(this.bot, this.userStates, this.prisma);
  }

  async onModuleInit() {
    if (!this.bot) {
      console.log('⚠️ Telegram bot disabled (no token)');
      return;
    }

    this.setupCommands();
    this.setupMenuHandler();
    this.registerBotCommands();
    this.initServices();

    console.log('🚀 Launching Telegram bot...');
    
    // Запускаем бот асинхронно без блокировки приложения
    this.launchBotAsync();

    // Graceful stop
    process.once('SIGINT', () => this.bot?.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));
  }

  private async launchBotAsync() {
    try {
      // Добавляем timeout для bot.launch чтобы не зависать
      const launchPromise = this.bot.launch();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Bot launch timeout (30s)')), 30000)
      );
      
      await Promise.race([launchPromise, timeoutPromise]);
      console.log('✅ Telegram бот запущен успешно');
    } catch (err) {
      console.error('❌ Ошибка запуска Telegram бота:', err?.message || err);
      if (err?.response?.error_code) {
        console.error(`   Telegram API error: ${err.response.error_code} - ${err.response.description}`);
      }
      console.warn('⚠️ Приложение продолжит работу без Telegram бота');
      console.warn('   Возможные причины:');
      console.warn('   - BOT_TOKEN неверный или истек');
      console.warn('   - Нет доступа к api.telegram.org (проверьте сеть/firewall)');
      console.warn('   - Токен уже используется в другом процессе');
      console.warn('   - Long polling блокируется внутри Docker контейнера');
    }
  }

  private isOwner(ctx: any): boolean {
    return (
      ctx?.from?.id != null &&
      !!this.ownerId &&
      String(ctx.from.id) === String(this.ownerId)
    );
  }

  private getMenuKeyboard(isOwner: boolean) {
    const visible = COMMANDS.filter(
      (c) => c.command !== 'start' && (!c.adminOnly || isOwner),
    );
    const labels = visible.map((c) => c.shortDescription);
    const rows: string[][] = [];
    for (let i = 0; i < labels.length; i += 2) {
      rows.push(labels.slice(i, i + 2));
    }
    return Markup.keyboard(rows).resize();
  }

  private setupMenuHandler() {
    this.bot.use(async (ctx, next) => {
      const text = ctx.message?.['text'];
      if (ctx.chat?.type !== 'private' || !text) return next();

      const cmd = COMMANDS.find((c) => c.shortDescription === text);
      if (!cmd) return next();

      try {
        await this.runCommand(ctx, cmd.command);
      } catch (e) {
        console.error('Menu command error:', cmd.command, e?.message || e);
        return next();
      }
    });
  }

  private async runCommand(ctx: any, commandName: string) {
    const handlers = {
      profile: () => this.telegramProfile.showProfile(ctx),
      register: () => this.telegramProfile.startRegistration(ctx),
      setrehearsal: () => this.attendance.startSetRehearsal(ctx),
      setgroup: () => this.attendance.startSetGroup(ctx),
      who: () => this.attendance.showWhoIsComing(ctx),
      help: () => this.showHelp(ctx),
      menu: () =>
        ctx.reply('Выберите команду:', this.getMenuKeyboard(this.isOwner(ctx))),
    };

    const fn = handlers[commandName];
    if (fn) await fn();
  }

  private setupCommands() {
    this.bot.start((ctx) => {
      ctx.reply(
        `Привет, ${ctx.from.first_name}! Я помогу тебе с репетициями 🎭`,
      );
      if (ctx.chat?.type === 'private') {
        ctx.reply('Выберите команду:', this.getMenuKeyboard(this.isOwner(ctx)));
      }
    });

    this.bot.command(['profile', 'me'], (ctx) =>
      this.telegramProfile.showProfile(ctx),
    );

    this.bot.command('register', (ctx) =>
      this.telegramProfile.startRegistration(ctx),
    );

    this.bot.command('setrehearsal', (ctx) =>
      this.attendance.startSetRehearsal(ctx),
    );

    this.bot.command('setgroup', (ctx) => this.attendance.startSetGroup(ctx));

    this.bot.command('who', (ctx) => this.attendance.showWhoIsComing(ctx));

    this.bot.command('menu', (ctx) => {
      if (ctx.chat?.type === 'private') {
        ctx.reply('Выберите команду:', this.getMenuKeyboard(this.isOwner(ctx)));
      } else {
        ctx.reply('Меню доступно только в личных сообщениях с ботом.');
      }
    });

    this.bot.command('help', (ctx) => this.showHelp(ctx));
  }

  private registerBotCommands() {
    const publicCommands = COMMANDS.filter((c) => !c.adminOnly).map((c) => ({
      command: c.command,
      description: c.shortDescription,
    }));

    this.bot.telegram.setMyCommands(publicCommands).catch((e) => {
      console.error('Failed to set bot commands:', e);
    });
  }

  private initServices() {
    this.attendance.initMiddleware();
    this.telegramProfile.initMiddleware();
  }

  private showHelp(ctx: any) {
    const isOwner = this.isOwner(ctx);
    const lines = ['<b>Доступные команды:</b>', ''];

    COMMANDS.forEach((cmd) => {
      if (cmd.adminOnly && !isOwner) return;
      lines.push(`/${cmd.command} — ${cmd.shortDescription}`);
    });

    ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  }
}
