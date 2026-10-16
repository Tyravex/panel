import {
    IsInt,
    IsString,
    Length,
    Min,
} from 'class-validator';

export class CreateServerDto {
    @IsString()
    @Length(1, 100)
    name!: string;

    @IsInt()
    @Min(1)
    userId!: number;
}