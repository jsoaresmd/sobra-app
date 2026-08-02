import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publico = resolve(raiz, 'public')

/** O ícone maskable precisa de margem: o Android recorta as bordas. */
const MASKABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#3b3fb6" />
  <g transform="translate(102 102) scale(0.6)">
    <circle cx="256" cy="262" r="122" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="40" />
    <path d="M256 140a122 122 0 0 1 105 185" fill="none" stroke="#ffffff" stroke-width="40" stroke-linecap="round" />
    <path d="M212 232h88M212 272h88M232 200l48 124" fill="none" stroke="#ffffff" stroke-width="26" stroke-linecap="round" />
  </g>
</svg>`

async function gerar() {
  await mkdir(publico, { recursive: true })
  const base = await readFile(resolve(publico, 'favicon.svg'))

  await Promise.all([
    sharp(base).resize(192, 192).png().toFile(resolve(publico, 'icon-192.png')),
    sharp(base).resize(512, 512).png().toFile(resolve(publico, 'icon-512.png')),
    sharp(base).resize(180, 180).png().toFile(resolve(publico, 'apple-touch-icon.png')),
    sharp(Buffer.from(MASKABLE)).resize(512, 512).png().toFile(resolve(publico, 'icon-maskable-512.png')),
  ])

  await writeFile(resolve(publico, 'robots.txt'), 'User-agent: *\nDisallow:\n')
  console.log('Ícones gerados em public/')
}

await gerar()
