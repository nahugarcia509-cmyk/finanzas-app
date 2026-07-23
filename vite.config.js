import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function versionServiceWorker() {
  return {
    name: 'version-service-worker',
    apply: 'build',
    async closeBundle() {
      const serviceWorkerPath = resolve('dist/sw.js')
      const source = await readFile(serviceWorkerPath, 'utf8')
      const buildId = new Date().toISOString().replace(/[-:.TZ]/g, '')
      await writeFile(serviceWorkerPath, source.replace('__BUILD_ID__', buildId))
    }
  }
}

export default defineConfig({
  plugins: [react(), versionServiceWorker()]
})
