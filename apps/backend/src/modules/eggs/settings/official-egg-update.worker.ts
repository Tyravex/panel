import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OfficialEggUpdateService } from './official-egg-update.service';

@Injectable()
export class OfficialEggUpdateWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfficialEggUpdateWorker.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private stopped = false;
  constructor(private readonly updates: OfficialEggUpdateService) {}
  onModuleInit() {
    this.stopped = false;
    this.timer = setInterval(() => void this.tick(), 60000);
    this.timer.unref();
  }
  async tick() {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try { await this.updates.tick(() => !this.stopped); }
    catch { this.logger.warn('Official Egg update check failed; see repository status.'); }
    finally { this.busy = false; }
  }
  onModuleDestroy() { this.stopped = true; if (this.timer) clearInterval(this.timer); }
}
