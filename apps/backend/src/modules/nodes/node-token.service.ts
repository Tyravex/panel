import { Injectable } from '@nestjs/common';
import {
    createHash,
    randomBytes,
    timingSafeEqual,
} from 'node:crypto';

@Injectable()
export class NodeTokenService {
    // Generate a cryptographically secure, 256-bit agent token.
    generateToken(): string {
        return randomBytes(32).toString('hex');
    }

    // Store only the hash of the token in PostgreSQL.
    hashToken(token: string): string {
        return createHash('sha256')
            .update(token, 'utf8')
            .digest('hex');
    }

    // Compare hashes in constant time.
    verifyToken(token: string, storedHash: string): boolean {
        if (
            typeof token !== 'string' ||
            typeof storedHash !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(storedHash)
        ) {
            return false;
        }

        const actualHash = Buffer.from(
            this.hashToken(token),
            'hex',
        );

        const expectedHash = Buffer.from(
            storedHash,
            'hex',
        );

        return timingSafeEqual(actualHash, expectedHash);
    }
}