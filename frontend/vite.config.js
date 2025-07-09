import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // --- ADD THIS SERVER BLOCK ---
  server: {
    proxy: {
      // Any request starting with /api will be forwarded
      '/api': {
        // The address of your backend server
        target: 'http://localhost:5000', 
        // This is necessary for the server to accept the request
        changeOrigin: true, 
      },
    },
  },
})