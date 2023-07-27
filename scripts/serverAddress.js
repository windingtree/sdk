/* eslint-disable no-undef */
let ip, port, id;

const args = process.argv.slice(2);

// Parse arguments
for (let i = 0; i < args.length; i += 2) {
  const name = args[i].replace(/-/g, '');
  const value = args[i + 1];

  switch (name) {
    case 'ip':
      ip = value;
      break;
    case 'port':
      port = value;
      break;
    case 'id':
      id = value;
      break;
    default:
      throw new Error(`Unknown argument "${name}"`);
  }
}

console.log(`/ip4/${ip ?? '127.0.0.1'}/tcp/${port}/ws/p2p/${id}`);
