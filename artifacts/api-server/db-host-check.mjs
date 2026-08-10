import dns from 'node:dns';
import net from 'node:net';

const hosts = ['db.gcyuahzdvaodrqijjqba.supabase.co', 'gcyuahzdvaodrqijjqba.supabase.co'];

function dnsOne(host) {
  return new Promise((resolve) => {
    dns.lookup(host, (err, address, family) => {
      if (err) {
        resolve({ host, errCode: err.code || err.message, address: null, family: null });
      } else {
        resolve({ host, errCode: null, address, family });
      }
    });
  });
}

async function connectOne(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      console.log('socket-open', host, port);
      socket.end();
      resolve({ host, port, ok: true });
    });

    socket.setTimeout(1000, () => {
      console.log('socket-timeout', host, port);
      socket.destroy();
      resolve({ host, port, ok: false, code: 'ETIMEDOUT' });
    });

    socket.on('error', (err) => {
      console.log('socket-error', host, port, err.code || err.message);
      resolve({ host, port, ok: false, code: err.code || err.message });
    });
  });
}

const results = [];
for (const host of hosts) {
  const dnsResult = await dnsOne(host);
  results.push(dnsResult);
  if (!dnsResult.errCode) {
    results.push(await connectOne(host, 5432));
    results.push(await connectOne(host, 6543));
  }
}

console.log(JSON.stringify(results));
