import {defineConfig} from 'vite';
export default defineConfig({server:{port:5173,strictPort:true,proxy:{'/api':'http://localhost:3000','/auth':'http://localhost:3000','/health':'http://localhost:3000','/version':'http://localhost:3000'}}});
