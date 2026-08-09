const urls = ['http://localhost:3000/api/portfolio', 'http://localhost:3001/api/portfolio'];
for (const url of urls) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('URL:', url);
    console.log('STATUS:', res.status);
    console.log('BODY:', text);
  } catch (err) {
    console.log('ERROR:', url, err.toString());
  }
}
