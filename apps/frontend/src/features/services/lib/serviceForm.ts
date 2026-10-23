import type { CreateAdminService } from '@/features/services/api/adminServicesApi';

export interface ServiceFormValues {
    name: string;
    categoryKey: string;
    ownerId: number | null;
    nodeId: string;
    memoryMb: string;
    cpuPercent: string;
    diskMb: string;
}

export const emptyServiceForm = (): ServiceFormValues => ({
    name: '', categoryKey: 'server', ownerId: null, nodeId: '', memoryMb: '', cpuPercent: '', diskMb: '',
});

export type ServiceFormError = 'name' | 'memoryMb' | 'cpuPercent' | 'diskMb';

export class ServiceValidationError extends Error {
    constructor(public readonly field: ServiceFormError) { super(field); }
}

const positiveInteger = (raw: string, field: ServiceFormError, max: number): number | undefined => {
    if (!raw.trim()) return undefined;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new ServiceValidationError(field);
    return value;
};

export const toCreateServicePayload = (form: ServiceFormValues): CreateAdminService => {
    const name = form.name.trim();
    if (!name || name.length > 100) throw new ServiceValidationError('name');
    const memoryMb = positiveInteger(form.memoryMb, 'memoryMb', 1048576);
    const cpuPercent = positiveInteger(form.cpuPercent, 'cpuPercent', 100000);
    const diskMb = positiveInteger(form.diskMb, 'diskMb', 10485760);
    return {
        name, categoryKey: form.categoryKey, userId: form.ownerId,
        ...(form.nodeId ? { nodeId: form.nodeId } : {}),
        ...(memoryMb !== undefined ? { memoryMb } : {}),
        ...(cpuPercent !== undefined ? { cpuPercent } : {}),
        ...(diskMb !== undefined ? { diskMb } : {}),
    };
};

export const serviceFieldClass = 'w-full rounded-xl border border-border-subtle bg-transparent px-4 py-3';
export const serviceSelectClass = `${serviceFieldClass} bg-surface text-text-primary [color-scheme:dark] [&_option]:bg-[#151a27] [&_option]:text-white`;

export const getServiceErrorMessage = (error: unknown, fallback: string): string => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
        const message = response?.data?.message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.join(', ');
    }
    return error instanceof Error ? error.message : fallback;
};
