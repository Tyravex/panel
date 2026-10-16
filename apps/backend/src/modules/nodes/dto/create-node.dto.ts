import { IsString, Length } from 'class-validator';

export class CreateNodeDto {
    @IsString()
    @Length(1, 100)
    name!: string;
}