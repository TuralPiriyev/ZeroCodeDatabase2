const http = require('http');

const options = { hostname: '127.0.0.1', port: 5000, path: '/api/health', method: 'GET' };

const req = http.request(options, res => {
  console.log('statusCode:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('body:', data));
});
req.on('error', (e) => console.error('request error:', e.message));
req.end();
