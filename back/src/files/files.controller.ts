import {
    Body,
    Controller,
    Post,
    Query,
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
    // Тип Multer в @types/express@5 отсутствует, поэтому используем any
    @UploadedFile() file: any,
    @Body() body: UploadFileDto,
    @Query() query: Partial<UploadFileDto>,
  ) {
    if (!file) {
      throw new Error('Файл не передан');
    }

    const projectId = body?.projectId ?? query?.projectId;
    const type = body?.type ?? query?.type;
    if (!projectId || !type) {
      throw new Error('projectId и type обязательны');
    }

    const result = await this.storage.uploadObject({
      projectId,
      type,
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

