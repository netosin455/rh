// ============================================================
// e2e/servidor.mjs — SuperRH
// Servidor estático mínimo (node:http, sem dependência nova) para o teste E2E.
// 1) Gera o app web com `npx expo export --platform web`, apontando a API para ESTE servidor
//    (mesma origem, sem CORS). A API é 100% simulada dentro do Playwright (e2e/apiSimulada.ts):
//    nada daqui conversa com produção nem com banco.
// 2) Serve a pasta gerada em 127.0.0.1:4173.
//
// E2E_REUSE_BUILD=1 pula o build e reaproveita a pasta já gerada.
// ============================================================

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PASTA = join(RAIZ, process.env.E2E_DIST ?? 'dist-e2e');
const HOST = '127.0.0.1';
// Porta padrão 4173; E2E_PORTA muda (útil se outro processo já usa a 4173).
const PORTA = Number(process.env.E2E_PORTA ?? 4173);
const ORIGEM = `http://${HOST}:${PORTA}`;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function gerarBuild() {
  return new Promise((ok, falhou) => {
    console.log(`[e2e] gerando o app web em ${PASTA} (API = ${ORIGEM})`);
    // --clear (limpa o cache do Metro) só sob pedido: E2E_CLEAR=1. O build é conferido logo depois (confirmarOrigemNoBuild).
    const limpar = process.env.E2E_CLEAR === '1' ? ' --clear' : '';
    const filho = spawn('npx expo export --platform web --output-dir ' + JSON.stringify(PASTA) + limpar, {
      cwd: RAIZ,
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        // Sem isto o Expo leria o .env do projeto (que aponta para outro lugar) e ele venceria o valor abaixo.
        EXPO_NO_DOTENV: '1',
        EXPO_PUBLIC_API_URL: ORIGEM,
        EXPO_PUBLIC_APP_URL: ORIGEM,
        CI: '1',
      },
    });
    filho.on('exit', (codigo) => (codigo === 0 ? ok() : falhou(new Error(`expo export saiu com código ${codigo}`))));
    filho.on('error', falhou);
  });
}

/** Trava de segurança: o bundle tem de apontar para ESTE servidor (e não para localhost:3000/produção do cache ou do .env). */
function confirmarOrigemNoBuild() {
  const pasta = join(PASTA, '_expo', 'static', 'js', 'web');
  const bundles = existsSync(pasta) ? readdirSync(pasta).filter((n) => n.endsWith('.js')) : [];
  const achou = bundles.some((n) => readFileSync(join(pasta, n), 'utf8').includes(ORIGEM));
  if (!achou) throw new Error(`o bundle não contém ${ORIGEM}: a API do app não aponta para o servidor de teste (cache do Metro? tente E2E_CLEAR=1)`);
}

function arquivoDe(caminho) {
  try {
    return statSync(caminho).isFile() ? caminho : null;
  } catch {
    return null;
  }
}

/** Procura o arquivo da rota como o Vercel/Expo static fazem: exato, .html, /index.html e rotas dinâmicas ([id].html). */
function resolverArquivo(pathname) {
  const limpo = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const direto = join(PASTA, limpo);
  // Nunca sair da pasta do build.
  if (direto !== PASTA && !direto.startsWith(PASTA + sep)) return null;

  const candidatos = limpo === '' ? ['index.html'] : [limpo, `${limpo}.html`, join(limpo, 'index.html')];
  for (const c of candidatos) {
    const achado = arquivoDe(join(PASTA, c));
    if (achado) return achado;
  }

  // Rota dinâmica: cada segmento pode virar "[param]" (pasta ou .html).
  const segmentos = limpo.split(/[\\/]/).filter(Boolean);
  const tentar = (base, restantes) => {
    if (restantes.length === 0) return arquivoDe(`${base}.html`) ?? arquivoDe(join(base, 'index.html'));
    const [atual, ...resto] = restantes;
    const exato = join(base, atual);
    const viaExato = tentar(exato, resto);
    if (viaExato) return viaExato;
    if (!existsSync(base)) return null;
    // Procura "[algo]" na pasta atual.
    const dinamico = ['[id]', '[token]'].map((nome) => join(base, nome));
    for (const d of dinamico) {
      const viaDinamico = tentar(d, resto);
      if (viaDinamico) return viaDinamico;
    }
    return null;
  };
  return segmentos.length > 0 ? tentar(PASTA, segmentos) : null;
}

function iniciarServidor() {
  const servidor = createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', ORIGEM);

    // A API vive no Playwright. Se uma chamada chegar até aqui, é bug do teste: responde 404 explícito.
    if (pathname.startsWith('/api/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API simulada não interceptou esta chamada (e2e).' }));
      return;
    }

    let arquivo = resolverArquivo(pathname);
    // Arquivo com extensão que não existe (ex.: .js, .ttf) é 404 de verdade; o resto cai no index.html (SPA).
    if (!arquivo && extname(pathname) !== '' && extname(pathname) !== '.html') {
      res.writeHead(404);
      res.end('Não encontrado');
      return;
    }
    arquivo = arquivo ?? arquivoDe(join(PASTA, 'index.html'));
    if (!arquivo) {
      res.writeHead(500);
      res.end('Build não encontrado. Rode sem E2E_REUSE_BUILD.');
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(arquivo).pipe(res);
  });

  servidor.listen(PORTA, HOST, () => console.log(`[e2e] servidor pronto em ${ORIGEM}`));
  for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => servidor.close(() => process.exit(0)));
}

if (process.env.E2E_REUSE_BUILD === '1') {
  if (!existsSync(join(PASTA, 'index.html'))) {
    console.error(`[e2e] E2E_REUSE_BUILD=1, mas ${PASTA} não tem build.`);
    process.exit(1);
  }
  confirmarOrigemNoBuild();
  iniciarServidor();
} else {
  gerarBuild().then(() => { confirmarOrigemNoBuild(); iniciarServidor(); }).catch((e) => {
    console.error('[e2e] build falhou:', e.message);
    process.exit(1);
  });
}
