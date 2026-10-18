import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { RegistrationRateLimitStore } from '../registration-rate-limit.store';

@Injectable()
export class RegistrationRateLimitGuard implements CanActivate {
    constructor(private readonly store: RegistrationRateLimitStore) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();
        // Use the socket address; do not trust user-supplied forwarding headers.
        const ip = request.socket?.remoteAddress ?? 'unknown';
        const result = await this.store.consume(ip);
        if (!result.allowed) {
            response.setHeader('Retry-After', String(result.retryAfter));
            throw new HttpException('Too many registration attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
        }
        return true;
    }
}
