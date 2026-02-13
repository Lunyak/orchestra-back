import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import * as cron from 'node-cron';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeSupergroupId(rawId: string): string {
  if (!rawId) return '';
  const id = String(rawId).trim();
  if (id.startsWith('-100')) return id;
  if (id.startsWith('-')) return `-100${id.slice(1)}`;
  return id;
}

function parseDate(input: string): { dateKey: string; display: string } | null {
  const WEEKDAY_NAMES = {
    воскресенье: 0,
    понедельник: 1,
    вторник: 2,
    среда: 3,
    четверг: 4,
    пятница: 5,
    суббота: 6,
  };

  const trimmed = (input || '').trim().toLowerCase();
  const now = new Date();
  const y = now.getFullYear();

  if (trimmed === 'завтра') {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    const d = t.getDate();
    const m = t.getMonth() + 1;
    const dateKey = `${t.getFullYear()}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const display = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${t.getFullYear()}`;
    return { dateKey, display };
  }

  const weekday = WEEKDAY_NAMES[trimmed];
  if (weekday !== undefined) {
    const today = now.getDay();
    let daysAhead = (weekday - today + 7) % 7;
    if (daysAhead === 0) daysAhead = 7;
    const t = new Date(now);
    t.setDate(t.getDate() + daysAhead);
    const d = t.getDate();
    const m = t.getMonth() + 1;
    const dateKey = `${t.getFullYear()}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const display = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${t.getFullYear()}`;
    return { dateKey, display };
  }

  const parts = trimmed.split(/[.\s/]/).filter(Boolean);
  if (parts.length === 2) {
    const [d, m] = parts.map((p) => parseInt(p, 10));
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const display = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
      return { dateKey, display };
    }
  }

  if (parts.length === 3) {
    const [d, m, yr] = parts.map((p) => parseInt(p, 10));
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && yr >= 2020 && yr <= 2030) {
      const dateKey = `${yr}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const display = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${yr}`;
      return { dateKey, display };
    }
  }

  return null;
}

@Injectable()
export class AttendanceService {
  private bot: any;
  private userStates: Map<number, any>;
  private prisma: PrismaService;
  private ownerId: string;

  init(bot: any, userStates: Map<number, any>, prisma: PrismaService) {
    this.bot = bot;
    this.userStates = userStates;
    this.prisma = prisma;
    this.ownerId = process.env.OWNER_TELEGRAM_ID || '';
  }

  private isOwner(userId: number): boolean {
    return Boolean(this.ownerId && String(userId) === String(this.ownerId));
  }

  private async getBotSettings() {
    return this.prisma.botSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
  }

  async startSetGroup(ctx: any) {
    const userId = ctx.from.id;
    if (!this.isOwner(userId)) {
      return ctx.reply('Эта команда доступна только организатору.');
    }

    const chatType = ctx.chat?.type;
    if (chatType === 'group' || chatType === 'supergroup') {
      const chatId = String(ctx.chat.id);
      const threadId = ctx.message?.message_thread_id;

      await this.prisma.botSettings.upsert({
        where: { id: 'singleton' },
        update: {
          groupChatId: chatId,
          attendanceThreadId: threadId ? String(threadId) : null,
          announcementsThreadId: threadId ? String(threadId) : null,
        },
        create: {
          id: 'singleton',
          groupChatId: chatId,
          attendanceThreadId: threadId ? String(threadId) : null,
          announcementsThreadId: threadId ? String(threadId) : null,
        },
      });

      if (threadId) {
        await ctx.reply(
          `Группа и топик сохранены.\nГруппа: ${chatId}\nТопик: ${threadId}`,
        );
      } else {
        await ctx.reply(`Группа сохранена. ID: ${chatId}.`);
      }
      return;
    }

    this.userStates.set(userId, { step: 'setgroup_wait_id', data: {} });
    await ctx.reply(
      'Введите ID супергруппы и топика в формате:\n<code>-1494331205/41051</code>\n\nОтмена: /cancel',
      { parse_mode: 'HTML' },
    );
  }

  async startSetRehearsal(ctx: any) {
    const userId = ctx.from.id;
    if (!this.isOwner(userId)) {
      return ctx.reply('Эта команда доступна только организатору.');
    }

    this.userStates.set(userId, {
      step: 'setrehearsal_date',
      data: {},
    });

    ctx.reply(
      'Введите дату репетиции: ДД.ММ или ДД.ММ.ГГГГ, или «завтра», или день недели:',
    );
  }

