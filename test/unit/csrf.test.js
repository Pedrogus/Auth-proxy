import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCsrf, origemValida } from '../../src/security/csrf.js';

const SEGREDO = 'oIlSEAzkagv78rB3vTy1K5INkzFVSc3AJFxsyDfoU5A';

function respostaFalsa() {
  const cookies = {};
  return {
    cookies,
    cookie(nome, valor, opcoes) {
      cookies[nome] = { valor, opcoes };
    },
  };
}

function emitirToken(csrf) {
  const res = respostaFalsa();
  const token = csrf.emitir(res);
  const valorCookie = res.cookies[csrf.nomeCookie].valor;
  return { res, token, valorCookie };
}

test('grava o cookie com as proteções certas', () => {
  const csrf = criarCsrf({ secret: SEGREDO, secure: false });
  const { res } = emitirToken(csrf);
  const { opcoes } = res.cookies.csrf;

  assert.equal(opcoes.httpOnly, true);
  assert.equal(opcoes.sameSite, 'strict');
  assert.equal(opcoes.path, '/');
});

test('em https usa o prefixo __Host- e cookie Secure', () => {
  const csrf = criarCsrf({ secret: SEGREDO, secure: true });
  const { res } = emitirToken(csrf);

  assert.equal(csrf.nomeCookie, '__Host-csrf');
  assert.equal(res.cookies['__Host-csrf'].opcoes.secure, true);
});

test('o token do formulário não é o valor do cookie', () => {
  const csrf = criarCsrf({ secret: SEGREDO, secure: false });
  const { token, valorCookie } = emitirToken(csrf);

  assert.notEqual(token, valorCookie);
});

test('aceita o token emitido junto com o seu cookie', () => {
  const csrf = criarCsrf({ secret: SEGREDO, secure: false });
  const { token, valorCookie } = emitirToken(csrf);
  const req = { cookies: { csrf: valorCookie }, body: { _csrf: token } };

  assert.equal(csrf.validar(req), true);
});

test('recusa quando falta o cookie ou o campo', () => {
  const csrf = criarCsrf({ secret: SEGREDO, secure: false });
  const { token, valorCookie } = emitirToken(csrf);

  assert.equal(csrf.validar({ cookies: {}, body: { _csrf: token } }), false);
  assert.equal(csrf.validar({ cookies: { csrf: valorCookie }, body: {} }), false);
  assert.equal(csrf.validar({}), false);
});

test('recusa token de outro navegador (cookie e token trocados)', () => {
  const csrf = criarCsrf({ secret: SEGREDO, secure: false });
  const usuarioA = emitirToken(csrf);
  const usuarioB = emitirToken(csrf);
  const req = { cookies: { csrf: usuarioA.valorCookie }, body: { _csrf: usuarioB.token } };

  assert.equal(csrf.validar(req), false);
});

test('recusa token assinado com outro segredo', () => {
  const nosso = criarCsrf({ secret: SEGREDO, secure: false });
  const atacante = criarCsrf({ secret: 'outro-segredo-qualquer-com-32-caracteres', secure: false });
  const { valorCookie } = emitirToken(nosso);
  const tokenForjado = emitirToken(atacante).token;
  const req = { cookies: { csrf: valorCookie }, body: { _csrf: tokenForjado } };

  assert.equal(nosso.validar(req), false);
});

test('recusa _csrf enviado repetido (array)', () => {
  const csrf = criarCsrf({ secret: SEGREDO, secure: false });
  const { token, valorCookie } = emitirToken(csrf);
  const req = { cookies: { csrf: valorCookie }, body: { _csrf: [token, token] } };

  assert.equal(csrf.validar(req), false);
});

test('origemValida só aceita o PUBLIC_URL exato', () => {
  const req = (origin) => ({ get: () => origin });
  const publicUrl = 'http://localhost:3000';

  assert.equal(origemValida(req('http://localhost:3000'), publicUrl), true);
  assert.equal(origemValida(req('http://localhost:3000.evil.com'), publicUrl), false);
  assert.equal(origemValida(req('null'), publicUrl), false);
  assert.equal(origemValida(req(undefined), publicUrl), false);
});