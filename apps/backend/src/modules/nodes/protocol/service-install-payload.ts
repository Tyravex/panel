export interface ServiceInstallPayload {
    formatVersion: 1;
    serviceId: string;
    jobId: string;
    nodeId: string;
    egg: {
        id: string;
        key: string;
        version: string;
    };
    runtime: {
        image: string;
        startup: string;
    };
    resources: {
        memoryMb: number;
        cpuPercent: number;
        diskMb: number;
    };
    variables: Array<{
        key: string;
        description?: string;
        required: boolean;
    }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

function hasOnlyKeys(
    value: Record<string, unknown>,
    allowed: readonly string[],
): boolean {
    return Object.keys(value).every((key) => allowed.includes(key));
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
    return (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value > 0
    );
}

export function isServiceInstallPayload(
    value: unknown,
): value is ServiceInstallPayload {
    if (!isRecord(value)) {
        return false;
    }

    if (
        !hasOnlyKeys(value, [
            'formatVersion',
            'serviceId',
            'jobId',
            'nodeId',
            'egg',
            'runtime',
            'resources',
            'variables',
        ]) ||
        value.formatVersion !== 1 ||
        !isNonEmptyString(value.serviceId, 128) ||
        !isNonEmptyString(value.jobId, 128) ||
        !isNonEmptyString(value.nodeId, 128)
    ) {
        return false;
    }

    if (!isRecord(value.egg)) {
        return false;
    }

    if (
        !hasOnlyKeys(value.egg, ['id', 'key', 'version']) ||
        !isNonEmptyString(value.egg.id, 128) ||
        !isNonEmptyString(value.egg.key, 128) ||
        !isNonEmptyString(value.egg.version, 64)
    ) {
        return false;
    }

    if (!isRecord(value.runtime)) {
        return false;
    }

    if (
        !hasOnlyKeys(value.runtime, ['image', 'startup']) ||
        !isNonEmptyString(value.runtime.image, 512) ||
        !isNonEmptyString(value.runtime.startup, 2048)
    ) {
        return false;
    }

    if (!isRecord(value.resources)) {
        return false;
    }

    if (
        !hasOnlyKeys(value.resources, [
            'memoryMb',
            'cpuPercent',
            'diskMb',
        ]) ||
        !isPositiveInteger(value.resources.memoryMb) ||
        !isPositiveInteger(value.resources.cpuPercent) ||
        value.resources.cpuPercent > 100 ||
        !isPositiveInteger(value.resources.diskMb)
    ) {
        return false;
    }

    if (
        !Array.isArray(value.variables) ||
        value.variables.length > 64
    ) {
        return false;
    }

    const keys = new Set<string>();

    for (const variable of value.variables) {
        if (
            !isRecord(variable) ||
            !hasOnlyKeys(variable, [
                'key',
                'description',
                'required',
            ]) ||
            !isNonEmptyString(variable.key, 128) ||
            typeof variable.required !== 'boolean' ||
            (variable.description !== undefined &&
                (typeof variable.description !== 'string' ||
                    variable.description.length > 1024))
        ) {
            return false;
        }

        if (keys.has(variable.key)) {
            return false;
        }

        keys.add(variable.key);
    }

    return true;
}