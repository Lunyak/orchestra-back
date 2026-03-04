import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class SetRoleAssignmentsDto {
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];

  /**
   * Также можно передать роли как строки (названия) и email — сервис создаст/сопоставит роли.
   * Формат: [{ roleTitle, emails }]
   */
  @IsOptional()
  @IsArray()
  roleAssignments?: Array<{ roleTitle: string; emails: string[] }>;
}
