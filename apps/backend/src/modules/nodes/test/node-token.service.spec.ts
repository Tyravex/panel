import { NodeTokenService } from '../node-token.service';

describe('NodeTokenService', () => {
    let service: NodeTokenService;

    beforeEach(() => {
        service = new NodeTokenService();
    });

    it('generates unique 256-bit tokens', () => {
        const first = service.generateToken();
        const second = service.generateToken();

        expect(first).toMatch(/^[a-f0-9]{64}$/);
        expect(second).toMatch(/^[a-f0-9]{64}$/);
        expect(first).not.toBe(second);
    });

    it('hashes tokens without storing plaintext', () => {
        const token = service.generateToken();
        const hash = service.hashToken(token);

        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        expect(hash).not.toBe(token);
        expect(service.verifyToken(token, hash)).toBe(true);
    });

    it('rejects incorrect tokens', () => {
        const token = service.generateToken();
        const otherToken = service.generateToken();
        const hash = service.hashToken(token);

        expect(service.verifyToken(otherToken, hash)).toBe(false);
    });

    it('rejects malformed stored hashes', () => {
        const token = service.generateToken();

        expect(service.verifyToken(token, '')).toBe(false);
        expect(service.verifyToken(token, 'invalid')).toBe(false);
        expect(service.verifyToken(token, 'z'.repeat(64))).toBe(false);
    });
});
