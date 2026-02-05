import {
    Body,
    Controller,
    Post,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileStorageService } from './file-storage.service';

export class UploadFileDto {
  projectId: string;
  type: 'playlist' | 'image' | 'sound' | 'model';
}

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly storage: FileStorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
  ) {
    if (!file) {
      throw new Error('Файл не передан');
    }

    const result = await this.storage.uploadObject({
      projectId: body.projectId,
      type: body.type,
      fileName: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return {
      key: result.key,
      url: result.url,
    };
  }
}

