import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'chart-vendor': ['recharts'],
          'icon-vendor': ['lucide-react'],
          'pdf-vendor': ['pdfjs-dist', 'react-pdf'],
        },
      },
    },
  },
  server: {
    // Port can be overridden via CLI: npm run dev -- --port <port>
    // The run.sh script uses dynamic port selection
    port: 5173,
    open: false,
  },
  preview: {
    port: 4173,
    open: false,
  },
});

