const os = require('os');
const path = require('path');
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 15000,
    hookTimeout: 15000,
    // Keeps tests away from the real public/uploads (user logos).
    env: { UPLOAD_DIR: path.join(os.tmpdir(), 'shortcutwall-test-uploads') },
  },
});
