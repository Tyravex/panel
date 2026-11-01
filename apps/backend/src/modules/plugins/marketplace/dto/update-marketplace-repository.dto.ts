import {
    IsEnum,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

import type { MarketplaceRepositoryStatus } from '@shared/types';

export class UpdateMarketplaceRepositoryDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsEnum(['ENABLED', 'DISABLED'])
    status?: MarketplaceRepositoryStatus;
}