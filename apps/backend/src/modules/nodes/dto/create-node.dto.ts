import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateNodeDto {
  @IsOptional()
  @IsBoolean()
  manualAllocationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  automaticAllocationEnabled?: boolean;
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  regionId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  locationId?: string;
}
