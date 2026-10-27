import http from 'node:http';
import worker from '../src/worker.js';
const port = Number(process.env.PORT || 3000);
http.createServer(async (req, res) => {
  try {
    const response = await worker.fetch(new Request('http://localhost:' + port + req.url, { method: req.method }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Server error'); }
}).listen(port, '127.0.0.1', () => console.log('Magnus’s Bus → http://localhost:' + port));
