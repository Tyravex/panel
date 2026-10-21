import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const HEARTBEAT_TIMEOUT_MS = 90_000;
const STATUS_CHECK_INTERVAL_MS = 30_000;

@Injectable()
export class NodeHeartbeatMonitorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NodeHeartbeatMonitorService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (this.timer !== null) return;

    this.timer = setInterval(() => {
      void this.checkStaleNodes();
    }, STATUS_CHECK_INTERVAL_MS);

    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async expireStaleNodes(): Promise<void> {
    const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);

    await this.prisma.node.updateMany({
      where: {
        status: 'ONLINE',
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }],
      },
      data: {
        status: 'OFFLINE',
      },
    });
  }

  private async checkStaleNodes(): Promise<void> {
    if (this.running) return;

    this.running = true;

    try {
      await this.expireStaleNodes();
    } catch (error) {
      this.logger.error(
        'Failed to check stale node heartbeats',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
