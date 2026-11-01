import {
    IsNotEmpty,
    IsString,
    IsUrl,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateMarketplaceRepositoryDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(100)
    name!: string;

    @IsString()
    @IsUrl({
        protocols: ['https'],
        require_protocol: true,
        require_tld: true,
    })
    @MaxLength(2048)
    url!: string;
}