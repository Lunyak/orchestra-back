import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getMyProfile(@Req() req: any) {
    return this.profileService.getOrCreateByEmail(req.user.email);
  }

  @Patch()
  updateMyProfile(@Req() req: any, @Body() body: UpdateProfileDto) {
    return this.profileService.updateByEmail(req.user.email, body);
  }
}
