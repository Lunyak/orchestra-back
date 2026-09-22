import { Controller, Get, Header, Headers, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { contentTypeForFileName } from '../files/file-content-type';
import { sendLocalFileWithRange } from '../files/http-range';
import { DesktopReleasesService } from './desktop-releases.service';

@Controller('desktop-releases')
export class DesktopReleasesController {
  constructor(private readonly releases: DesktopReleasesService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async list() {
    return this.releases.list();
  }

  @Get(':version/:fileName')
  async download(
    @Param('version') version: string,
    @Param('fileName') fileName: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ) {
    const file = await this.releases.resolveArtifact(version, fileName);
    if (!file) {
      res.status(404).json({ statusCode: 404, message: 'Сборка не найдена' });
      return;
    }

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    sendLocalFileWithRange({
      res,
      filePath: file.filePath,
      size: file.size,
      contentType: contentTypeForFileName(file.fileName),
      rangeHeader: range,
    });
  }
}
