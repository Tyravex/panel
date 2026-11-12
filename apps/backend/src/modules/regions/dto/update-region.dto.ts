import {
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import type { UpdateRegionRequest } from '@shared/types';

export class UpdateRegionDto implements UpdateRegionRequest {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  code?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Length(0, 500)
  description?: string | null;
}
