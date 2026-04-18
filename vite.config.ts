import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [figmaAssetResolver(), react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  // Bundle optimization - code splitting
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Manual chunking strategy
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router'],
          
          // UI Components - Radix primitives
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-slot',
          ],
          
          // Charts & Data Visualization
          'charts-vendor': ['recharts'],
          
          // Animation libraries
          'animation-vendor': ['framer-motion', 'motion'],
          
          // Form handling & utilities
          'form-vendor': ['react-hook-form', 'zustand', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          
          // Date handling
          'date-vendor': ['date-fns', 'react-day-picker'],
          
          // Icons
          'icons-vendor': ['lucide-react'],
          
          // Supabase
          'supabase-vendor': ['@supabase/supabase-js'],
          
          // MUI (if used)
          'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          
          // Drag & drop
          'dnd-vendor': ['react-dnd', 'react-dnd-html5-backend'],
          
          // Other heavy deps
          'heavy-vendor': [
            'embla-carousel-react',
            'react-slick',
            'react-responsive-masonry',
            'react-resizable-panels',
            'vaul',
            'cmdk',
            'input-otp',
          ],
        },
        // Ensure smaller chunks
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // Minification options (using esbuild - faster than terser)
    minify: 'esbuild',
    esbuildOptions: {
      drop: ['console', 'debugger'],
    },
    // CSS optimization
    cssMinify: true,
  },
  
  // File types to support raw imports
  assetsInclude: ['**/*.svg', '**/*.csv'],
})