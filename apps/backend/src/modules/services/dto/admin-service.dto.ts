import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CreateServiceDto } from './create-service.dto';

export class CreateAdminServiceDto extends CreateServiceDto {
  @IsOptional() @IsString() @Length(1, 100) eggId?: string;
  @IsOptional() @IsString() @Length(0, 64) profileId?: string;
  @IsOptional() @IsString() @Length(0, 20) runtimeVersion?: string;
}

export class UpdateAdminServiceDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsString() @Length(1, 100) categoryKey?: string;
  @IsOptional() @IsString() @Length(1, 100) nodeId?: string | null;
  @IsOptional() @IsString() @Length(1, 100) eggId?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(1048576) memoryMb?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) cpuPercent?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10485760) diskMb?: number;
  @IsOptional() @IsString() expectedUpdatedAt?: string;
  @IsOptional() @IsString() @Length(0, 64) profileId?: string;
  @IsOptional() @IsString() @Length(0, 20) runtimeVersion?: string;
}
