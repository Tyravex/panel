import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const MAX_TRACKED_IPS = 10000;

type Bucket = { count: number; expiresAt: number };

@Injectable()
export class RegistrationRateLimitGuard implements CanActivate {
    private readonly buckets = new Map<string, Bucket>();

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();
        const now = Date.now();
        // Use the socket address; do not trust user-controlled forwarding headers.
        const ip = request.socket?.remoteAddress ?? request.ip ?? 'unknown';
        let bucket = this.buckets.get(ip);

        if (!bucket || now >= bucket.expiresAt) {
            // Bound memory usage even if an attacker rotates source addresses.
            if (this.buckets.size >= MAX_TRACKED_IPS) {
                for (const [key, value] of this.buckets) {
                    if (now >= value.expiresAt) this.buckets.delete(key);
                }
                if (this.buckets.size >= MAX_TRACKED_IPS) {
                    // Fail closed when tracking capacity is exhausted.
                    response.setHeader('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
                    throw new HttpException('Too many registration attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
                }
            }
            bucket = { count: 0, expiresAt: now + WINDOW_MS };
            this.buckets.set(ip, bucket);
        }

        if (bucket.count >= MAX_ATTEMPTS) {
            response.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000))));
            throw new HttpException('Too many registration attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
        }

        bucket.count += 1;
        return true;
    }
}
