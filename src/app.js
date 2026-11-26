import express from 'express';
import cookieParser from 'cookie-parser';
import { criarCsrf } from './security/csrf.js';
import { healthRouter } from './routes/health.js';
import { loginRouter } from './routes/login.js';

export function createApp(config, { provedor } = {}) {
  const app = express();

  app.set('env', config.nodeEnv);
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use(cookieParser());

  const csrf = criarCsrf({ secret: config.csrfSecret, secure: config.cookieSecure });

  app.use(healthRouter());
  app.use(loginRouter({ csrf, publicUrl: config.publicUrl, provedor }));

  app.use((_req, res) => {
    res.status(404).json({ erro: 'Não encontrado' });
  });

  app.use((err, _req, res, _next) => {
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;

    // Só erro 500 vai pro log. Erros 4xx de leitura do corpo podem
    // carregar o corpo da requisição, e no /login isso inclui a senha.
    if (status === 500) {
      console.error(err);
    }

    res.status(status).json({ erro: status === 500 ? 'Erro interno' : 'Requisição inválida' });
  });

  return app;
}