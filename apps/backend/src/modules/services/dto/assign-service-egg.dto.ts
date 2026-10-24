import { IsString, IsNotEmpty } from 'class-validator';

export class AssignServiceEggDto {
    @IsString()
    @IsNotEmpty()
    eggId!: string;
}
