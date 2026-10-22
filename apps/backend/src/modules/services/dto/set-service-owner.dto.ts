import { IsInt, Min, ValidateIf } from 'class-validator';

export class SetServiceOwnerDto {
  // Explicit null unassigns the service. Missing values are rejected by the service.
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  userId!: number | null;
}
