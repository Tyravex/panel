import { NodesService } from '../../nodes.service';
import { OwnershipSnapshotBuilder } from '../ownership-snapshot.builder';
import {
    OwnershipSession,
    OwnershipSessionController,
} from '../ownership-session.controller';

describe('OwnershipSessionController', () => {
    const findAssignedServiceIds = jest.fn();

    let controller: OwnershipSessionController;

    const firstSession: OwnershipSession = {
        nodeId: 'node-1',
        sessionId: 'a'.repeat(32),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        const builder = new OwnershipSnapshotBuilder({
            findAssignedServiceIds,
        } as unknown as NodesService);

        controller = new OwnershipSessionController(builder);
    });

    it('starts revisions at 1 for a new session', async () => {
        findAssignedServiceIds.mockResolvedValue(['service-1']);

        controller.activate(firstSession);

        const message = await controller.build(firstSession);

        expect(message).not.toBeNull();

        const envelope = JSON.parse(message!) as {
            payload: { revision: number; session_id: string };
        };

        expect(envelope.payload.revision).toBe(1);
        expect(envelope.payload.session_id).toBe(firstSession.sessionId);
    });

    it('increments revisions within the same session', async () => {
        findAssignedServiceIds.mockResolvedValue([]);

        controller.activate(firstSession);

        const first = await controller.build(firstSession);
        const second = await controller.build(firstSession);

        expect(JSON.parse(first!).payload.revision).toBe(1);
        expect(JSON.parse(second!).payload.revision).toBe(2);
    });

    it('rejects a snapshot after session revocation', async () => {
        let resolveQuery!: (value: string[]) => void;

        findAssignedServiceIds.mockImplementation(
            () => new Promise<string[]>((resolve) => {
                resolveQuery = resolve;
            }),
        );

        controller.activate(firstSession);

        const pending = controller.build(firstSession);

        controller.revoke(firstSession);

        resolveQuery(['service-1']);

        await expect(pending).resolves.toBeNull();
    });

    it('rejects the old session after reconnect', async () => {
        let resolveQuery!: (value: string[]) => void;

        findAssignedServiceIds
            .mockImplementationOnce(
                () => new Promise<string[]>((resolve) => {
                    resolveQuery = resolve;
                }),
            )
            .mockResolvedValueOnce(['service-2']);

        controller.activate(firstSession);

        const oldBuild = controller.build(firstSession);

        const newSession: OwnershipSession = {
            nodeId: 'node-1',
            sessionId: 'b'.repeat(32),
        };

        controller.activate(newSession);

        const newBuild = await controller.build(newSession);

        resolveQuery(['service-1']);

        expect(await oldBuild).toBeNull();
        expect(JSON.parse(newBuild!).payload.session_id)
            .toBe(newSession.sessionId);
        expect(JSON.parse(newBuild!).payload.revision).toBe(1);
    });

    it('prevents an older build from overtaking a newer one', async () => {
        let resolveOld!: (value: string[]) => void;

        findAssignedServiceIds
            .mockImplementationOnce(
                () => new Promise<string[]>((resolve) => {
                    resolveOld = resolve;
                }),
            )
            .mockResolvedValueOnce(['service-new']);

        controller.activate(firstSession);

        const oldBuild = controller.build(firstSession);
        const newBuild = await controller.build(firstSession);

        resolveOld(['service-old']);

        expect(await oldBuild).toBeNull();
        expect(JSON.parse(newBuild!).payload.revision).toBe(2);
        expect(JSON.parse(newBuild!).payload.assignments).toEqual([
            {
                service_id: 'service-new',
                node_id: 'node-1',
                enabled: true,
            },
        ]);
    });

    it('does not allow an old session to revoke the new one', async () => {
        findAssignedServiceIds.mockResolvedValue([]);

        controller.activate(firstSession);

        const newSession: OwnershipSession = {
            nodeId: 'node-1',
            sessionId: 'b'.repeat(32),
        };

        controller.activate(newSession);
        controller.revoke(firstSession);

        expect(controller.isActive(newSession)).toBe(true);
        expect(await controller.build(newSession)).not.toBeNull();
    });

    it('does not build a snapshot for an inactive session', async () => {
        await expect(
            controller.build(firstSession),
        ).resolves.toBeNull();

        expect(findAssignedServiceIds).not.toHaveBeenCalled();
    });

    it('propagates database failures', async () => {
        findAssignedServiceIds.mockRejectedValue(
            new Error('Database unavailable'),
        );

        controller.activate(firstSession);

        await expect(
            controller.build(firstSession),
        ).rejects.toThrow('Database unavailable');
    });
});
