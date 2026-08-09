import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gcyuahzdvaodrqijjqba.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjeXVhaHpkdmFvZHJxaWpqcWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxODYxNjEsImV4cCI6MjEwMTc2MjE2MX0.HJzOaV-6rUC83dusSGa9RtJ9lWGswzoG_5r0elpQzKs'
);

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'beeshoymedhat2014@gmail.com',
  password: 'Bosha@061096',
});

console.log(JSON.stringify({ error: error?.message ?? null, hasSession: !!data.session }));
