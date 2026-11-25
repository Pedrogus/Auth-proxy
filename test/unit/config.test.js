import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, ConfigError } from '../../src/config/index.js';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres'
const base = { PUBLIC_URL: 'http://localhost:3000', CSRF_SECRET: SEGREDO };

test('usa padrões seguros quando a variável não existe', () => {
  const config = loadConfig(base);
  assert.equal(config.nodeEnv, 'development');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 3000);
});

test('não sobe sem PUBLIC_URL', () => {
  assert.throws(() => loadConfig({}), ConfigError);
});

test('recusa porta inválida', () => {
  assert.throws(() => loadConfig({ ...base, PORT: 'abc' }), /PORT/);
});

test('em produção exige loopback e https, e lista os dois problemas', () => {
  const env = {
    NODE_ENV: 'production',
    HOST: '0.0.0.0',
    PUBLIC_URL: 'http://auth.contoso.local',
    CSRF_SECRET: SEGREDO,
  };
  assert.throws(
    () => loadConfig(env),
    (erro) => erro instanceof ConfigError && erro.problemas.length === 2,
  );
});

test('configuração não pode ser alterada depois de carregada', () => {
  const config = loadConfig(base);
  assert.throws(() => {
    config.port = 1;
  }, TypeError);
});

test('não sobe sem CSRF_SECRET', () => {
  assert.throws(() => loadConfig({ PUBLIC_URL: 'http://localhost:3000' }), /CSRF_SECRET/);
});

test('recusa segredo curto sem mostrar o valor na mensagem', () => {
  assert.throws(
    () => loadConfig({ ...base, CSRF_SECRET: 'curto-demais' }),
    (erro) => erro instanceof ConfigError && !erro.message.includes('curto-demais'),
  );
});