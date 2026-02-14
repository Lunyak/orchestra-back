import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class ProfileService {
  private bot: any;
  private userStates: Map<number, any>;
  private prisma: PrismaService;

  init(bot: any, userStates: Map<number, any>, prisma: PrismaService) {
    this.bot = bot;
    this.userStates = userStates;
    this.prisma = prisma;
  }

  async showProfile(ctx: any) {
    const userId = ctx.from.id;

    // Находим профиль по telegramId
    const profile = await this.prisma.userProfile.findFirst({
      where: { telegramId: String(userId) },
    });

    if (!profile) {
      return ctx.reply(
        'Профиль не найден. Зарегистрируйтесь: /register',
      );
    }

    const lines = ['<b>Ваш профиль:</b>', ''];

    if (profile.displayName) {
      lines.push(`Имя: ${escapeHtml(profile.displayName)}`);
    }
    if (profile.firstName) {
      lines.push(`Имя: ${escapeHtml(profile.firstName)}`);
    }
    if (profile.lastName) {
      lines.push(`Фамилия: ${escapeHtml(profile.lastName)}`);
    }
    if (profile.email) {
      lines.push(`Email: ${escapeHtml(profile.email)}`);
    }
    if (profile.phone) {
      lines.push(`Телефон: ${escapeHtml(profile.phone)}`);
    }
    if (profile.birthday) {
      lines.push(`День рождения: ${escapeHtml(profile.birthday)}`);
    }
    if (profile.role) {
      lines.push(`Роль в театре: ${escapeHtml(profile.role)}`);
    }

    // Персонажи из characters (JSON)
    if (profile.characters) {
      try {
        const chars = Array.isArray(profile.characters)
          ? profile.characters
          : JSON.parse(profile.characters as any);
        if (Array.isArray(chars) && chars.length > 0) {
          lines.push(`Персонажи: ${chars.map((c) => escapeHtml(String(c))).join(', ')}`);
        }
      } catch (e) {
        // ignore
      }
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  }

  async startRegistration(ctx: any) {
    const userId = ctx.from.id;

    // Проверяем, не зарегистрирован ли уже пользователь
    const existingProfile = await this.prisma.userProfile.findFirst({
      where: { telegramId: String(userId) },
    });

    if (existingProfile) {
      return ctx.reply(
        'Вы уже зарегистрированы! ✅\n\nПосмотреть профиль: /profile',
      );
    }

    this.userStates.set(userId, {
      step: 'register_email',
      data: {
        telegramId: String(userId),
        telegramUsername: ctx.from.username || '',
        firstName: ctx.from.first_name || '',
        lastName: ctx.from.last_name || '',
      },
    });

    await ctx.reply(
      'Регистрация профиля.\nВведите ваш email:',
    );
  }

  private async handleRegistrationMessage(ctx: any): Promise<boolean> {
    const userId = ctx.from.id;
    const state = this.userStates.get(userId);
    if (!state || !state.step?.startsWith('register_')) return false;

    const text = (ctx.message?.text || '').trim();

    if (state.step === 'register_email') {
      if (!/^.+@.+\..+$/.test(text)) {
        await ctx.reply('Неверный формат email. Попробуйте еще раз:');
        return true;
      }

      state.data.email = text.toLowerCase();
      state.step = 'register_name';
      this.userStates.set(userId, state);

      await ctx.reply('Введите ваше полное имя (или нажмите /skip):');
      return true;
    }

    if (state.step === 'register_name') {
      if (text !== '/skip') {
        state.data.displayName = text;
      }

      this.userStates.delete(userId);

      // Создаем профиль
      await this.prisma.userProfile.upsert({
        where: { email: state.data.email },
        update: {
          telegramId: state.data.telegramId,
          telegramUsername: state.data.telegramUsername,
          displayName: state.data.displayName || null,
          firstName: state.data.firstName || null,
          lastName: state.data.lastName || null,
        },
        create: {
          email: state.data.email,
          telegramId: state.data.telegramId,
          telegramUsername: state.data.telegramUsername,
          displayName: state.data.displayName || null,
          firstName: state.data.firstName || null,
          lastName: state.data.lastName || null,
        },
      });

      await ctx.reply(
        'Регистрация завершена! ✅\n\nПосмотреть профиль: /profile',
      );
      return true;
    }

    return false;
  }

  initMiddleware() {
    this.bot.use(async (ctx, next) => {
      if (ctx.message?.text === undefined) return next();

      const handled = await this.handleRegistrationMessage(ctx);
      if (handled) return;

      return next();
    });
  }
}