  private async handleSetGroupMessage(ctx: any): Promise<boolean> {
    const userId = ctx.from.id;
    const state = this.userStates.get(userId);
    if (!state || state.step !== 'setgroup_wait_id') return false;

    const text = (ctx.message?.text || '').trim();
    if (/^\/cancel$/i.test(text)) {
      this.userStates.delete(userId);
      await ctx.reply('Настройка группы отменена.');
      return true;
    }

    const input = text.replace(/\s/g, '');
    const slashIdx = input.indexOf('/');
    let groupId: string;
    let threadIdStr: string | null = null;

    if (slashIdx >= 0) {
      groupId = input.slice(0, slashIdx).trim();
      threadIdStr = input.slice(slashIdx + 1).trim().replace(/\/$/, '');
    } else {
      groupId = input;
    }

    if (!/^-?\d+$/.test(groupId)) {
      await ctx.reply('Неверный формат группы.');
      return true;
    }

    this.userStates.delete(userId);

    await this.prisma.botSettings.upsert({
      where: { id: 'singleton' },
      update: {
        groupChatId: groupId,
        attendanceThreadId: threadIdStr || null,
        announcementsThreadId: threadIdStr || null,
      },
      create: {
        id: 'singleton',
        groupChatId: groupId,
        attendanceThreadId: threadIdStr || null,
        announcementsThreadId: threadIdStr || null,
      },
    });

    await ctx.reply(`Группа сохранена. ID: ${groupId}${threadIdStr ? `, топик: ${threadIdStr}` : ''}`);
    return true;
  }

