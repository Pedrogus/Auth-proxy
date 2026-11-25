import { loadConfig, ConfigError } from './config/index.js';
import { createApp } from './app.js';

let config;
try {
  config = loadConfig();
} catch (erro) {
  if (erro instanceof ConfigError) {
    console.error(erro.message);
    process.exit(1);
  }
  throw erro;
}

const app = createApp(config);

const server = app.listen(config.port, config.host, (erro) => {
  if (erro) return; // tratado no server.on('error')
  console.log(`infra-auth ouvindo em http://${config.host}:${config.port} (${config.nodeEnv})`);
});

server.on('error', (erro) => {
  console.error(`Não foi possível abrir a porta ${config.port}: ${erro.code}`);
  process.exit(1);
});

function encerrar(sinal) {
  console.log(`${sinal} recebido, encerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));