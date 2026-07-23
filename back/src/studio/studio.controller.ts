import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateStudioDto } from './dto/create-studio.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { ReviewLessonProgressDto } from './dto/review-lesson-progress.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { SubmitLessonDto } from './dto/submit-lesson.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { UpdateStudioDto } from './dto/update-studio.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { StudioService } from './studio.service';

@UseGuards(JwtAuthGuard)
@Controller('studios')
export class StudioController {
  constructor(private readonly studio: StudioService) {}

  @Get()
  list(@Req() req: any) {
    return this.studio.listStudios(req.user.userId, req.user.email);
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateStudioDto) {
    return this.studio.createStudio(req.user.userId, req.user.email, body);
  }

  @Get('invites/:token')
  previewInvite(@Req() req: any, @Param('token') token: string) {
    return this.studio.previewInvite(req.user.userId, req.user.email, token);
  }

  @Post('invites/:token/accept')
  acceptInvite(@Req() req: any, @Param('token') token: string) {
    return this.studio.acceptInvite(req.user.userId, req.user.email, token);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.studio.getStudio(req.user.userId, req.user.email, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateStudioDto,
  ) {
    return this.studio.updateStudio(req.user.userId, req.user.email, id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.studio.deleteStudio(req.user.userId, req.user.email, id);
  }

  @Post(':id/members')
  addMember(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: AddMemberDto,
  ) {
    return this.studio.addMember(req.user.userId, req.user.email, id, body);
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberDto,
  ) {
    return this.studio.updateMember(
      req.user.userId,
      req.user.email,
      id,
      memberId,
      body,
    );
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.studio.removeMember(
      req.user.userId,
      req.user.email,
      id,
      memberId,
    );
  }

  @Post(':id/invites')
  createInvite(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CreateInviteDto,
  ) {
    return this.studio.createInvite(req.user.userId, req.user.email, id, body);
  }

  @Get(':id/invites')
  listInvites(@Req() req: any, @Param('id') id: string) {
    return this.studio.listInvites(req.user.userId, req.user.email, id);
  }

  @Delete(':id/invites/:inviteId')
  revokeInvite(
    @Req() req: any,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.studio.revokeInvite(
      req.user.userId,
      req.user.email,
      id,
      inviteId,
    );
  }

  @Post(':id/modules')
  createModule(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CreateModuleDto,
  ) {
    return this.studio.createModule(req.user.userId, req.user.email, id, body);
  }

  @Patch(':id/modules/:moduleId')
  updateModule(
    @Req() req: any,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Body() body: UpdateModuleDto,
  ) {
    return this.studio.updateModule(
      req.user.userId,
      req.user.email,
      id,
      moduleId,
      body,
    );
  }

  @Delete(':id/modules/:moduleId')
  deleteModule(
    @Req() req: any,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.studio.deleteModule(
      req.user.userId,
      req.user.email,
      id,
      moduleId,
    );
  }

  @Post(':id/modules/:moduleId/lessons')
  createLesson(
    @Req() req: any,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Body() body: CreateLessonDto,
  ) {
    return this.studio.createLesson(
      req.user.userId,
      req.user.email,
      id,
      moduleId,
      body,
    );
  }

  @Patch(':id/modules/:moduleId/lessons/:lessonId')
  updateLesson(
    @Req() req: any,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: UpdateLessonDto,
  ) {
    return this.studio.updateLesson(
      req.user.userId,
      req.user.email,
      id,
      moduleId,
      lessonId,
      body,
    );
  }

  @Delete(':id/modules/:moduleId/lessons/:lessonId')
  deleteLesson(
    @Req() req: any,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.studio.deleteLesson(
      req.user.userId,
      req.user.email,
      id,
      moduleId,
      lessonId,
    );
  }

  @Get(':id/modules/:moduleId/lessons/:lessonId')
  getLesson(
    @Req() req: any,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.studio.getLesson(
      req.user.userId,
      req.user.email,
      id,
      moduleId,
      lessonId,
    );
  }

  @Post(':id/modules/:moduleId/lessons/:lessonId/submit')
  submitLesson(
    @Req() req: any,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: SubmitLessonDto,
  ) {
    return this.studio.submitLesson(
      req.user.userId,
      req.user.email,
      id,
      moduleId,
      lessonId,
      body,
    );
  }

  @Patch(':id/modules/:moduleId/lessons/:lessonId/progress/:progressId')
  reviewLessonProgress(
    @Req() req: any,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
    @Param('progressId') progressId: string,
    @Body() body: ReviewLessonProgressDto,
  ) {
    return this.studio.reviewLessonProgress(
      req.user.userId,
      req.user.email,
      id,
      moduleId,
      lessonId,
      progressId,
      body,
    );
  }

  @Post(':id/assignments')
  createAssignment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CreateAssignmentDto,
  ) {
    return this.studio.createAssignment(
      req.user.userId,
      req.user.email,
      id,
      body,
    );
  }

  @Get(':id/assignments')
  listAssignments(@Req() req: any, @Param('id') id: string) {
    return this.studio.listAssignments(req.user.userId, req.user.email, id);
  }

  @Get(':id/assignments/:assignmentId')
  getAssignment(
    @Req() req: any,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.studio.getAssignment(
      req.user.userId,
      req.user.email,
      id,
      assignmentId,
    );
  }

  @Patch(':id/assignments/:assignmentId')
  updateAssignment(
    @Req() req: any,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: UpdateAssignmentDto,
  ) {
    return this.studio.updateAssignment(
      req.user.userId,
      req.user.email,
      id,
      assignmentId,
      body,
    );
  }

  @Delete(':id/assignments/:assignmentId')
  deleteAssignment(
    @Req() req: any,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.studio.deleteAssignment(
      req.user.userId,
      req.user.email,
      id,
      assignmentId,
    );
  }

  @Post(':id/assignments/:assignmentId/submit')
  submitAssignment(
    @Req() req: any,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: SubmitAssignmentDto,
  ) {
    return this.studio.submitAssignment(
      req.user.userId,
      req.user.email,
      id,
      assignmentId,
      body,
    );
  }

  @Post(':id/assignments/:assignmentId/submissions/:submissionId/grade')
  gradeSubmission(
    @Req() req: any,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: GradeSubmissionDto,
  ) {
    return this.studio.gradeSubmission(
      req.user.userId,
      req.user.email,
      id,
      assignmentId,
      submissionId,
      body,
    );
  }

  @Post(':id/videos')
  createVideo(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CreateVideoDto,
  ) {
    return this.studio.createVideo(req.user.userId, req.user.email, id, body);
  }

  @Get(':id/videos')
  listVideos(@Req() req: any, @Param('id') id: string) {
    return this.studio.listVideos(req.user.userId, req.user.email, id);
  }

  @Get(':id/videos/:videoId')
  getVideo(
    @Req() req: any,
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    return this.studio.getVideo(req.user.userId, req.user.email, id, videoId);
  }

  @Patch(':id/videos/:videoId')
  updateVideo(
    @Req() req: any,
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @Body() body: UpdateVideoDto,
  ) {
    return this.studio.updateVideo(
      req.user.userId,
      req.user.email,
      id,
      videoId,
      body,
    );
  }

  @Delete(':id/videos/:videoId')
  deleteVideo(
    @Req() req: any,
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    return this.studio.deleteVideo(
      req.user.userId,
      req.user.email,
      id,
      videoId,
    );
  }

  @Post(':id/videos/:videoId/markers')
  createMarker(
    @Req() req: any,
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @Body() body: CreateMarkerDto,
  ) {
    return this.studio.createMarker(
      req.user.userId,
      req.user.email,
      id,
      videoId,
      body,
    );
  }

  @Patch(':id/videos/:videoId/markers/:markerId')
  updateMarker(
    @Req() req: any,
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @Param('markerId') markerId: string,
    @Body() body: UpdateMarkerDto,
  ) {
    return this.studio.updateMarker(
      req.user.userId,
      req.user.email,
      id,
      videoId,
      markerId,
      body,
    );
  }

  @Delete(':id/videos/:videoId/markers/:markerId')
  deleteMarker(
    @Req() req: any,
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @Param('markerId') markerId: string,
  ) {
    return this.studio.deleteMarker(
      req.user.userId,
      req.user.email,
      id,
      videoId,
      markerId,
    );
  }
}
