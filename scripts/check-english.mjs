#!/usr/bin/env node
/**
 * English-only gate.
 *
 * Everything in this repository is written in English: interface text, code, comments, docs,
 * file names and commit messages. This script fails when it finds Portuguese.
 *
 *   node scripts/check-english.mjs                 scan every tracked file (and its path)
 *   node scripts/check-english.mjs --commits A..B  scan the messages of a commit range
 *   node scripts/check-english.mjs --commits HEAD  scan the whole history
 *   node scripts/check-english.mjs --text "..."    scan one string (a pull request title, say)
 *
 * Two signals are used:
 *   1. letters that English does not use but Portuguese does (a-tilde, c-cedilla and friends);
 *   2. a list of common Portuguese words that are not English words.
 *
 * A legitimate exception (a proper noun, for instance) goes in scripts/english-allowlist.txt,
 * one token per line. This file is the only place where Portuguese words may appear, because
 * the detector has to know them; it skips itself.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const self = relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const allowlistPath = join(here, 'english-allowlist.txt');

const ACCENTED = /[ãõçáàâéêíóôúÃÕÇÁÀÂÉÊÍÓÔÚ]/;

// Common Portuguese words with no English homograph. Words that are also English (or common
// identifiers, or Mars place names) are left out on purpose: "data", "nova", "nave", "pasta",
// "num", "em", "de", "do", "visor", "terra", "altitude", "todo", "remover".
const WORDS = [
  // function words
  'nao', 'voce', 'voces', 'tambem', 'entao', 'isso', 'isto', 'esse', 'essa', 'esses', 'essas',
  'aquele', 'aquela', 'aquilo', 'nosso', 'nossa', 'nossos', 'nossas', 'meu', 'minha', 'seu', 'sua',
  'uma', 'umas', 'uns', 'pelo', 'pela', 'pelos', 'pelas', 'que', 'quem', 'qual', 'quais', 'onde',
  'quando', 'porque', 'pois', 'mas', 'muito', 'muita', 'muitos', 'pouco', 'aqui', 'ali', 'ainda',
  'ja', 'sim', 'foi', 'sao', 'esta', 'estao', 'estamos', 'tem', 'temos', 'ser', 'fazer', 'feito',
  'pra', 'numa', 'nos', 'eles', 'elas', 'ele', 'ela', 'apenas', 'cada', 'toda', 'todos',
  'todas', 'outro', 'outra', 'outros', 'mesmo', 'mesma', 'depois', 'antes', 'sobre', 'entre',
  'ate', 'desde', 'sempre', 'nunca', 'agora', 'hoje', 'amanha', 'ontem',
  // interface and project vocabulary
  'ola', 'obrigado', 'obrigada', 'tela', 'telas', 'botao', 'voltar', 'salvar', 'abrir', 'fechar',
  'cancelar', 'confirmar', 'carregando', 'erro', 'aviso', 'ajuda', 'sair', 'entrar', 'buscar',
  'mapa', 'mapas', 'camada', 'camadas', 'caminhada', 'caminhadas', 'rota', 'rotas', 'ponto',
  'pontos', 'trajeto', 'superficie', 'distancia', 'duracao', 'velocidade', 'clima',
  'poeira', 'radiacao', 'pressao', 'temperatura', 'seguranca', 'perigo', 'bussola',
  'astronauta', 'astronautas', 'tripulacao', 'marte', 'planeta', 'cratera', 'relevo',
  'declividade', 'suporte', 'vida', 'retorno', 'liberado', 'atencao', 'simulado', 'premissa',
  // repository vocabulary
  'adiciona', 'adicionar', 'adicionado', 'corrige', 'corrigir', 'corrigido', 'atualiza',
  'atualizar', 'atualizado', 'melhora', 'melhorar', 'ajusta', 'ajustar', 'cria', 'criar',
  'criado', 'removido', 'altera', 'alterar', 'testes', 'teste', 'arquivo', 'arquivos',
  'projeto', 'projetos', 'equipe', 'entrega', 'dados', 'usuario', 'usuarios', 'configuracao',
  'versao', 'pagina', 'paginas', 'ingles', 'portugues', 'idioma', 'traducao', 'funcionalidade',
  'melhoria', 'correcao', 'documentacao', 'repositorio', 'licenca', 'creditos',
];

// Words in the list that English also uses, so they only count next to another signal.
// (Kept out of the hard list to avoid false alarms, such as "que" in a French name.)
const SOFT = new Set(['que', 'mas', 'ser', 'tem', 'nos', 'ja', 'sim', 'ali', 'ate', 'esta', 'erro', 'sobre', 'cada', 'vida', 'suporte', 'ponto', 'sair', 'pois', 'ele', 'ela', 'qual', 'sua', 'seu', 'meu', 'pra', 'sao', 'foi', 'mesmo', 'mesma']);

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const HARD = new Set(WORDS.filter((w) => !SOFT.has(w)));

const allow = new Set(
  existsSync(allowlistPath)
    ? readFileSync(allowlistPath, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map(fold)
    : [],
);

/** Returns the offending tokens found in one line of text. */
function findPortuguese(line) {
  const tokens = line.match(/[\p{L}]+/gu) ?? [];
  const hits = [];
  let soft = 0;
  for (const token of tokens) {
    const folded = fold(token);
    if (allow.has(folded)) continue;
    if (ACCENTED.test(token)) hits.push(token);
    else if (HARD.has(folded)) hits.push(token);
    else if (SOFT.has(folded)) soft += 1;
  }
  // Soft words alone are not proof; three in one line are.
  if (hits.length === 0 && soft >= 3) hits.push('(several Portuguese function words)');
  return hits;
}

