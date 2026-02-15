import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: dirname,
  publicDir: path.join(dirname, 'public'),
  plugins: [react()],
  build: {
    outDir: path.join(dirname, 'dist'),
    emptyOutDir: true
  }
});
