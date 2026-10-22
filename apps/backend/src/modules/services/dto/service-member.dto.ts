import { ArrayUnique, IsArray, IsIn, IsInt, Min } from 'class-validator';
import { SERVICE_PERMISSIONS } from '../service-permissions';

export class SetServiceMemberDto {
  @IsInt()
  @Min(1)
  userId!: number;

  @IsArray()
  @ArrayUnique()
  @IsIn([...SERVICE_PERMISSIONS], { each: true })
  permissions!: string[];
}

export class UpdateServiceMemberDto {
  @IsArray()
  @ArrayUnique()
  @IsIn([...SERVICE_PERMISSIONS], { each: true })
  permissions!: string[];
}
