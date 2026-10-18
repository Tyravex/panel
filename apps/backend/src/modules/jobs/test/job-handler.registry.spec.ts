import { JobType } from '@prisma/client';
import { JobHandlerRegistry } from '../worker/job-handler.registry';
import { JobHandler } from '../worker/job-handler.interface';

describe('JobHandlerRegistry', () => {
    let registry: JobHandlerRegistry;
    beforeEach(() => { registry = new JobHandlerRegistry(); });

    it('registers and resolves a handler', () => {
        const handler: JobHandler = { type: JobType.INSTALL, execute: jest.fn().mockResolvedValue(undefined) };
        registry.register(handler);
        expect(registry.get(JobType.INSTALL)).toBe(handler);
    });

    it('returns null for an unregistered operation', () => {
        expect(registry.get(JobType.BACKUP)).toBeNull();
    });

    it('rejects duplicate handlers for the same operation', () => {
        registry.register({ type: JobType.INSTALL, execute: jest.fn() });
        expect(() => registry.register({ type: JobType.INSTALL, execute: jest.fn() }))
            .toThrow('Handler already registered for operation INSTALL');
    });

    it('reports missing operation handlers', () => {
        expect(registry.hasAllHandlers()).toBe(false);
        registry.register({ type: JobType.INSTALL, execute: jest.fn() });
        expect(registry.hasAllHandlers()).toBe(false);
    });

    it('reports readiness when every supported operation is registered', () => {
        for (const type of Object.values(JobType)) {
            registry.register({ type, execute: jest.fn().mockResolvedValue(undefined) });
        }
        expect(registry.hasAllHandlers()).toBe(true);
    });
});
