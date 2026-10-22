import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';

export default defineConfig({
  server: { watch: { ignored: ['**/playwright-report/**', '**/test-results/**', '**/docs/verification/**'] } },
  build: { chunkSizeWarningLimit: 650 },
  plugins: [{
    name: 'release-revision',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify({ commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), base: this.environment.config.base }, null, 2) + '\n' });
    },
  }],
});
