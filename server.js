const http = require("http");
const fs = require("fs");
const path = require("path");
const { fetchTournamentResults } = require("./fetch-results");

const PORT = process.env.PORT || 8765;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

let cache = { data: null, fetchedAt: 0 };
const CACHE_MS = 5 * 60 * 1000;

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  let filePath = req.url.split("?")[0];
  if (filePath === "/") filePath = "/index.html";

  const abs = path.join(ROOT, filePath);
  if (!abs.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(abs, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(abs);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function handleApiResults(res) {
  const now = Date.now();
  if (!cache.data || now - cache.fetchedAt > CACHE_MS) {
    cache.data = await fetchTournamentResults();
    cache.fetchedAt = now;
  }
  sendJson(res, 200, { ok: true, ...cache.data });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/results")) {
    try {
      await handleApiResults(res);
    } catch (error) {
      sendJson(res, 502, { ok: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith("/api/refresh")) {
    try {
      cache.data = await fetchTournamentResults();
      cache.fetchedAt = Date.now();
      sendJson(res, 200, { ok: true, ...cache.data });
    } catch (error) {
      sendJson(res, 502, { ok: false, error: error.message });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`VM-Tipset körs på http://localhost:${PORT}`);
});
