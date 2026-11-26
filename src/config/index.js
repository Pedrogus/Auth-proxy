import { resolve } from 'node:path';

const AMBIENTES = ['development', 'test', 'production'];
const LOOPBACK = ['127.0.0.1', '::1', 'localhost'];

export class ConfigError extends Error {
  constructor(problemas) {
    super(`Configuração inválida:\n- ${problemas.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problemas = problemas;
  }
}

export function loadConfig(env = process.env) {
  const problemas = [];

  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!AMBIENTES.includes(nodeEnv)) {
    problemas.push(`NODE_ENV deve ser: ${AMBIENTES.join(', ')} (recebido: "${nodeEnv}")`);
  }
  const isProduction = nodeEnv === 'production';

  const host = env.HOST ?? '127.0.0.1';
  if (isProduction && !LOOPBACK.includes(host)) {
    problemas.push('HOST em produção deve ser loopback, porque o IIS fica na frente');
  }

  const port = lerPorta(env.PORT, 3000, problemas);
  const publicUrl = lerUrlPublica(env.PUBLIC_URL, isProduction, problemas);
  const csrfSecret = lerSegredo(env.CSRF_SECRET, 'CSRF_SECRET', problemas);
  const usersFile = resolve(env.USERS_FILE || 'data/usuarios.json');

  if (problemas.length > 0) {
    throw new ConfigError(problemas);
  }

  return Object.freeze({ nodeEnv, isProduction, host, port, publicUrl, cookieStore: publicUrl.startsWith('https:'), csrfSecret, usersFile, });
}

function lerPorta(valor, padrao, problemas) {
  if (valor === undefined || valor === '') return padrao;

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
    problemas.push(`PORT deve ser um inteiro entre 1 e 65535 (recebido: "${valor}")`);
    return padrao;
  }
  return numero;
}

function lerUrlPublica(valor, isProduction, problemas) {
  if (!valor) {
    problemas.push('PUBLIC_URL é obrigatória (ex.: http://localhost:3000)');
    return undefined;
  }

  let url;
  try {
    url = new URL(valor);
  } catch {
    problemas.push('PUBLIC_URL não é uma URL válida');
    return undefined;
  }

  if (isProduction && url.protocol !== 'https:') {
    problemas.push('PUBLIC_URL deve usar https em produção');
  }
  return url.origin;
}

function lerSegredo(valor, nome, problemas) {
    if(!valor) {
        problemas.push(`${nome} é obrigatorio`);
        return undefined;
    }
    if(valor.length < 32) {
        problemas.push(`${nome} deve ter pelo menos 32 caracteres`);
        return undefined;
    } 
    return valor;
}