const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|icns|bmp|ttf|otf|woff2?|mp3|wav|ogg|m4a|mp4|mov|webm|pdf|zip|gz|keystore|jks)$/i;
const SKIP = new Set(['package-lock.json', self]);

const problems = [];
const report = (where, hits) => problems.push(`${where}: ${[...new Set(hits)].join(', ')}`);

function scanFiles() {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  for (const file of files) {
    if (SKIP.has(file)) continue;
    const inPath = findPortuguese(file.replace(/[\/._-]/g, ' '));
    if (inPath.length) report(`${file} (file name)`, inPath);
    if (BINARY.test(file) || !existsSync(join(root, file))) continue;
    const text = readFileSync(join(root, file), 'utf8');
    if (text.includes('\u0000')) continue;
    text.split(/\r?\n/).forEach((line, i) => {
      const hits = findPortuguese(line);
      if (hits.length) report(`${file}:${i + 1}`, hits);
    });
  }
  return files.length;
}

function scanCommits(range) {
  const out = execFileSync('git', ['log', '--format=%H%x1f%B%x1e', range], {
    cwd: root,
    encoding: 'utf8',
  });
  const commits = out.split('\x1e').map((c) => c.trim()).filter(Boolean);
  for (const commit of commits) {
    const [sha, message = ''] = commit.split('\x1f');
    const hits = message.split(/\r?\n/).flatMap(findPortuguese);
    if (hits.length) report(`commit ${sha.slice(0, 7)} "${message.split(/\r?\n/)[0]}"`, hits);
  }
  return commits.length;
}

const args = process.argv.slice(2);
let summary;
if (args[0] === '--commits') {
  if (!args[1]) throw new Error('usage: --commits <range>');
  summary = `${scanCommits(args[1])} commit message(s)`;
} else if (args[0] === '--text') {
  const hits = (args[1] ?? '').split(/\r?\n/).flatMap(findPortuguese);
  if (hits.length) report('text', hits);
  summary = 'the given text';
} else {
  summary = `${scanFiles()} tracked file(s)`;
}

if (problems.length) {
  console.error(`English-only gate failed. Portuguese found in ${problems.length} place(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('\nThis project is written in English only. Translate the text above.');
  console.error('A real exception (a proper noun) goes in scripts/english-allowlist.txt.');
  process.exit(1);
}
console.log(`English-only gate passed: ${summary} checked.`);
