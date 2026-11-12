import { IsOptional, IsString, Length, Matches } from 'class-validator';
import type { CreateRegionRequest } from '@shared/types';

export class CreateRegionDto implements CreateRegionRequest {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  code!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}
