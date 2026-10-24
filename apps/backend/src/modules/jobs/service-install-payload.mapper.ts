import {
    isServiceInstallPayload,
    ServiceInstallPayload,
} from '../nodes/protocol/service-install-payload';

interface InstallJobSource {
    id: string;
    serviceId: string | null;
    type: string;
    installConfig: unknown;
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
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
    return Object.keys(value).every((key) =>
        allowed.includes(key),
    );
}

export function mapServiceInstallPayload(
    job: InstallJobSource,
    expectedNodeId: string,
): ServiceInstallPayload {
    if (
        job.type !== 'INSTALL' ||
        !job.serviceId?.trim() ||
        !expectedNodeId.trim()
    ) {
        throw new Error('Invalid service installation job');
    }

    const config = job.installConfig;

    if (
        !isRecord(config) ||
        !hasOnlyKeys(config, [
            'formatVersion',
            'egg',
            'nodeId',
            'runtime',
            'resources',
            'variables',
        ]) ||
        config.formatVersion !== 1 ||
        config.nodeId !== expectedNodeId ||
        !isRecord(config.egg) ||
        !isRecord(config.runtime) ||
        !isRecord(config.resources) ||
        !Array.isArray(config.variables) ||
        config.variables.length > 64
    ) {
        throw new Error('Invalid installation snapshot');
    }

    const variables: Array<{
        key: string;
        required: boolean;
    }> = [];

    for (const variable of config.variables) {
        if (
            !isRecord(variable) ||
            !hasOnlyKeys(variable, [
                'name',
                'required',
                'secret',
            ]) ||
            typeof variable.name !== 'string' ||
            typeof variable.required !== 'boolean' ||
            typeof variable.secret !== 'boolean'
        ) {
            throw new Error('Invalid installation variable metadata');
        }

        variables.push({
            key: variable.name,
            required: variable.required,
        });
    }

    const payload: unknown = {
        formatVersion: config.formatVersion,
        serviceId: job.serviceId,
        jobId: job.id,
        nodeId: config.nodeId,
        egg: config.egg,
        runtime: config.runtime,
        resources: config.resources,
        variables,
    };

    if (!isServiceInstallPayload(payload)) {
        throw new Error('Invalid service installation payload');
    }

    return payload;
}