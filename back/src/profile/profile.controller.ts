import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Защищенные эндпоинты (требуют JWT)
  @UseGuards(JwtAuthGuard)
  @Get()
  getMyProfile(@Req() req: { user: { email: string } }) {
    return this.profileService.getOrCreateByEmail(req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('batch')
  getProfilesBatch(@Body() body: { emails?: string[] }) {
    const emails = Array.isArray(body?.emails) ? body.emails : [];
    return this.profileService.getManyByEmails(emails);
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  updateMyProfile(
    @Req() req: { user: { email: string } },
    @Body() body: UpdateProfileDto,
  ) {
    return this.profileService.updateByEmail(req.user.email, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  deleteMyProfile(@Req() req: { user: { email: string } }) {
    return this.profileService.deleteByEmail(req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 6 * 1024 * 1024, // 6MB
      },
    }),
  )
  async uploadMyAvatar(
    @Req() req: { user: { email: string } },
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    try {
      return await this.profileService.uploadAvatarByEmail(
        req.user.email,
        file,
      );
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('unsupported')) {
        throw new BadRequestException('Поддерживаются PNG/JPG/WebP/GIF');
      }
      if (msg.includes('image')) {
        throw new BadRequestException('Аватар должен быть изображением');
      }
      throw new BadRequestException('Не удалось загрузить аватар');
    }
  }

  // Публичные эндпоинты для бота (работают по telegramId)
  @Get('telegram/:telegramId')
  getProfileByTelegramId(@Param('telegramId') telegramId: string) {
    return this.profileService.getByTelegramId(telegramId);
  }

  @Post('telegram/:telegramId')
  createProfileByTelegramId(
    @Param('telegramId') telegramId: string,
    @Body() body: UpdateProfileDto,
  ) {
    return this.profileService.createByTelegramId(telegramId, body);
  }

  @Patch('telegram/:telegramId')
  updateProfileByTelegramId(
    @Param('telegramId') telegramId: string,
    @Body() body: UpdateProfileDto,
  ) {
    return this.profileService.updateByTelegramId(telegramId, body);
  }
}
