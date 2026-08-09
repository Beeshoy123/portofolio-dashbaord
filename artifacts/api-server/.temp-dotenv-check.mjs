import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
console.log('envPath', envPath);
const result = config({ path: envPath });
console.log('parsed', result.parsed ? Object.keys(result.parsed) : 'no');
console.log('error', result.error ? result.error.message : 'none');
console.log('SUPABASE_URL', process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0,20) : 'missing');
console.log('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0,20) : 'missing');
