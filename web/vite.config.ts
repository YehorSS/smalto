import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/smalto/',
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2022' },
  test: { environment: 'jsdom' },
});
