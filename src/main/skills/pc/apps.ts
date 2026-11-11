import { normalizeText } from '../../nlu/text'
import type { AppEntry, KnownFolder } from '../types'

/** Groups of names people use for the same app, across English and Portuguese Windows. */
const SYNONYMS: string[][] = [
  ['calculator', 'calculadora'],
  ['notepad', 'bloco de notas'],
  ['settings', 'configuracoes', 'definicoes'],
  ['file explorer', 'explorer', 'explorador de arquivos', 'explorador', 'gerenciador de arquivos'],
  ['task manager', 'gerenciador de tarefas'],
  ['control panel', 'painel de controle'],
  ['clock', 'relogio', 'alarms clock', 'alarmes e relogio'],
  ['photos', 'fotos'],
  ['camera', 'camera'],
  ['terminal', 'windows terminal', 'prompt de comando', 'command prompt', 'cmd'],
  ['microsoft store', 'store', 'loja', 'microsoft loja'],
  ['snipping tool', 'ferramenta de captura'],
  ['paint'],
  ['word'],
  ['excel'],
  ['powerpoint'],
  ['outlook', 'email', 'e mail'],
  ['spotify'],
  ['chrome', 'google chrome'],
  ['edge', 'microsoft edge'],
  ['vs code', 'visual studio code', 'vscode', 'code']
].map((group) => group.map(normalizeText))

const JUNK = /\b(uninstall|desinstal\w*|readme|leia me|help|ajuda|documentation|documentacao|manual|release notes|website|license|licenca)\b/

function bigrams(s: string): string[] {
  const t = s.replace(/\s+/g, '')
  return Array.from({ length: Math.max(0, t.length - 1) }, (_, i) => t.slice(i, i + 2))
}

function dice(a: string, b: string): number {
  const x = bigrams(a)
  const y = bigrams(b)
  if (!x.length || !y.length) return 0
  const pool = [...y]
  let hits = 0
  for (const g of x) {
    const k = pool.indexOf(g)
    if (k >= 0) { hits++; pool.splice(k, 1) }
  }
  return (2 * hits) / (x.length + y.length)
}

function score(query: string, name: string): number {
  if (name === query) return 100
  if (name.startsWith(query + ' ') || name.startsWith(query)) return 80
  const qWords = query.split(' ')
  const nWords = name.split(' ')
  if (qWords.every((q) => nWords.some((n) => n.startsWith(q)))) return 60
  if (name.includes(query)) return 45
  const d = dice(query, name)
  return d >= 0.6 ? d * 40 : 0
}

/** Picks the installed app that best matches what the user said, or null. */
export function matchApp(spoken: string, apps: AppEntry[]): AppEntry | null {
  const query = normalizeText(spoken)
  if (!query) return null
  const variants = [query, ...(SYNONYMS.find((g) => g.includes(query)) ?? [])]

  let best: { app: AppEntry; score: number; len: number } | null = null
  for (const app of apps) {
    const name = normalizeText(app.name)
    if (JUNK.test(name)) continue
    const s = Math.max(...variants.map((v) => score(v, name)))
    if (s === 0) continue
    if (!best || s > best.score || (s === best.score && name.length < best.len)) {
      best = { app, score: s, len: name.length }
    }
  }
  return best?.app ?? null
}

const FOLDER_WORDS = new Set(['folder', 'pasta', 'directory', 'diretorio'])
const FILLER_WORDS = new Set(['the', 'my', 'de', 'do', 'da', 'dos', 'das', 'meu', 'minha', 'meus', 'minhas', 'o', 'a', 'os', 'as'])

const FOLDERS: Array<[KnownFolder, string[], boolean]> = [
  // [folder, names, unambiguous without the word "folder"]
  ['downloads', ['downloads', 'download'], true],
  ['documents', ['documents', 'documentos', 'docs'], true],
  ['desktop', ['desktop', 'area de trabalho'], true],
  ['pictures', ['pictures', 'imagens', 'fotos', 'photos'], false],
  ['music', ['music', 'musicas', 'musica'], false],
  ['videos', ['videos', 'video'], false],
  ['home', ['home', 'usuario', 'pessoal', 'user'], false]
]

/** "downloads", "pasta de documentos", "my music folder" → known folder (or null). */
const contentWords = (s: string): string =>
  normalizeText(s)
    .split(' ')
    .filter((w) => !FOLDER_WORDS.has(w) && !FILLER_WORDS.has(w))
    .join(' ')

export function matchFolder(spoken: string): KnownFolder | null {
  const saidFolder = normalizeText(spoken).split(' ').some((w) => FOLDER_WORDS.has(w))
  const rest = contentWords(spoken)
  for (const [folder, names, unambiguous] of FOLDERS) {
    if (names.some((n) => contentWords(n) === rest) && (saidFolder || unambiguous)) return folder
  }
  return null
}

/** Strips "app"/"aplicativo"/"programa" etc. from an app request. */
export function cleanAppQuery(spoken: string): string {
  return spoken
    .replace(/\b(the|app|application|program|aplicativo|aplicacao|programa|o app|a app)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
