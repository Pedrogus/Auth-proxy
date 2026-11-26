import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

const VALIDADE_MS = 15 * 60 * 1000; // 15 minutos para preencher o formulário

/**
 * CSRF no padrão "signed double-submit cookie":
 * - o cookie guarda um valor aleatório (HttpOnly, o JavaScript da página não lê)
 * - o formulário leva a assinatura HMAC desse valor
 * - no POST, recalculamos a assinatura a partir do cookie e comparamos
 */
export function criarCsrf({ secret, secure }) {
  const nomeCookie = secure ? '__Host-csrf' : 'csrf';

  function assinar(valor) {
    return createHmac('sha256', secret).update(valor).digest('base64url');
  }

  function emitir(res) {
    const valor = randomBytes(32).toString('base64url');

    res.cookie(nomeCookie, valor, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: VALIDADE_MS,
    });

    return assinar(valor);
  }

  function limpar(res) {
    // precisa repetir as mesmas opções da criação, senão o navegador não apaga
    res.clearCookie(nomeCookie, { httpOnly: true, secure, sameSite: 'strict', path: '/' });
  }

  function validar(req) {
    const valor = req.cookies?.[nomeCookie];
    const enviado = req.body?._csrf;

    if (typeof valor !== 'string' || typeof enviado !== 'string') {
      return false;
    }

    const esperado = Buffer.from(assinar(valor));
    const recebido = Buffer.from(enviado);

    return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
  }

  return { nomeCookie, emitir, validar, limpar  };
}

/**
 * Segunda barreira: o POST tem que vir de uma página do próprio serviço.
 * Navegadores atuais mandam o cabeçalho Origin em todo POST de formulário.
 */
export function origemValida(req, publicUrl) {
  return req.get('origin') === publicUrl;
}

