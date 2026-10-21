import { PrismaService } from '@/prisma/prisma.service';
import { NodeHeartbeatMonitorService } from '../services/node-heartbeat-monitor.service';

describe('NodeHeartbeatMonitorService', () => {
  let monitor: NodeHeartbeatMonitorService;
  let prisma: {
    node: {
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.useFakeTimers();

    prisma = {
      node: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    monitor = new NodeHeartbeatMonitorService(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    monitor.onModuleDestroy();
    jest.useRealTimers();
  });

  it('marks only stale ONLINE nodes as OFFLINE', async () => {
    jest.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));

    await monitor.expireStaleNodes();

    expect(prisma.node.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'ONLINE',
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: new Date('2026-10-20T11:58:30.000Z') } },
        ],
      },
      data: {
        status: 'OFFLINE',
      },
    });
  });

  it('checks nodes automatically every 30 seconds', async () => {
    monitor.onModuleInit();

    await jest.advanceTimersByTimeAsync(30_000);

    expect(prisma.node.updateMany).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000);

    expect(prisma.node.updateMany).toHaveBeenCalledTimes(2);
  });

  it('does not start duplicate intervals', async () => {
    monitor.onModuleInit();
    monitor.onModuleInit();

    await jest.advanceTimersByTimeAsync(30_000);

    expect(prisma.node.updateMany).toHaveBeenCalledTimes(1);
  });

  it('stops checking after module destruction', async () => {
    monitor.onModuleInit();
    monitor.onModuleDestroy();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(prisma.node.updateMany).not.toHaveBeenCalled();
  });

  it('does not overlap checks while a previous check is running', async () => {
    let finishFirstCheck: ((value: { count: number }) => void) | undefined;

    prisma.node.updateMany.mockImplementationOnce(
      () =>
        new Promise<{ count: number }>((resolve) => {
          finishFirstCheck = resolve;
        }),
    );

    monitor.onModuleInit();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(prisma.node.updateMany).toHaveBeenCalledTimes(1);

    finishFirstCheck?.({ count: 0 });
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(30_000);

    expect(prisma.node.updateMany).toHaveBeenCalledTimes(2);
  });

  it('continues checking after a database error', async () => {
    prisma.node.updateMany
      .mockRejectedValueOnce(new Error('Database temporarily unavailable'))
      .mockResolvedValue({ count: 0 });

    monitor.onModuleInit();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(prisma.node.updateMany).toHaveBeenCalledTimes(2);
  });
});
