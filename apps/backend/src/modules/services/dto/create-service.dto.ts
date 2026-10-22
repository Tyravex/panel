import { IsInt, IsOptional, IsString, Length, Max, Min, ValidateIf } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Length(1, 100)
  categoryKey!: string;

  // Omitted or null means the service remains unassigned.
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  userId?: number | null;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  nodeId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1048576)
  memoryMb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  cpuPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10485760)
  diskMb?: number;
}
