import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/index.js';

const PUBLIC_URL = 'http://localhost:3000';

const app = createApp(
  loadConfig({
    NODE_ENV: 'test',
    PUBLIC_URL,
    CSRF_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
  }),
);

// Abre o /login e devolve o token que veio escondido no formulário
async function abrirLogin(agent) {
  const res = await agent.get('/login');
  const encontrado = res.text.match(/name="_csrf" value="([^"]+)"/);
  return { res, token: encontrado?.[1] };
}

// Envia o formulário como o navegador faz
function enviar(cliente, campos, origin = PUBLIC_URL) {
  const req = cliente.post('/login').type('form');
  if (origin) req.set('Origin', origin);
  return req.send(campos);
}

test('GET /login entrega formulário com token e cookie protegido', async () => {
  const agent = request.agent(app);
  const { res, token } = await abrirLogin(agent);

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.ok(token, 'formulário sem token _csrf');

  const cookie = res.headers['set-cookie'].join(';');
  assert.match(cookie, /csrf=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
});

test('POST com cookie, token e origem corretos passa pelo CSRF', async () => {
  const agent = request.agent(app);
  const { token } = await abrirLogin(agent);

  const res = await enviar(agent, { _csrf: token, usuario: 'teste', senha: 'x' });

  assert.equal(res.status, 501); // a autenticação no AD entra na E2-03
});

test('POST sem token é recusado', async () => {
  const agent = request.agent(app);
  await abrirLogin(agent);

  const res = await enviar(agent, { usuario: 'teste', senha: 'x' });

  assert.equal(res.status, 403);
});

test('POST sem o cookie é recusado, mesmo com token válido', async () => {
  const { token } = await abrirLogin(request.agent(app));

  // request(app) é um cliente novo, sem o cookie do GET
  const res = await enviar(request(app), { _csrf: token, usuario: 'teste', senha: 'x' });

  assert.equal(res.status, 403);
});

test('POST de outra origem é recusado, mesmo com token válido', async () => {
  const agent = request.agent(app);
  const { token } = await abrirLogin(agent);

  const res = await enviar(agent, { _csrf: token, usuario: 'teste', senha: 'x' }, 'http://evil.example');

  assert.equal(res.status, 403);
});

test('POST sem cabeçalho Origin é recusado', async () => {
  const agent = request.agent(app);
  const { token } = await abrirLogin(agent);

  const res = await enviar(agent, { _csrf: token, usuario: 'teste', senha: 'x' }, null);

  assert.equal(res.status, 403);
});

test('recusa devolve formulário novo, pronto para tentar de novo', async () => {
  const agent = request.agent(app);
  await abrirLogin(agent);

  const res = await enviar(agent, { usuario: 'teste', senha: 'x' });
  const novoToken = res.text.match(/name="_csrf" value="([^"]+)"/)?.[1];

  assert.equal(res.status, 403);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.ok(novoToken, 'formulário de recusa sem token novo');
});

test('formulário maior que 10 KB é recusado sem virar erro 500', async () => {
  const agent = request.agent(app);
  const { token } = await abrirLogin(agent);

  const res = await enviar(agent, { _csrf: token, usuario: 'teste', senha: 'x'.repeat(20_000) });

  assert.equal(res.status, 413);
  assert.deepEqual(res.body, { erro: 'Requisição inválida' });
});