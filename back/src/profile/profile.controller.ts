import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Защищенные эндпоинты (требуют JWT)
  @UseGuards(JwtAuthGuard)
  @Get()
  getMyProfile(@Req() req: any) {
    return this.profileService.getOrCreateByEmail(req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  updateMyProfile(@Req() req: any, @Body() body: UpdateProfileDto) {
    return this.profileService.updateByEmail(req.user.email, body);
  }

  // Публичные эндпоинты для бота (работают по telegramId)
  @Get('telegram/:telegramId')
  getProfileByTelegramId(@Param('telegramId') telegramId: string) {
    return this.profileService.getByTelegramId(telegramId);
  }

  @Post('telegram/:telegramId')
  createProfileByTelegramId(
    @Param('telegramId') telegramId: string,
    @Body() body: UpdateProfileDto
  ) {
    return this.profileService.createByTelegramId(telegramId, body);
  }

  @Patch('telegram/:telegramId')
  updateProfileByTelegramId(
    @Param('telegramId') telegramId: string,
    @Body() body: UpdateProfileDto
  ) {
    return this.profileService.updateByTelegramId(telegramId, body);
  }
}
