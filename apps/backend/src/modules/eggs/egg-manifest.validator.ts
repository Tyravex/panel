import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

const CATEGORIES = new Set([
    'server',
    'discord_bot',
    'telegram_bot',
    'other',
]);

const KEYS = new Set([
    'format',
    'formatVersion',
    'id',
    'name',
    'version',
    'category',
    'description',
    'runtime',
    'resources',
    'variables',
]);

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

function isNonEmptyString(
    value: unknown,
    maxLength: number,
): value is string {
    return (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= maxLength
    );
}

function isPositiveInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) > 0;
}

export interface ValidatedEggManifest {
    key: string;
    name: string;
    description: string | null;
    version: string;
    manifest: Prisma.InputJsonValue;
}

export function validateEggManifest(
    value: unknown,
): ValidatedEggManifest {
    if (!isRecord(value)) {
        throw new BadRequestException('Egg manifest must be an object');
    }

    if (Object.keys(value).some((key) => !KEYS.has(key))) {
        throw new BadRequestException('Unknown egg manifest field');
    }

    if (
        value.format !== 'tyravex-egg' ||
        value.formatVersion !== 1
    ) {
        throw new BadRequestException('Unsupported egg manifest format');
    }

    if (
        !isNonEmptyString(value.id, 100) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)
    ) {
        throw new BadRequestException('Invalid egg identifier');
    }

    if (!isNonEmptyString(value.name, 120)) {
        throw new BadRequestException('Invalid egg name');
    }

    if (
        !isNonEmptyString(value.version, 50) ||
        !/^\d+\.\d+\.\d+$/.test(value.version)
    ) {
        throw new BadRequestException(
            'Egg version must use MAJOR.MINOR.PATCH',
        );
    }

    if (!CATEGORIES.has(String(value.category))) {
        throw new BadRequestException('Unsupported egg category');
    }

    if (
        value.description !== undefined &&
        (typeof value.description !== 'string' ||
            value.description.length > 2000)
    ) {
        throw new BadRequestException('Invalid egg description');
    }

    if (!isRecord(value.runtime)) {
        throw new BadRequestException('Invalid egg runtime');
    }

    const runtimeKeys = Object.keys(value.runtime);

    if (
        runtimeKeys.some(
            (key) => key !== 'image' && key !== 'startup',
        ) ||
        !isNonEmptyString(value.runtime.image, 255) ||
        !isNonEmptyString(value.runtime.startup, 2000)
    ) {
        throw new BadRequestException('Invalid egg runtime configuration');
    }

    if (
        !isRecord(value.resources) ||
        Object.keys(value.resources).some(
            (key) =>
                !['memoryMb', 'cpuPercent', 'diskMb'].includes(key),
        ) ||
        !isPositiveInteger(value.resources.memoryMb) ||
        !isPositiveInteger(value.resources.cpuPercent) ||
        !isPositiveInteger(value.resources.diskMb)
    ) {
        throw new BadRequestException('Invalid egg resources');
    }

    if (
        value.variables !== undefined &&
        (!Array.isArray(value.variables) ||
            value.variables.length > 100 ||
            !value.variables.every(
                (variable: unknown) =>
                    isRecord(variable) &&
                    Object.keys(variable).every((key) =>
                        ['name', 'required', 'secret'].includes(key),
                    ) &&
                    typeof variable.name === 'string' &&
                    /^[A-Z][A-Z0-9_]{0,63}$/.test(variable.name) &&
                    typeof variable.required === 'boolean' &&
                    typeof variable.secret === 'boolean',
            ))
    ) {
        throw new BadRequestException('Invalid egg variables');
    }

    const variables = (value.variables ?? []) as Array<{
        name: string;
    }>;

    if (
        new Set(variables.map((variable) => variable.name)).size !==
        variables.length
    ) {
        throw new BadRequestException('Duplicate egg variable name');
    }

    return {
        key: value.id,
        name: value.name,
        description:
            typeof value.description === 'string'
                ? value.description
                : null,
        version: value.version,
        manifest: value as Prisma.InputJsonValue,
    };
}
