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
import { GetStepNoteDto } from './dto/get-step-note.dto';
import { UpsertStepNoteDto } from './dto/upsert-step-note.dto';
import { ListAnnotationsDto } from './dto/list-annotations.dto';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { UpdateAnnotationDto } from './dto/update-annotation.dto';
import { ActorNotesService } from './actor-notes.service';
import type { ActorAnnotationField } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('actor-notes')
export class ActorNotesController {
  constructor(private readonly actorNotes: ActorNotesService) {}

  @Get('step')
  getStep(@Req() req: any, @Query() query: GetStepNoteDto) {
    return this.actorNotes.getStepNote(
      req.user.userId,
      query.projectSlug,
      query.sceneName,
      query.stepId,
    );
  }

  @Put('step')
  upsertStep(@Req() req: any, @Body() body: UpsertStepNoteDto) {
    return this.actorNotes.upsertStepNote(
      req.user.userId,
      body.projectSlug,
      body.sceneName,
      body.stepId,
      body.text,
    );
  }

  @Delete('step')
  deleteStep(@Req() req: any, @Query() query: GetStepNoteDto) {
    return this.actorNotes.deleteStepNote(
      req.user.userId,
      query.projectSlug,
      query.sceneName,
      query.stepId,
    );
  }

  @Get('annotations')
  listAnnotations(@Req() req: any, @Query() query: ListAnnotationsDto) {
    return this.actorNotes.listAnnotations(
      req.user.userId,
      query.projectSlug,
      query.sceneName,
      query.stepId,
      query.field as ActorAnnotationField,
    );
  }

  @Post('annotations')
  createAnnotation(@Req() req: any, @Body() body: CreateAnnotationDto) {
    return this.actorNotes.createAnnotation(
      req.user.userId,
      body.projectSlug,
      body.sceneName,
      body.stepId,
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

