import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gcyuahzdvaodrqijjqba.supabase.co',
  'sb_publishable_k82IGmc4tBSzGYFBNj30JA__rzwuN4O',
);

const credentials = {
  email: 'beeshoymedhat2014@gmail.com',
  password: 'Bosha@061096',
};

const login = await supabase.auth.signInWithPassword(credentials);
console.log('LOGIN', JSON.stringify({ error: login.error ? login.error.message : null, status: login.status, statusText: login.statusText, session: !!login.data.session }, null, 2));
if (!login.data.session) process.exit(1);

const token = login.data.session.access_token;
const urls = ['http://localhost:3000/api/portfolio', 'http://localhost:3001/api/portfolio'];
for (const url of urls) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  console.log('URL', url);
  console.log('STATUS', res.status);
  console.log('BODY', text);
}
