import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

//Parâmetros de referência do OWASP password Storage Cheat Sheet para scrypt.
//N=2^27 usa cerca de 128MB por cálculo, por isso o maxmen maior
const PARAMETROS = { N: 2 ** 17, r: 8, p: 1};
const MAXMEM  = 256 * 1024 * 1024;
const TAMANHO_HASH = 64;

export async function gerarHash(senha) {
    const salt = randomBytes(16);
    const hash = await scryptAsync(senha, salt, TAMANHO_HASH, { ...PARAMETROS, maxmem: MAXMEM });

    return [
        'scrypt',
        PARAMETROS.N,
        PARAMETROS.r,
        PARAMETROS.p,
        salt.toString('base64url'),
        hash.toString('base64url'),
    ].join('$');
}

export async function verificarSenha(senha, armazenado) {
    const partes = String(armazenado).split('$');
    if (partes.length !== 6 || partes[0] !== 'scrypt') {
        return false;
    }

const [, N, r, p, saltTexto, hashTexto] = partes;
const esperado = Buffer.from(hashTexto, 'base64url');

const calculado = await scryptAsync(senha, Buffer.from(saltTexto, 'base64url'), esperado.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM ,
});

return timingSafeEqual(esperado, calculado);

}