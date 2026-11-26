import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gerarHash } from '../../src/security/senha.js';
import { criarProvedorLocal } from '../../src/auth/local/provedor.js';

let pasta;
let hash;
let provedor;

async function gravar(nome, conteudo) {
  const caminho = join(pasta, nome);
  await writeFile(caminho, JSON.stringify(conteudo));
  return caminho;
}

before(async () => {
  pasta = await mkdtemp(join(tmpdir(), 'auth-proxy-'));
  hash = await gerarHash('senha-correta');

  const caminho = await gravar('usuarios.json', [
    { nome: 'Ana Teste', email: 'ana.teste', senhaHash: hash, grupo: 'User', ativo: true },
    { nome: 'Bia Admin', email: 'bia.admin', senhaHash: hash, grupo: 'Admin', ativo: true },
    { nome: 'Caio Inativo', email: 'caio.inativo', senhaHash: hash, grupo: 'User', ativo: false },
  ]);
  provedor = await criarProvedorLocal(caminho);
});

test('autentica usuário ativo e devolve o grupo', async () => {
  const r = await provedor.autenticar('bia.admin', 'senha-correta');

  assert.deepEqual(r, {
    ok: true,
    usuario: { nome: 'Bia Admin', email: 'bia.admin', grupo: 'Admin' },
  });
});

test('login ignora maiúsculas e espaços nas pontas', async () => {
  const r = await provedor.autenticar('  Ana.Teste ', 'senha-correta');

  assert.equal(r.ok, true);
});

test('senha errada e usuário inexistente têm a mesma resposta', async () => {
  const errada = await provedor.autenticar('ana.teste', 'senha-errada');
  const inexistente = await provedor.autenticar('nao.existe', 'senha-correta');

  assert.deepEqual(errada, { ok: false, motivo: 'credenciais_invalidas' });
  assert.deepEqual(inexistente, errada);
});

test('recusa senha vazia e campos que não são texto', async () => {
  for (const [login, senha] of [['ana.teste', ''], ['', 'x'], [undefined, 'x'], ['ana.teste', ['a']]]) {
    const r = await provedor.autenticar(login, senha);
    assert.equal(r.motivo, 'credenciais_invalidas');
  }
});

test('conta desativada com senha certa é bloqueada', async () => {
  const r = await provedor.autenticar('caio.inativo', 'senha-correta');

  assert.deepEqual(r, { ok: false, motivo: 'conta_desativada' });
});

test('conta desativada com senha errada não revela que está desativada', async () => {
  const r = await provedor.autenticar('caio.inativo', 'senha-errada');

  assert.equal(r.motivo, 'credenciais_invalidas');
});

test('resultado do login nunca carrega o hash da senha', async () => {
  const r = await provedor.autenticar('ana.teste', 'senha-correta');

  assert.equal(JSON.stringify(r).includes('scrypt$'), false);
});

test('arquivo com grupo ou ativo inválidos não carrega', async () => {
  const caminho = await gravar('invalido.json', [
    { nome: 'X', email: 'x', senhaHash: hash, grupo: 'admin', ativo: 'true' },
  ]);

  await assert.rejects(criarProvedorLocal(caminho), (erro) => {
    assert.match(erro.message, /grupo deve ser/);
    assert.match(erro.message, /ativo deve ser/);
    return true;
  });
});

test('arquivo com e-mail repetido não carrega', async () => {
  const caminho = await gravar('repetido.json', [
    { nome: 'A', email: 'mesmo', senhaHash: hash, grupo: 'User', ativo: true },
    { nome: 'B', email: 'MESMO', senhaHash: hash, grupo: 'User', ativo: true },
  ]);

  await assert.rejects(criarProvedorLocal(caminho), /email repetido/);
});