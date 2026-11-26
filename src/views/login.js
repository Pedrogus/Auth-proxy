

function escapar(texto) {
    return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function paginaLogin({ csrfToken, erro }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Entrar</title>
</head>
<body>
  <main>
    <h1>Entrar</h1>
    ${erro ? `<p role="alert">${escapar(erro)}</p>` : ''}
    <form method="post" action="/login">
      <input type="hidden" name="_csrf" value="${escapar(csrfToken)}">

      <label for="usuario">Usuário</label>
      <input id="usuario" name="usuario" autocomplete="username" required maxlength="256">

      <label for="senha">Senha</label>
      <input id="senha" name="senha" type="password" autocomplete="current-password" required maxlength="256">

      <button type="submit">Entrar</button>
    </form>
  </main>
</body>
</html>`;
}