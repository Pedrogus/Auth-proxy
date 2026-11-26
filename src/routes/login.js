import express, { Router  } from "express";
import { origemValida } from '../security/csrf.js';
import { paginaLogin } from '../views/login.js';

const MENSAGENS = { csrf: 'Sua sessão de login expirou. Tente novamente.',
  credenciais_invalidas: 'Usuário ou senha inválidos.',
  conta_desativada: 'Conta desativada. Procure a TI.'
};

const STATUS = {
  credenciais_invalidas: 401,
  conta_desativada: 403,
};

export function loginRouter({ csrf, publicUrl, provedor }) {
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

  router.post('/login', lerFormulario, async (req, res) => {

    if (!origemValida(req, publicUrl) || !csrf.validar(req)) {
      return enviarPagina(res, 403, MENSAGENS.csrf);
    }

    const resultado = await provedor.autenticar(req.body.usuario, req.body.senha);

    if (!resultado.ok) {
      return enviarPagina(res, STATUS[resultado.motivo] ?? 401, MENSAGENS[resultado.motivo]);
    }
  csrf.limpar(res);

    // Temporário: no Épico 3, aqui entra a emissão do JWT e o redirecionamento.
    res.set('Cache-Control', 'no-store');
    res.json(resultado.usuario);
  });

  return router;
}