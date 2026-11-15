import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve:{
    alias: [
      { find: /^@shared\/types$/, replacement: path.resolve(__dirname, '../../packages/types/src/index.ts') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ]
  }
})
