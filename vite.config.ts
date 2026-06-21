import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'fs'

// 构建后将 <script type="module"> 转为 <script defer>（WebView2 不支持 ESM）
function neutralinoAdapter(): Plugin {
  return {
    name: 'neutralino-adapter',
    apply: 'build',
    closeBundle() {
      const htmlPath = resolve(__dirname, 'resources', 'index.html')
      let html = readFileSync(htmlPath, 'utf-8')
      html = html.replace(
        /<script type="module" crossorigin src="(\.\/assets\/[^"]+)"><\/script>/g,
        '<script defer src="$1"></script>'
      )
      html = html.replace(/ crossorigin/g, '')
      writeFileSync(htmlPath, html)
      console.log('  ✓ HTML adapted for WebView2 (ESM → IIFE + defer)')

      // 恢复被 emptyOutDir 清空的 neutralino.js
      const srcJs = resolve(__dirname, 'js', 'neutralino.js')
      const destJs = resolve(__dirname, 'resources', 'js', 'neutralino.js')
      if (existsSync(srcJs)) {
        mkdirSync(resolve(__dirname, 'resources', 'js'), { recursive: true })
        copyFileSync(srcJs, destJs)
        console.log('  ✓ neutralino.js restored to resources/js/')
      }
    },
  }
}

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'resources'),
    emptyOutDir: true,
    target: 'es2015',
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [react(), neutralinoAdapter()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
