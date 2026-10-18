import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { StatusController } from '../status.controller';
import { StatusService } from '../status.service';

describe('Public status HTTP contract', () => {
    let app: INestApplication;
    const getStatus = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [StatusController],
            providers: [{ provide: StatusService, useValue: { getStatus } }],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterAll(async () => { await app?.close(); });

    beforeEach(() => {
        jest.resetAllMocks();
        getStatus.mockResolvedValue({
            status: 'ok', uptime: 120,
            database: { status: 'ok', latency_ms: 3 },
            cache: { status: 'disabled', latency_ms: 0 },
        });
    });

    it('exposes GET /status without authentication', async () => {
        const response = await request(app.getHttpServer()).get('/status').expect(200);
        expect(response.body).toMatchObject({ status: 'ok', uptime: 120 });
        expect(getStatus).toHaveBeenCalledTimes(1);
    });

    it('exposes GET /status/health without authentication', async () => {
        const response = await request(app.getHttpServer()).get('/status/health').expect(200);
        expect(response.body).toMatchObject({ healthy: true, details: { status: 'ok' } });
    });

    it('marks degraded infrastructure unhealthy', async () => {
        getStatus.mockResolvedValueOnce({
            status: 'degraded', uptime: 120,
            database: { status: 'fail', latency_ms: 0 },
            cache: { status: 'disabled', latency_ms: 0 },
        });
        const response = await request(app.getHttpServer()).get('/status/health').expect(200);
        expect(response.body.healthy).toBe(false);
        expect(response.body.details.database.status).toBe('fail');
    });

    it('does not mutate infrastructure state on public reads', async () => {
        await request(app.getHttpServer()).get('/status').expect(200);
        await request(app.getHttpServer()).get('/status/health').expect(200);
        expect(getStatus).toHaveBeenCalledTimes(2);
    });
});
