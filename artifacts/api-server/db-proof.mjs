import pg from 'pg';

const { Pool } = pg;
const uri = 'postgresql://postgres:Bosha%40061196@db.gcyuahzdvaodrqijjqba.supabase.co:5432/postgres';

console.log('starting db proof');
const pool = new Pool({
  connectionString: uri,
  ssl: {
    rejectUnauthorized: false,
    servername: 'db.gcyuahzdvaodrqijjqba.supabase.co',
  },
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
});

pool.on('error', (e) => {
  console.log('pool-event-error', e.message, e.code || '');
});

try {
  console.log('before connect');
  const client = await pool.connect();
  console.log('after connect');
  try {
    const res = await client.query('select current_database() as db, 1 as one');
    console.log('connect-ok', JSON.stringify(res.rows));
  } catch (e) {
    console.log('query-error', e.message, e.code || '', e.stack || '');
  } finally {
    client.release();
  }
} catch (e) {
  console.log('connect-error', e.message, e.code || '', e.stack || '');
} finally {
  await pool.end();
  console.log('pool ended');
}
