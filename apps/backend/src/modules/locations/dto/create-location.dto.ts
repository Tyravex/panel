import {
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import type { CreateLocationRequest } from '@shared/types';

export class CreateLocationDto implements CreateLocationRequest {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  code!: string;

  @IsString()
  @Length(2, 100)
  continent!: string;

  @IsString()
  @Length(2, 100)
  country!: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 100)
  state?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 100)
  city?: string | null;

  @IsString()
  @Length(1, 100)
  regionId!: string;
}
