import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: !!process.env.GEMINI_API_KEY });
});

app.get('/api/download/source', async (_req, res) => {
  const filePath = path.resolve(__dirname, 'public', 'so-thu-chi-source.zip');
  if (!fs.existsSync(filePath)) {
    try {
      const { execSync } = await import('child_process');
      execSync('python3 scripts/pack-source.py', { cwd: __dirname });
    } catch (e) {
      console.warn('Failed to repack source zip:', e);
    }
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="so-thu-chi-source.zip"');
  return res.download(filePath, 'so-thu-chi-source.zip');
});

app.get('/api/download/build', (_req, res) => {
  const filePath = path.resolve(__dirname, 'public', 'so-thu-chi-github-pages.zip');
  res.download(filePath, 'so-thu-chi-github-pages.zip');
});

app.get('/api/github/status', (_req, res) => {
  res.json({ hasServerToken: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) });
});

// Endpoint đẩy code trực tiếp lên GitHub bằng Personal Access Token
app.post('/api/github/push', async (req, res) => {
  try {
    const {
      token,
      repoOwner = 'duongphamwork93',
      repoName = 'so-thu-chi',
      branch = 'main',
      commitMsg = 'Nâng cấp Sổ Thu Chi (React 19 + TypeScript + Tailwind + AI)',
    } = req.body;

    const cleanToken = (token && String(token).trim()) || (process.env.GITHUB_TOKEN || '').trim();

    if (!cleanToken) {
      return res.status(400).json({ error: 'Vui lòng nhập GitHub Personal Access Token (PAT).' });
    }

    const remoteUrl = `https://${cleanToken}@github.com/${repoOwner}/${repoName}.git`;

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Build fresh static dist first
    try {
      await execAsync('npm run build', { cwd: __dirname });
    } catch (bErr) {
      console.warn('Build warning:', bErr);
    }

    const commands = [
      'git config --global --add safe.directory "*"',
      'git config --global user.name "duongphamwork93"',
      'git config --global user.email "duongpham.work93@gmail.com"',
      'git init',
      `git branch -M ${branch}`,
      'git add -A',
      `git commit -m "${commitMsg.replace(/"/g, '\\"')}" || true`,
      `git push -u "${remoteUrl}" ${branch} --force`,
    ];

    let combinedOutput = '';
    for (const cmd of commands) {
      try {
        const { stdout, stderr } = await execAsync(cmd, { cwd: __dirname });
        combinedOutput += (stdout || '') + (stderr || '') + '\n';
      } catch (err: any) {
        const safeError = (err.message || '').replace(new RegExp(cleanToken, 'g'), '***TOKEN***');
        return res.status(500).json({ error: `Lỗi khi đẩy lên GitHub: ${safeError}` });
      }
    }

    return res.json({
      success: true,
      message: `Đã cập nhật thành công lên GitHub https://github.com/${repoOwner}/${repoName}!`,
      details: combinedOutput.replace(new RegExp(cleanToken, 'g'), '***'),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật lên GitHub' });
  }
});

// 1. Quét & bóc tách hóa đơn / sao kê ngân hàng qua ảnh hoặc văn bản
app.all('/api/gemini/parse-receipt', async (req, res) => {
  const handler = (await import('./api/gemini/parse-receipt.ts')).default;
  return handler(req, res);
});

// 2. Nhập nhanh câu lệnh tiếng Việt tự nhiên
app.all('/api/gemini/quick-text', async (req, res) => {
  const handler = (await import('./api/gemini/quick-text.ts')).default;
  return handler(req, res);
});

// 3. Phân tích tài chính cá nhân & đưa ra lời khuyên thông minh
app.all('/api/gemini/advisor', async (req, res) => {
  const handler = (await import('./api/gemini/advisor.ts')).default;
  return handler(req, res);
});

// Endpoint cập nhật giá thị trường tự động cho cổ phiếu, vàng, bạc, crypto
app.all('/api/gemini/update-market-prices', async (req, res) => {
  const handler = (await import('./api/gemini/update-market-prices.ts')).default;
  return handler(req, res);
});

// Endpoint nhận diện giọng nói & bóc tách giao dịch (gemini-3.5-transcribe + gemini-3.1-flash-lite)
app.all('/api/gemini/voice-parse', async (req, res) => {
  const handler = (await import('./api/gemini/voice-parse.ts')).default;
  return handler(req, res);
});

// Setup Vite middlewares in development or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
