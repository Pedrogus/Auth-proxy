import express, { Router  } from "express";
import { origemValida } from '../security/csrf.js';
import { paginaLogin } from '../views/login.js';

const MENSAGEM_CSRF = 'Sua sessão de login expirou. Tente novamente.';

export function loginRouter({ csrf, publicUrl }) {
  const router = Router();

  // limite baixo: o formulário tem 3 campos curtos
  const lerFormulario = express.urlencoded({ extended: false, limit: '10kb' });

  function enviarPagina(res, status, erro) {
    const csrfToken = csrf.emitir(res);
    res.set('Cache-Control', 'no-store');
    res.status(status).type('html').send(paginaLogin({ csrfToken, erro }));
  }

  router.get('/login', (_req, res) => {
    enviarPagina(res, 200);
  });

  router.post('/login', lerFormulario, (req, res) => {

    if (!origemValida(req, publicUrl) || !csrf.validar(req)) {
      return enviarPagina(res, 403, MENSAGEM_CSRF);
    }

    // E2-03: autenticar usuário e senha no AD via LDAPS
    res.status(501).json({ erro: 'Não implementado' });
  });

  return router;
}