import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { JobType } from '@prisma/client';

export class CreateJobDto {
  // Only supported operation types can be requested by the client.
  @IsEnum(JobType)
  type!: JobType;

  // The server is optional for future account-level operations.
  // When provided, the service must verify that it belongs to the user.
  @IsOptional()
  @IsInt()
  @Min(1)
  serverId?: number;
}