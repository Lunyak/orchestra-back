import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetSceneNoteDto } from './dto/get-scene-note.dto';
import { UpsertSceneNoteDto } from './dto/upsert-scene-note.dto';
import { ListAnnotationsDto } from './dto/list-annotations.dto';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { UpdateAnnotationDto } from './dto/update-annotation.dto';
import { ActorNotesService } from './actor-notes.service';
import type { ActorAnnotationField } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('actor-notes')
export class ActorNotesController {
  constructor(private readonly actorNotes: ActorNotesService) {}

  @Get('scene')
  getScene(@Req() req: any, @Query() query: GetSceneNoteDto) {
    return this.actorNotes.getSceneNote(
      req.user.userId,
      query.projectSlug,
      query.sceneName,
      query.sceneId,
    );
  }

  @Put('scene')
  upsertScene(@Req() req: any, @Body() body: UpsertSceneNoteDto) {
    return this.actorNotes.upsertSceneNote(
      req.user.userId,
      body.projectSlug,
      body.sceneName,
      body.sceneId,
      body.text,
    );
  }

  @Delete('scene')
  deleteScene(@Req() req: any, @Query() query: GetSceneNoteDto) {
    return this.actorNotes.deleteSceneNote(
      req.user.userId,
      query.projectSlug,
      query.sceneName,
      query.sceneId,
    );
  }

  @Get('annotations')
  listAnnotations(@Req() req: any, @Query() query: ListAnnotationsDto) {
    return this.actorNotes.listAnnotations(
      req.user.userId,
      query.projectSlug,
      query.sceneName,
      query.sceneId,
      query.field as ActorAnnotationField,
    );
  }

  @Post('annotations')
  createAnnotation(@Req() req: any, @Body() body: CreateAnnotationDto) {
    return this.actorNotes.createAnnotation(
      req.user.userId,
      body.projectSlug,
      body.sceneName,
      body.sceneId,
      body.field as ActorAnnotationField,
      body.startOffset,
      body.endOffset,
      body.selectedText,
      body.noteText,
    );
  }

  @Patch('annotations/:id')
  updateAnnotation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateAnnotationDto,
  ) {
    return this.actorNotes.updateAnnotation(req.user.userId, id, {
      noteText: body.noteText,
    });
  }

  @Delete('annotations/:id')
  deleteAnnotation(@Req() req: any, @Param('id') id: string) {
    return this.actorNotes.deleteAnnotation(req.user.userId, id);
  }
}
