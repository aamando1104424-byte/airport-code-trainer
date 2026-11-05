import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host: true lets your phone open the dev server on the same Wi-Fi
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
