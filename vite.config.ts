import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  const versionCodeRaw = Number(process.env.ANDROID_VERSION_CODE || process.env.VITE_APP_VERSION_CODE || 1);
  const appVersionCode = Number.isInteger(versionCodeRaw) && versionCodeRaw > 0 ? versionCodeRaw : 1;
  const appVersionName = String(process.env.ANDROID_VERSION_NAME || process.env.VITE_APP_VERSION_NAME || '1.0').trim() || '1.0';

  return {
    // Relative base path ensures static exports work under any subpath, reverse proxy or static CDN
    base: './',
    define: {
      __APP_VERSION_CODE__: JSON.stringify(appVersionCode),
      __APP_VERSION_NAME__: JSON.stringify(appVersionName),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@src': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild' as const,
      cssMinify: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[hash].js',
          chunkFileNames: 'assets/[hash].js',
          assetFileNames: 'assets/[hash].[ext]',
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio environment
      hmr: false,
      watch: null,
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
