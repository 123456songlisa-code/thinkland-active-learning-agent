const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { analyzeRetelling, buildReviewCard } = require('./lib/analysis-engine');
const { askModel } = require('./lib/llm-coach');
const materials = require('./data/materials.json');

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.length > 200_000) throw new Error('请求内容过长');
  return raw ? JSON.parse(raw) : {};
}

function findMaterial(id) {
  return materials.find((item) => item.id === id);
}

function publicMaterial(material) {
  return {
    id: material.id,
    subject: material.subject,
    level: material.level,
    title: material.title,
    duration: material.duration,
    intro: material.intro,
    content: material.content,
    conceptCount: material.concepts.length
  };
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\//, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR)) return json(res, 403, { error: '禁止访问' });

  fs.readFile(filePath, (error, data) => {
    if (error) return json(res, 404, { error: '页面不存在' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, {
      ok: true,
      service: 'ThinkLand',
      engine: process.env.LLM_API_KEY ? 'hybrid' : 'local-rules'
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/materials') {
    return json(res, 200, { materials: materials.map(publicMaterial) });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/materials/')) {
    const material = findMaterial(url.pathname.split('/').pop());
    return material
      ? json(res, 200, { material: publicMaterial(material) })
      : json(res, 404, { error: '未找到学习材料' });
  }

  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    const body = await readBody(req);
    const material = findMaterial(body.materialId);
    if (!material) return json(res, 400, { error: '请选择有效的学习材料' });
    if (!body.retelling || String(body.retelling).trim().length < 8) {
      return json(res, 400, { error: '请至少讲述 8 个字，让导师能够理解你的想法' });
    }

    const analysis = analyzeRetelling(material, body.retelling);
    let modelResult = null;
    if (process.env.LLM_API_KEY) {
      try {
        modelResult = await askModel({ material, retelling: body.retelling, deterministicAnalysis: analysis });
        analysis.feedback = modelResult.feedback;
        analysis.coach.question = modelResult.question;
      } catch (error) {
        console.warn(`LLM fallback: ${error.message}`);
      }
    }
    return json(res, 200, {
      analysis,
      meta: {
        engine: modelResult ? 'hybrid-agent' : 'explainable-concept-matcher',
        modelUsed: Boolean(modelResult),
        model: modelResult?.model || null,
        generatedAt: new Date().toISOString()
      }
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/review-card') {
    const body = await readBody(req);
    const material = findMaterial(body.materialId);
    if (!material || !body.analysis) return json(res, 400, { error: '缺少复习卡信息' });
    const card = buildReviewCard(material, body.analysis, Number(body.hintLevel || 0));
    return json(res, 201, { card });
  }

  return json(res, 404, { error: '接口不存在' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(req, res);
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error.message || '服务暂时不可用' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ThinkLand is running at http://127.0.0.1:${PORT}`);
});

module.exports = server;

