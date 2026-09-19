const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './browser-tests',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    workers: process.env.CI ? 2 : undefined,
    timeout: 30000,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: { acceptDownloads: true, trace: 'retain-on-failure' },
    projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({
        name: browserName, use: { browserName }
    }))
});
