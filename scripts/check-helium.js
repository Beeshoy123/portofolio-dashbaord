const dns = require('dns');
const net = require('net');

const host = 'helium';
const port = 5432;

console.log(`Checking ${host}:${port}...`);

dns.lookup(host, { all: true }, (lookupErr, addresses) => {
  if (lookupErr) {
    console.log('DNS_LOOKUP_ERROR');
    console.log(lookupErr.message || String(lookupErr));
    process.exit(0);
  }

  console.log('DNS_ADDRESSES');
  console.log(JSON.stringify(addresses, null, 2));

  const socket = new net.Socket();
  socket.setTimeout(5000);

  socket.on('connect', () => {
    console.log('CONNECT_SUCCESS');
    console.log(`Connected to ${host}:${port}`);
    socket.destroy();
    process.exit(0);
  });

  socket.on('timeout', () => {
    console.log('CONNECT_TIMEOUT');
    console.log(`Timed out connecting to ${host}:${port}`);
    socket.destroy();
    process.exit(0);
  });

  socket.on('error', (err) => {
    console.log('CONNECT_ERROR');
    console.log(err && err.message ? err.message : String(err));
    socket.destroy();
    process.exit(0);
  });

  socket.connect(port, host);
});
