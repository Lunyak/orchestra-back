import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncEntityType = 'Project' | 'Scene' | 'Step';

export class SyncChangeDto {
  @IsString()
  id: string;

  @IsIn(['Project', 'Scene', 'Step'])
  entityType: SyncEntityType;

  @IsString()
  entityId: string;

  @IsIn(['create', 'update', 'delete'])
  operation: SyncOperation;

  // payload может быть любым объектом, но должен присутствовать
  @IsObject()
  @Type(() => Object)
  payload: any;

  @IsString()
  createdAt: string;
}

export class SyncPushDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncChangeDto)
  changes: SyncChangeDto[];
}

export class SyncPullDto {
  @IsOptional()
  @IsString()
  lastSyncAt: string | null;

  /** Если задан — вернуть только данные этого проекта (по slug). */
  @IsOptional()
  @IsString()
  projectSlug?: string;
}
