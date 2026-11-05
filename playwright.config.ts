import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/browser',use:{viewport:{width:360,height:800},baseURL:'http://localhost:3099'},webServer:{command:'node apps/server/dist/main.js',url:'http://localhost:3099/health',reuseExistingServer:false,env:{NODE_ENV:'production',PORT:'3099',PUBLIC_BASE_URL:'http://localhost:3099',DATABASE_PATH:':memory:'}}});
