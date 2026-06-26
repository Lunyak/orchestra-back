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

export type SyncEntityType =
  | 'Project'
  | 'Playbook'
  | 'Scene'
  | 'PlaylistItem'
  | 'Sound'
  | 'GlobalLightChannel'
  | 'TheaterLayout';

export class SyncChangeDto {
  @IsString()
  id: string;

  @IsIn([
    'Project',
    'Playbook',
    'Scene',
    'Step',
    'PlaylistItem',
    'Sound',
    'GlobalLightChannel',
    'TheaterLayout',
  ])
  entityType: SyncEntityType | 'Step';

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

  /**
   * Подтверждение опасных операций (массовое удаление, сброс сцены, удаление проекта).
   * Должно совпадать с названием или slug проекта.
   */
  @IsOptional()
  @IsString()
  destructiveConfirm?: string;
}

export class SyncPullDto {
  @IsOptional()
  @IsString()
  lastSyncAt: string | null;

  /** Если задан — вернуть только данные этого проекта (по slug). */
  @IsOptional()
  @IsString()
  projectSlug?: string;

  /**
   * Управляет тем, какие "тяжелые" или legacy данные включать в ответ.
   * По умолчанию (если не передано) возвращаем только projects/playbooks и без тяжелых таблиц.
   */
  @IsOptional()
  @IsObject()
  include?: {
    scenes?: boolean;
    playlist?: boolean;
    sounds?: boolean;
    lightChannels?: boolean;
    theaterLayout?: boolean;
  };
}

export class SyncPullSceneDto {
  @IsString()
  projectSlug: string;

  @IsString()
  sceneName: string;

  @IsOptional()
  @IsObject()
  include?: {
    scenes?: boolean;
    playlist?: boolean;
    sounds?: boolean;
    lightChannels?: boolean;
    theaterLayout?: boolean;
  };
}
