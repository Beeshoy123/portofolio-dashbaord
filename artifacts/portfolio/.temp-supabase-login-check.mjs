import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gcyuahzdvaodrqijjqba.supabase.co',
  'sb_publishable_k82IGmc4tBSzGYFBNj30JA__rzwuN4O',
);

const credentials = {
  email: 'beeshoymedhat2014@gmail.com',
  password: 'Bosha@061096',
};

const result = await supabase.auth.signInWithPassword(credentials);
console.log(JSON.stringify({
  error: result.error ? { message: result.error.message, status: result.error.status, details: result.error.details } : null,
  session: result.data.session ? { user: result.data.session.user.id, expires_at: result.data.session.expires_at } : null,
  user: result.data.user ? { id: result.data.user.id, email: result.data.user.email } : null,
  status: result.status,
  statusText: result.statusText,
}, null, 2));
