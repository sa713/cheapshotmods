import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.CHM_BROWSER_DIR??=mkdtempSync(join(tmpdir(),'chm-browser-'));
export default defineConfig({testDir:'tests/browser',workers:1,timeout:180000,expect:{timeout:10000},use:{actionTimeout:15000,viewport:{width:360,height:800},baseURL:'http://localhost:3099',trace:'retain-on-failure'},webServer:[
  {command:'node apps/server/dist/main.js',url:'http://localhost:3099/health',reuseExistingServer:false,env:{NODE_ENV:'production',PORT:'3099',PUBLIC_BASE_URL:'http://localhost:3099',DATABASE_PATH:':memory:'}},
  {command:'node --import tsx tests/fixtures/browser-server.ts',url:'http://localhost:3101/health',reuseExistingServer:false,env:{CHM_BROWSER_DIR:process.env.CHM_BROWSER_DIR}}
]});
