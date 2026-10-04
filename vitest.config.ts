import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Lets tests use the same '@/...' imports as the app.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node' },
});
