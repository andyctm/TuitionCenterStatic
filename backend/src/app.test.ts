import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp } from './testUtils/testApp';

describe('createApp', () => {
  it('GET /api/health returns 200 when the DB check succeeds', async () => {
    const checkDb = vi.fn().mockResolvedValue(undefined);
    const { app } = createTestApp({ checkDb });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/health returns 503 when the DB check fails', async () => {
    const checkDb = vi.fn().mockRejectedValue(new Error('connection refused'));
    const { app } = createTestApp({ checkDb });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error' });
  });

  it('reflects Access-Control-Allow-Origin for an allowed origin', async () => {
    const { app } = createTestApp();

    const res = await request(app).get('/api/health').set('Origin', 'https://acme.github.io');

    expect(res.headers['access-control-allow-origin']).toBe('https://acme.github.io');
  });

  it('does not reflect Access-Control-Allow-Origin for a disallowed origin', async () => {
    const { app } = createTestApp();

    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
