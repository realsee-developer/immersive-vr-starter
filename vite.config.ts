import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = process.env.PORT || env.PORT || '4101';
  const webPort = Number(process.env.VITE_PORT || env.VITE_PORT || '5173');
  let framework = 'react';
  try { framework = JSON.parse(readFileSync('.starter.json', 'utf8')).framework; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (!['react', 'vue', 'typescript'].includes(framework)) throw new Error('Run npm run setup to select react, vue, or typescript.');
  return {
    plugins: framework === 'react' ? [react()] : framework === 'vue' ? [vue()] : [],
    resolve: { alias: { '@tour-entry': resolve(`src/frameworks/${framework}/main.${framework === 'react' ? 'tsx' : 'ts'}`) } },
    server: { host: '127.0.0.1', port: webPort, strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true } } },
    build: { outDir: 'dist/client', chunkSizeWarningLimit: 2500 },
  };
});
