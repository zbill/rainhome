import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/clock/',
  server: {
    host: true, // 允许通过IP地址访问
    port: 5173
  }
})
