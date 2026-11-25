import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/index.js';

const config = loadConfig({
  NODE_ENV: 'test',
  PUBLIC_URL: 'http://localhost:3000',
});
const app = createApp(config);

test('GET /health responde 200 só com o status', async () => {
  const res = await request(app).get('/health');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('GET /health não pode ser guardado em cache', async () => {
  const res = await request(app).get('/health');

  assert.equal(res.headers['cache-control'], 'no-store');
});

test('respostas não anunciam o Express', async () => {
  const res = await request(app).get('/health');

  assert.equal(res.headers['x-powered-by'], undefined);
});

test('rota inexistente responde 404 genérico', async () => {
  const res = await request(app).get('/qualquer-coisa');

  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { erro: 'Não encontrado' });
});

test('/health só aceita GET', async () => {
  const res = await request(app).post('/health');

  assert.equal(res.status, 404);
});