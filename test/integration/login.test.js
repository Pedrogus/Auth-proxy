import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/index.js';

const PUBLIC_URL = 'http://localhost:3000';


//provedor
const provedorFalso = {
  chamadas: 0,
  async autenticar(login, senha) {
    this.chamadas += 1;
    if (senha !== 'senha-correta') return { ok: false, motivo: 'credenciais_invalidas' };
    if (login === 'ana.teste') {
      return { ok: true, usuario: { nome: 'Ana Teste', email: 'ana.teste', grupo: 'User' } };
    }
    if (login === 'caio.inativo') return { ok: false, motivo: 'conta_desativada' };
    return { ok: false, motivo: 'credenciais_invalidas' };
  },
};

const config = loadConfig({
  NODE_ENV: 'test',
  PUBLIC_URL,
  CSRF_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
});

const app = createApp(config, { provedor: provedorFalso });

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

test('login correto devolve nome e grupo e apaga o cookie CSRF', async () => {
  const agent = request.agent(app);
  const { token } = await abrirLogin(agent);

  const res = await enviar(agent, { _csrf: token, usuario: 'ana.teste', senha: 'senha-correta' });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { nome: 'Ana Teste', email: 'ana.teste', grupo: 'User' });
  assert.match(res.headers['set-cookie'].join(';'), /csrf=;.*Expires=Thu, 01 Jan 1970/);
});

test('senha errada responde 401 com formulário novo', async () => {
  const agent = request.agent(app);
  const { token } = await abrirLogin(agent);

  const res = await enviar(agent, { _csrf: token, usuario: 'ana.teste', senha: 'errada' });

  assert.equal(res.status, 401);
  assert.match(res.text, /Usuário ou senha inválidos/);
  assert.match(res.text, /name="_csrf" value="[^"]+"/);
});

test('conta desativada responde 403 com mensagem própria', async () => {
  const agent = request.agent(app);
  const { token } = await abrirLogin(agent);

  const res = await enviar(agent, { _csrf: token, usuario: 'caio.inativo', senha: 'senha-correta' });

  assert.equal(res.status, 403);
  assert.match(res.text, /Conta desativada/);
});

test('sem CSRF válido, o provedor nem é consultado', async () => {
  const agent = request.agent(app);
  await abrirLogin(agent);
  provedorFalso.chamadas = 0;

  await enviar(agent, { usuario: 'ana.teste', senha: 'senha-correta' });

  assert.equal(provedorFalso.chamadas, 0);
});

test('falha no provedor vira 500 genérico, sem detalhes', async () => {
  const provedorQuebrado = {
    async autenticar() {
      throw new Error('detalhe interno que não pode vazar');
    },
  };
  const appQuebrado = createApp(config, { provedor: provedorQuebrado });
  const agent = request.agent(appQuebrado);
  const { token } = await abrirLogin(agent);

  const res = await enviar(agent, { _csrf: token, usuario: 'ana.teste', senha: 'senha-correta' });

  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { erro: 'Erro interno' });
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