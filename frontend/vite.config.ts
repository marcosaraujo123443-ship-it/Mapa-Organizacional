import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Em dev, /api é encaminhado para a API Node (backend/)
    proxy: { '/api': 'http://localhost:3333' },
  },
});