  private async handleSetRehearsalMessage(ctx: any): Promise<boolean> {
    const userId = ctx.from.id;
    const state = this.userStates.get(userId);
    if (!state || !state.step?.startsWith('setrehearsal_')) return false;

    const text = (ctx.message?.text || '').trim();

    if (state.step === 'setrehearsal_date') {
      const parsed = parseDate(text);
      if (!parsed) {
        await ctx.reply('Неверный формат даты.');
        return true;
      }

      state.data.dateKey = parsed.dateKey;
      state.data.dateDisplay = parsed.display;
      state.step = 'setrehearsal_time';
      this.userStates.set(userId, state);
      await ctx.reply('Введите время (например 18:00):');
      return true;
    }

    if (state.step === 'setrehearsal_time') {
      state.data.time = text;
      this.userStates.delete(userId);

      // Получаем проект по умолчанию
      const settings = await this.getBotSettings();
      const projectSlug = settings.projectSlug || 'default';

      // Находим проект
      const project = await this.prisma.project.findFirst({
        where: { slug: projectSlug, deletedAt: null },
      });

      if (!project) {
        await ctx.reply('Проект не найден. Настройте projectSlug в BotSettings.');
        return true;
      }

      // Создаем репетицию
      const startsAt = new Date(`${state.data.dateKey}T${state.data.time}:00`);
      const rehearsal = await this.prisma.rehearsal.create({
        data: {
          projectId: project.id,
          title: `Репетиция ${state.data.dateDisplay}`,
          startsAt,
          createdBy: 'bot',
          createdVia: 'telegram',
        },
      });

      await ctx.reply(
        `Репетиция создана: ${state.data.dateDisplay} в ${state.data.time}.`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              'Отправить опрос в группу',
              `rehearsal_send_${rehearsal.id}`,
            ),
          ],
        ]),
      );
      return true;
    }

    return false;
  }

  async showWhoIsComing(ctx: any) {
    // Получаем ближайшую репетицию
    const settings = await this.getBotSettings();
    const projectSlug = settings.projectSlug || 'default';

    const project = await this.prisma.project.findFirst({
      where: { slug: projectSlug, deletedAt: null },
    });

    if (!project) {
      return ctx.reply('Проект не найден.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rehearsal = await this.prisma.rehearsal.findFirst({
      where: {
        projectId: project.id,
        startsAt: { gte: today },
      },
      orderBy: { startsAt: 'asc' },
      include: { participants: true },
    });

    if (!rehearsal) {
      return ctx.reply('Ближайшая репетиция не запланирована.');
    }

    const text = await this.formatAttendanceList(rehearsal);
    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  private async formatAttendanceList(rehearsal: any): Promise<string> {
    const coming = rehearsal.participants.filter((p) => p.status === 'present' || p.status === 'late');
    const notComing = rehearsal.participants.filter((p) => p.status === 'absent');
    const late = rehearsal.participants.filter((p) => p.status === 'late');

    const dateStr = new Date(rehearsal.startsAt).toLocaleDateString('ru-RU');
    const timeStr = new Date(rehearsal.startsAt).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const lines = [`<b>${dateStr} в ${timeStr}</b>`, ''];

    lines.push('Присутствие:');
    if (coming.length === 0) {
      lines.push('—');
    } else {
      for (const p of coming) {
        lines.push(`• <b>${escapeHtml(p.userName || 'Участник')}</b>`);
      }
    }

    lines.push('', 'Отсутствие:');
    if (notComing.length === 0) {
      lines.push('—');
    } else {
      for (const p of notComing) {
        lines.push(`• <b>${escapeHtml(p.userName || 'Участник')}</b>`);
      }
    }

    if (late.length > 0) {
      lines.push('', 'Буду позже:');
      for (const p of late) {
        const lateText = p.lateTime ? ` — ${p.lateTime}` : '';
        lines.push(`• <b>${escapeHtml(p.userName || 'Участник')}</b>${lateText}`);
      }
    }

    return lines.join('\n');
  }

  initMiddleware() {
    this.bot.use(async (ctx, next) => {
      if (ctx.message?.text === undefined) return next();
      
      const handledSetGroup = await this.handleSetGroupMessage(ctx);
      if (handledSetGroup) return;
      
      const handledSetRehearsal = await this.handleSetRehearsalMessage(ctx);
      if (handledSetRehearsal) return;
      
      return next();
    });

    // Action для отправки опроса
    this.bot.action(/^rehearsal_send_(.+)$/, async (ctx) => {
      await this.handleSendToGroupCallback(ctx);
    });

    // Actions для ответов на опрос
    this.bot.action(/^attendance_(.+)_(coming|absent|late)$/, async (ctx) => {
      await this.handleAttendanceCallback(ctx);
    });
  }

  private async handleSendToGroupCallback(ctx: any) {
    const rehearsalId = ctx.match[1];
    
    try {
      await ctx.answerCbQuery();
    } catch (e) {
      // ignore
    }

    const settings = await this.getBotSettings();
    const groupChatId = normalizeSupergroupId(settings.groupChatId || '');
    const threadId = settings.attendanceThreadId;

    if (!groupChatId) {
      await ctx.reply('Группа не настроена. Используйте /setgroup');
      return;
    }

    const rehearsal = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      include: { participants: true },
    });

    if (!rehearsal) {
      await ctx.reply('Репетиция не найдена.');
      return;
    }

    const dateStr = new Date(rehearsal.startsAt).toLocaleDateString('ru-RU');
    const timeStr = new Date(rehearsal.startsAt).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const text = `<b>${dateStr} в ${timeStr}</b>\n\nПодтверждение присутствия`;
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Буду', `attendance_${rehearsalId}_coming`),
        Markup.button.callback('😢', `attendance_${rehearsalId}_absent`),
      ],
      [Markup.button.callback('Буду позже', `attendance_${rehearsalId}_late`)],
    ]);

    try {
      const sent = await this.bot.telegram.sendMessage(groupChatId, text, {
        message_thread_id: threadId ? parseInt(threadId, 10) : undefined,
        parse_mode: 'HTML',
        ...keyboard,
      });

      // Сохраняем ID сообщения
      await this.prisma.rehearsal.update({
        where: { id: rehearsalId },
        data: {
          telegramChatId: groupChatId,
          telegramMessageId: String(sent.message_id),
          telegramThreadId: threadId,
        },
      });

      await ctx.reply('Опрос отправлен в группу.');
    } catch (error) {
      console.error('Ошибка при отправке опроса:', error);
      await ctx.reply('Не удалось отправить опрос в группу.');
    }
  }

  private async handleAttendanceCallback(ctx: any) {
    const rehearsalId = ctx.match[1];
    const status = ctx.match[2] as 'coming' | 'absent' | 'late';

    const userId = ctx.from.id;
    const userName = [ctx.from.first_name, ctx.from.last_name]
      .filter(Boolean)
      .join(' ') || ctx.from.username || 'Участник';

    // Находим профиль по telegramId
    const profile = await this.prisma.userProfile.findFirst({
      where: { telegramId: String(userId) },
    });

    const email = profile?.email || `telegram_${userId}@temp.local`;

    const statusMap = {
      coming: 'present' as const,
      absent: 'absent' as const,
      late: 'late' as const,
    };

    const dbStatus = statusMap[status];

    // Upsert участника
    await this.prisma.rehearsalParticipant.upsert({
      where: {
        rehearsalId_email: {
          rehearsalId,
          email,
        },
      },
      update: {
        status: dbStatus,
        userName,
        telegramId: String(userId),
      },
      create: {
        rehearsalId,
        email,
        status: dbStatus,
        userName,
        telegramId: String(userId),
      },
    });

    const labels = {
      coming: 'Присутствие',
      absent: 'Отсутствие',
      late: 'Буду позже',
    };

    await ctx.answerCbQuery(`Отмечено: ${labels[status]}`);

    // Обновляем сообщение
    await this.updateAttendanceMessage(rehearsalId);
  }

  private async updateAttendanceMessage(rehearsalId: string) {
    const rehearsal = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      include: { participants: true },
    });

    if (!rehearsal || !rehearsal.telegramChatId || !rehearsal.telegramMessageId) {
      return;
    }

    const text = await this.formatAttendanceList(rehearsal);
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Буду', `attendance_${rehearsalId}_coming`),
        Markup.button.callback('😢', `attendance_${rehearsalId}_absent`),
      ],
      [Markup.button.callback('Буду позже', `attendance_${rehearsalId}_late`)],
    ]);

    try {
      await this.bot.telegram.editMessageText(
        rehearsal.telegramChatId,
        parseInt(rehearsal.telegramMessageId, 10),
        undefined,
        text,
        { ...keyboard, parse_mode: 'HTML' },
      );
    } catch (e) {
      // Ignore if message not modified
    }
  }
}
