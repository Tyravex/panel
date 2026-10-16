import { IsEnum, IsInt, Min } from 'class-validator';
import { JobType } from '@prisma/client';

export class CreateJobDto {
  // Only supported operation types can be requested by the client.
  @IsEnum(JobType)
  type!: JobType;

  // Every currently supported job must target an existing server.
  // The service verifies access using the authenticated user's role.
  @IsInt()
  @Min(1)
  serverId!: number;
}