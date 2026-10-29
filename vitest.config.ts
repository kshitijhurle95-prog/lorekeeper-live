import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['server/**/*.test.ts'],testTimeout:15000,setupFiles:['./server/test-setup.ts']}});
