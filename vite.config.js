import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { metaContentSecurityPolicy, securityHeaders } from './deployment/security-headers.mjs'

// Only audited runtime assets go into the app. Experimental skull artwork,
// source maps, template images and repository notes remain outside the bundle.
const publicAssets = [
  'privacy.html', 'guide.html', 'MEDIAPIPE-LICENSE.md',
  ...['hand_landmarker', 'face_landmarker', 'pose_landmarker_lite'].map(name => `models/${name}.task`),
  ...['vision_wasm_internal', 'vision_wasm_nosimd_internal', 'vision_wasm_module_internal']
    .flatMap(name => ['js', 'wasm'].map(extension => `mediapipe/wasm/${name}.${extension}`)),
]

function productionAssets() {
  let outputDirectory
  return {
    name: 'anatomylens-production-assets',
    apply: 'build',
    configResolved(config) { outputDirectory = resolve(config.root, config.build.outDir) },
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: metaContentSecurityPolicy }, injectTo: 'head-prepend' }]
    },
    async closeBundle() {
      for (const asset of publicAssets) {
        const destination = resolve(outputDirectory, asset)
        await mkdir(resolve(destination, '..'), { recursive: true })
        if (asset === 'privacy.html' || asset === 'guide.html') {
          const html = await readFile(resolve('public', asset), 'utf8')
          await writeFile(destination, html.replace('<head>', `<head>\n  <meta http-equiv="Content-Security-Policy" content="${metaContentSecurityPolicy}">`))
        } else await copyFile(resolve('public', asset), destination)
      }
      // Netlify / Cloudflare Pages consume this file; other hosts must apply
      // the equivalent headers in their response configuration.
      await writeFile(resolve(outputDirectory, '_headers'), '/*\n' + Object.entries(securityHeaders)
        .map(([name, value]) => `  ${name}: ${value}`).join('\n') + '\n')
    },
  }
}

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repository beneath /Anatomy/. Local and
  // Capacitor builds continue to use the origin root unless overridden.
  base: process.env.ANATOMYLENS_BASE_PATH || '/',
  plugins: [react(), productionAssets()],
  envPrefix: [],
  publicDir: command === 'build' ? false : 'public',
  build: { sourcemap: false },
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : undefined,
  server: { host: '127.0.0.1', cors: false, strictPort: true },
  preview: { host: '127.0.0.1', cors: false, strictPort: true, headers: securityHeaders },
}))
