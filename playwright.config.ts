import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',workers:1,retries:0,timeout:90000,
  projects:[
    { name:'desktop', use:{ viewport:{ width:1280,height:900 } } },
    { name:'mobile', use:{ viewport:{ width:390,height:844 } } },
  ],
  use:{ baseURL:process.env.TEST_API_ORIGIN ?? 'http://localhost:8080',
    channel:process.platform === 'win32' ? 'msedge' : undefined, headless:true,
    trace:'retain-on-failure',screenshot:'only-on-failure' },
  reporter:[['list'],['json',{ outputFile:'test-results/browser-report.json' }]],
});
