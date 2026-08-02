import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum TaskStatusDto {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export enum TaskPriorityDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Configurare mediu de staging' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @ApiPropertyOptional({ description: 'ID-ul proiectului din care face parte (opțional)' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'ID-ul utilizatorului alocat (opțional)' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ enum: TaskStatusDto, default: TaskStatusDto.TODO })
  @IsOptional()
  @IsEnum(TaskStatusDto)
  status?: TaskStatusDto;

  @ApiPropertyOptional({ enum: TaskPriorityDto, default: TaskPriorityDto.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriorityDto)
  priority?: TaskPriorityDto;

  @ApiPropertyOptional({ example: '2026-08-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
