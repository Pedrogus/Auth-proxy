import { stdin, stdout } from 'node:process';
import { gerarHash } from '../src/security/senha.js';

const ENTER = ['\r', '\n'];
const CTRL_C = '\u0003';
const BACKSPACE = ['\u0008', '\u007f'];

/**
 * Lê a senha em "modo cru" (raw mode): o terminal entrega cada
 * tecla ao programa e NÃO mostra o que foi digitado.
 */
function lerSenhaOculta(pergunta) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(new Error('Rode este script direto num terminal interativo.'));
      return;
    }

    let senha = '';

    function encerrar() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', aoDigitar);
      stdout.write('\n');
    }

    function aoDigitar(trecho) {
      // um "trecho" pode ter várias teclas (ex.: quando você cola a senha)
      for (const tecla of trecho) {
        if (ENTER.includes(tecla)) {
          encerrar();
          resolve(senha);
          return;
        }
        if (tecla === CTRL_C) {
          encerrar();
          reject(new Error('Cancelado.'));
          return;
        }
        if (BACKSPACE.includes(tecla)) {
          senha = senha.slice(0, -1);
          continue;
        }
        senha += tecla;
      }
    }

    stdout.write(pergunta);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', aoDigitar);
  });
}

try {
  const senha = await lerSenhaOculta('Senha: ');

  if (senha.length < 8) {
    console.error('A senha precisa ter pelo menos 8 caracteres.');
    process.exit(1);
  }

  console.log(await gerarHash(senha));
} catch (erro) {
  console.error(erro.message);
  process.exit(1);
}