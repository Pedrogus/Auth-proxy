import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { gerarHash, verificarSenha } from '../../security/senha.js';

export const GRUPOS = ['User', 'Admin'];


/**
 * Provedor de usuários a partir de um arquivo JSON.
 * Placeholder até o AD (LDAPS) e o Entra ID.
 *
 * Interface (igual para todos os provedores):
 *   autenticar(login, senha) →
 *     { ok: true, usuario: { nome, email, grupo } }
 *     { ok: false, motivo: 'credenciais_invalidas' | 'conta_desativada' }
 */
export async function criarProvedorLocal(caminho) {
    const usuarios = await carregarUsuarios(caminho);

    const hashFalso = await gerarHash(randomBytes(16).toString('hex'));

    async function autenticar(login, senha) {
        if(typeof login !== 'string' || typeof senha !== 'string' || !login.trim() || !senha) {
            return { ok: false, motivo: 'credenciais_invalidas'};
        }

        const usuario = usuarios.get(login.trim().toLowerCase());
        const senhaOK = await verificarSenha(senha, usuario?.senhaHash ?? hashFalso);

        if(!usuario || !senhaOK) {
            return { ok: false, motivo: 'credenciais_invalidas'};
        }

        if(!usuario.ativo) {
            return { ok: false, motivo: 'conta_desativada' };
        }

        return {
            ok: true,
            usuario: { nome: usuario.nome, email: usuario.email, grupo: usuario.grupo },
        };
    }

    return { autenticar };

}

async function carregarUsuarios(caminho) {
   let lista;
  try {
    lista = JSON.parse(await readFile(caminho, 'utf8'));
  } catch (erro) {
throw new Error(
      `Não foi possível ler o arquivo de usuários em ${caminho} (${erro.code ?? 'JSON inválido'})`,
      { cause: erro },
    );  }

    if(!Array.isArray(lista)) {
        throw new Error(`O arquivo de usuários deve conter uma lista`);
    }

    const usuarios = new Map();
    const problemas = [];

    lista.forEach((u, indice) => {
        const posicao = `usuario #${indice + 1}`;

        if(typeof u?.email !== 'string' || !u.email.trim()) {
            problemas.push(`${posicao}: email obrigatorio`);
            return;
        }
        if (typeof u.nome !== 'string' || !u.nome.trim()) problemas.push(`${posicao}: nome obrigatório`);
        if (typeof u.senhaHash !== 'string') problemas.push(`${posicao}: senhaHash obrigatório`);
        if (!GRUPOS.includes(u.grupo)) problemas.push(`${posicao}: grupo deve ser ${GRUPOS.join(' ou ')}`);
        if (typeof u.ativo !== 'boolean') problemas.push(`${posicao}: ativo deve ser true ou false`);

        const chave = u.email.trim().toLowerCase();
        if (usuarios.has(chave)) problemas.push(`${posicao}: email repetido`);

        usuarios.set(chave, {nome: u.nome, email: chave, senhaHash: u.senhaHash, grupo: u.grupo, ativo: u.ativo});
    });

    if (problemas.length > 0) {
        throw new Error(`Arquivo de usuarios invalidos: \n- ${problemas.join('\n- ')}`);
    }

    return usuarios;
}