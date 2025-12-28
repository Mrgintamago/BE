// Quick test file
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'Server running' }));
});

server.listen(3000, () => {
  console.log('Test server running on port 3000');
});
