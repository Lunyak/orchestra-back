import { Module } from '@nestjs/common';
import { ActorNotesController } from './actor-notes.controller';
import { ActorNotesService } from './actor-notes.service';

@Module({
  providers: [ActorNotesService],
  controllers: [ActorNotesController],
})
export class ActorNotesModule {}

