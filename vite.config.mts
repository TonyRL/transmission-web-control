import { defineConfig, loadEnv } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const TRANSMISSION_RPC = env.TRANSMISSION_RPC || 'http://192.168.1.3:9091/transmission/rpc';

  return {
    base: './',
    build: {
      chunkSizeWarningLimit: 1024 * 1024 * 1024,
      sourcemap: true,
    },
    server: {
      proxy: {
        '/rpc': {
          target: TRANSMISSION_RPC,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      nodePolyfills({
        exclude: [],
        protocolImports: true,
      }),
    ],
    define: {
      'import.meta.env.__APP_VERSION__': JSON.stringify(pkg.version),
    },
  };
});
