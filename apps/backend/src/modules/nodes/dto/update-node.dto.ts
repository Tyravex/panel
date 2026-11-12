import { IsBoolean, IsString, Length, ValidateIf } from 'class-validator';

export class UpdateNodeDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  manualAllocationEnabled?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  automaticAllocationEnabled?: boolean;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 100)
  regionId?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 100)
  locationId?: string | null;
}
