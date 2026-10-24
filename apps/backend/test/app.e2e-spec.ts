import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';

describe('Status API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /status returns application status', async () => {
    const response = await request(app.getHttpServer())
      .get('/status')
      .expect(200);

    expect(response.body).toEqual({
      status: expect.stringMatching(/^(ok|degraded)$/),
      uptime: expect.any(Number),
      database: {
        status: expect.stringMatching(/^(ok|fail)$/),
        latency_ms: expect.any(Number),
      },
      cache: {
        status: expect.stringMatching(/^(ok|fail|disabled)$/),
        latency_ms: expect.any(Number),
      },
    });
  });

  it('GET /status/health returns health details', async () => {
    const response = await request(app.getHttpServer())
      .get('/status/health')
      .expect(200);

    expect(response.body).toEqual({
      healthy: expect.any(Boolean),
      details: {
        status: expect.stringMatching(/^(ok|degraded)$/),
        uptime: expect.any(Number),
        database: expect.any(Object),
        cache: expect.any(Object),
      },
    });

    expect(response.body.healthy).toBe(
      response.body.details.status === 'ok',
    );
  });
});
