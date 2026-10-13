import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  usernameOrEmail!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}
