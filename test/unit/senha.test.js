import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarHash, verificarSenha } from '../../src/security/senha.js';

test('gera hash no formato scrypt$N$r$p$salt$hash', async () => {
  const hash = await gerarHash('senha-de-teste');

  assert.equal(hash.split('$').length, 6);
  assert.ok(hash.startsWith('scrypt$'));
  assert.ok(!hash.includes('senha-de-teste'));
});

test('aceita a senha correta e recusa a errada', async () => {
  const hash = await gerarHash('senha-de-teste');

  assert.equal(await verificarSenha('senha-de-teste', hash), true);
  assert.equal(await verificarSenha('senha-errada', hash), false);
});

test('a mesma senha gera hashes diferentes (salt)', async () => {
  const a = await gerarHash('mesma-senha');
  const b = await gerarHash('mesma-senha');

  assert.notEqual(a, b);
});

test('hash em formato inválido é recusado sem lançar erro', async () => {
  assert.equal(await verificarSenha('qualquer', 'GERAR_COM_npm_run_hash'), false);
  assert.equal(await verificarSenha('qualquer', ''), false);
  assert.equal(await verificarSenha('qualquer', undefined), false);
});