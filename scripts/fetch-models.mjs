// Downloads the local speech models into ./models (git-ignored).
// Usage: npm run models            (skips files that already exist)
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'models')
const VOICES = 'https://huggingface.co/rhasspy/piper-voices/resolve/main'

const voice = (lang, region, name, quality) => {
  const file = `${region}-${name}-${quality}.onnx`
  const base = `${VOICES}/${lang}/${region}/${name}/${quality}/${file}`
  return [
    { url: base, to: `voices/${file}` },
    { url: `${base}.json`, to: `voices/${file}.json` }
  ]
}

const FILES = [
  { url: 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip', to: 'piper.zip', unzip: 'piper/piper.exe' },
  ...voice('en', 'en_US', 'lessac', 'medium'),
  ...voice('pt', 'pt_BR', 'faber', 'medium')
]

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  const total = Number(res.headers.get('content-length')) || 0
  let done = 0
  let last = 0
  const body = Readable.fromWeb(res.body)
  body.on('data', (chunk) => {
    done += chunk.length
    if (total && Date.now() - last > 500) {
      last = Date.now()
      process.stdout.write(`\r  ${Math.round((done / total) * 100)}% of ${(total / 1e6).toFixed(0)} MB`)
    }
  })
  const tmp = `${dest}.part`
  await pipeline(body, createWriteStream(tmp))
  renameSync(tmp, dest)
  process.stdout.write('\r' + ' '.repeat(30) + '\r')
}

for (const f of FILES) {
  const dest = join(root, f.to)
  const done = f.unzip ? join(root, f.unzip) : dest
  if (existsSync(done)) {
    console.log(`✓ ${f.unzip ?? f.to}`)
    continue
  }
  mkdirSync(dirname(dest), { recursive: true })
  console.log(`↓ ${f.to}`)
  await download(f.url, dest)
  if (f.unzip) {
    // Windows' own bsdtar reads zips (Git Bash's GNU tar, often first on PATH, does not)
    const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
    execFileSync(tar, ['-xf', dest, '-C', root])
    rmSync(dest)
  }
}
console.log(`Models ready in ${root}`)
