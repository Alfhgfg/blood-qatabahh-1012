import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readAndroidVersionProps(): { versionCode: number; versionName: string } {
  let versionCode = 1;
  let versionName = '1.0';
  try {
    const propsPath = path.resolve(__dirname, 'android/version.properties');
    if (fs.existsSync(propsPath)) {
      const content = fs.readFileSync(propsPath, 'utf8');
      const vcMatch = content.match(/^VERSION_CODE=(\d+)/m);
      const vnMatch = content.match(/^VERSION_NAME=(.+)$/m);
      if (vcMatch && Number(vcMatch[1]) > 0) {
        versionCode = Number(vcMatch[1]);
      }
      if (vnMatch && vnMatch[1].trim()) {
        versionName = vnMatch[1].trim();
      }
    }
  } catch {
    // Use defaults if version.properties is unavailable
  }
  return { versionCode, versionName };
}

export default defineConfig(() => {
  const androidProps = readAndroidVersionProps();
  const versionCodeRaw = Number(
    process.env.ANDROID_VERSION_CODE || process.env.VITE_APP_VERSION_CODE || androidProps.versionCode
  );
  const appVersionCode =
    Number.isInteger(versionCodeRaw) && versionCodeRaw > 0 ? versionCodeRaw : androidProps.versionCode;
  const appVersionName =
    String(process.env.ANDROID_VERSION_NAME || process.env.VITE_APP_VERSION_NAME || androidProps.versionName).trim() ||
    androidProps.versionName;

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
