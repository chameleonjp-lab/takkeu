import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
const server=await createServer({server:{middlewareMode:true},configFile:false});
try{const {rallyGeometryCorpus}=await server.ssrLoadModule('/tests/helpers/rallyGeometryCorpus.ts');const rows=rallyGeometryCorpus();writeFileSync(process.argv[2],JSON.stringify(rows));console.log('captured',rows.length,'cases');}finally{await server.close();}
