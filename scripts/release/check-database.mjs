import { checkDatabase } from './database.mjs';
try { console.log(JSON.stringify(checkDatabase())); }
catch { console.error('Production DB gate failed: credentials, timeout, migration or schema/security contract unverified. No deploy.');process.exitCode=1; }
