import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `cloudflare()` runs worker/index.ts in the real Workers runtime during
// `vite dev`, and builds both the client and the Worker for `wrangler deploy`.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
});
