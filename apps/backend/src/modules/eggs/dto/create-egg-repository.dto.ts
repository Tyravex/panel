import {
    IsNotEmpty,
    IsString,
    IsUrl,
    MaxLength,
} from 'class-validator';

export class CreateEggRepositoryDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name!: string;

    @IsUrl({
        protocols: ['https'],
        require_protocol: true,
        require_tld: true,
    })
    @MaxLength(2048)
    url!: string;
}
