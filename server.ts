import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

// Initialize GoogleGenAI server-side with User-Agent
function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Category list for reference in prompt
const CATEGORY_KEYS = [
  'an_uong', 'cho_sieu_thi', 'di_lai', 'nha_o',
  'con_sua_bim', 'giao_duc', 'con_do_dung', 'con_y_te',
  'suc_khoe', 'cafe', 'mua_sam', 'giai_tri',
  'hieu_hi', 'tiet_kiem', 'tra_no', 'khac',
  'luong', 'thuong', 'thu_phu', 'loi_dau_tu', 'bhxh', 'hoan_thue', 'duoc_tang', 'thu_khac'
];

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
app.post('/api/gemini/parse-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType, rawText } = req.body;

    const ai = getAI();
    if (!ai) {
      return res.status(400).json({ error: 'Chưa cấu hình GEMINI_API_KEY trong mục Secrets.' });
    }

    const parts: any[] = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
        },
      });
    }

    const promptText = `Bạn là chuyên gia bóc tách biên lai thanh toán, hóa đơn siêu thị/nhà hàng, ảnh chụp màn hình LỊCH SỬ GIAO DỊCH / BIẾN ĐỘNG SỐ DƯ ngân hàng (Vietcombank, Techcombank, MB, Momo,...), và ĐẶC BIỆT là ảnh chụp màn hình đơn hàng từ các sàn thương mại điện tử (Shopee, Lazada, TikTok Shop, Tiki,... như màn hình "Đơn đã mua", "Chờ lấy hàng", "Chờ giao hàng").

QUY TẮC RẤT QUAN TRỌNG:
1. TRÍCH XUẤT NHIỀU KHOẢN GIAO DỊCH (MULTI-TRANSACTIONS):
- Nếu ảnh chứa NHIỀU ĐƠN HÀNG HOẶC NHIỀU GIAO DỊCH (Ví dụ: danh sách đơn mua Shopee có 2 đơn của 2 shop khác nhau; hoặc màn hình sao kê có 2-5 giao dịch):
  BẠN BẮT BUỘC PHẢI TRÍCH XUẤT TẤT CẢ TỪNG GIAO DỊCH / TỪNG ĐƠN HÀNG ĐÓ VÀO MẢNG "transactions".
  Tuyệt đối không gộp chung lại thành 1 khoản duy nhất!
- Nếu ảnh chỉ có đúng 1 giao dịch/đơn hàng, mảng "transactions" chứa 1 phần tử.

2. QUY TẮC ĐẶC BIỆT CHO ĐƠN HÀNG SHOPEE / LAZADA / TIKTOK SHOP:
- Với mỗi đơn hàng trong danh sách:
  + merchant: Tên Shop bán hàng hoặc tên sàn (ví dụ: "Shopee - qilanduo", "Shopee - Unilever Chăm Sóc Sắc Đẹp").
  + amount: Lấy đúng dòng "Tổng số tiền (... sản phẩm): ...đ" sau khi đã trừ giảm giá/voucher (ví dụ: 57808 hoặc 78168). Bỏ qua giá gạch bỏ.
  + note: Tên sản phẩm chính của đơn hàng (ví dụ: "Hộp đựng tăm bông, bông tẩy trang nhựa", "Sữa dưỡng thể da sáng tức thì Vaseline 350ml").
  + category: Phân loại theo món đồ ('mua_sam', 'suc_khoe', 'an_uong', 'con_do_dung', 'nha_o',...).
  + date: Lấy ngày hiển thị trong ảnh (hoặc ngày hiện tại nếu không ghi rõ ngày đặt).
  + type: Luôn là 'out' (tiền chi tiêu).

3. QUY ƯỚC TỔNG THỂ TỪNG GIAO DỊCH:
- merchant: Tên người/đơn vị nhận hoặc gửi tiền, tên shop (ví dụ: "Shopee - qilanduo", "WinMart", "NGUYEN VAN A").
- amount: Số tiền thực tế bằng VNĐ (số nguyên dương, ví dụ 57808, không có dấu âm).
- type: 'out' nếu là Tiền ra / Mua sắm / Thanh toán / Trừ tiền (-); 'in' nếu là Tiền vào / Nhận tiền / Cộng tiền (+).
- date: Ngày giao dịch định dạng chuẩn YYYY-MM-DD.
- note: Tên sản phẩm, nội dung lời nhắn chuyển khoản hoặc lý do chi tiêu.
- category: Mã danh mục phù hợp nhất từ danh sách bên dưới.

Danh mục khả dụng (chọn đúng một mã key phù hợp nhất cho từng giao dịch):
- an_uong (Cơm, bún, phở, nhà hàng, quán ăn, GrabFood, ShopeeFood)
- cho_sieu_thi (WinMart, Co.opmart, Bách Hóa Xanh, Lotte, Aeon, đồ đi chợ tươi sống)
- di_lai (Xăng xe Petrolimex, Grab, Be, Xanh SM, VETC, vé máy bay, gửi xe)
- nha_o (Tiền thuê nhà, điện EVN, nước sinh hoạt, Internet FPT/VNPT/Viettel)
- con_sua_bim (Sữa bột, bỉm tã, Con Cưng, KidsPlaza, BiboMart, ăn dặm)
- giao_duc (Học phí, trường mầm non, sách vở, học tiếng Anh)
- con_do_dung (Quần áo trẻ em, đồ chơi cho bé)
- con_y_te (Khám nhi, tiêm chủng VNVC, thuốc cho bé)
- suc_khoe (Nhà thuốc Long Châu, Pharmacity, khám bệnh, bảo hiểm)
- cafe (Highlands, Phúc Long, Starbucks, trà sữa, quán cafe)
- mua_sam (Shopee, Lazada, TikTok Shop, quần áo, mỹ phẩm, điện tử)
- giai_tri (Xem phim CGV, du lịch, Netflix, Spotify, tiệc tùng)
- hieu_hi (Đám cưới, mừng tân gia, sinh nhật, phong bì, quà tặng)
- tiet_kiem (Gửi tiết kiệm, mua vàng tích lũy)
- tra_no (Trả nợ vay ngân hàng, thẻ tín dụng, trả góp)
- khac (Chi tiêu khác)
- luong (Lương nhận vào)
- thuong (Tiền thưởng)
- thu_phu (Làm thêm ngoài giờ, bán hàng online)
- loi_dau_tu (Lãi tiết kiệm, cổ tức, tiền lời)
- duoc_tang (Tiền lì xì, người khác biếu tặng)

Văn bản bổ sung nếu có: ${rawText || ''}`;

    parts.push({ text: promptText });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Yêu cầu AI quá thời gian xử lý (vui lòng thử lại)')), 55000)
    );

    const callPromise = ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: { parts },
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              description: 'Danh sách tất cả các khoản giao dịch riêng biệt tìm thấy trong ảnh',
              items: {
                type: Type.OBJECT,
                properties: {
                  merchant: { type: Type.STRING, description: 'Tên đối tác / người nhận / người gửi' },
                  amount: { type: Type.NUMBER, description: 'Số tiền thực tế của khoản này (VNĐ, số nguyên > 0)' },
                  type: { type: Type.STRING, description: "'out' cho tiền ra/chi tiêu, 'in' cho tiền vào/thu nhập" },
                  category: { type: Type.STRING, description: 'Mã category key tương ứng' },
                  date: { type: Type.STRING, description: 'Ngày giao dịch định dạng YYYY-MM-DD' },
                  note: { type: Type.STRING, description: 'Nội dung hoặc lời nhắn chuyển khoản của khoản này' },
                },
                required: ['merchant', 'amount', 'type', 'category', 'note'],
              },
            },
            merchant: { type: Type.STRING },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            type: { type: Type.STRING },
            category: { type: Type.STRING },
            note: { type: Type.STRING },
          },
          required: ['transactions'],
        },
      },
    });

    const response: any = await Promise.race([callPromise, timeoutPromise]);
    const parsed = JSON.parse(response.text || '{}');

    // Ensure backwards compatibility and full data arrays
    if (!Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
      if (parsed.amount) {
        parsed.transactions = [
          {
            merchant: parsed.merchant || 'Giao dịch',
            amount: parsed.amount || 0,
            type: parsed.type || 'out',
            category: parsed.category || 'khac',
            date: parsed.date || new Date().toISOString().slice(0, 10),
            note: parsed.note || '',
          },
        ];
      } else {
        parsed.transactions = [];
      }
    }

    if (parsed.transactions.length > 0) {
      parsed.merchant = parsed.merchant || parsed.transactions[0].merchant;
      parsed.amount = parsed.amount || parsed.transactions[0].amount;
      parsed.type = parsed.type || parsed.transactions[0].type;
      parsed.category = parsed.category || parsed.transactions[0].category;
      parsed.date = parsed.date || parsed.transactions[0].date;
      parsed.note = parsed.note || parsed.transactions[0].note;
    }

    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error parsing receipt:', err);
    return res.status(500).json({ error: err.message || 'Lỗi khi phân tích hoá đơn với Gemini' });
  }
});

// 2. Nhập nhanh câu lệnh tiếng Việt tự nhiên
app.post('/api/gemini/quick-text', async (req, res) => {
  try {
    const { text, currentDate } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const todayStr = currentDate || new Date().toISOString().slice(0, 10);
    const prompt = `Hôm nay là ngày: ${todayStr}.
Người dùng nhập câu tiếng Việt nhanh để ghi sổ thu chi: "${text}".
Ví dụ:
- "ăn trưa bún chả 45k" => amount: 45000, type: "out", cat: "an_uong", note: "Ăn trưa bún chả"
- "đổ xăng 70k cây petrolimex bằng momo" => amount: 70000, type: "out", cat: "di_lai", note: "Đổ xăng cây petrolimex", account: "momo"
- "mua 2 hộp sữa bột meiji 1100k con cung" => amount: 1100000, type: "out", cat: "con_sua_bim", note: "Sữa bột meiji Con Cưng"
- "nhận lương 28 triệu về vcb" => amount: 28000000, type: "in", cat: "luong", note: "Lương tháng", account: "vietcombank"
- "hôm qua cà phê highland 65k" => date sẽ tính là ngày hôm qua (${todayStr} trừ 1 ngày).

Hãy bóc tách thành giao dịch chuẩn.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: 'Số tiền bằng VNĐ (số dương)' },
            type: { type: Type.STRING, description: "'out' cho chi, 'in' cho thu" },
            category: { type: Type.STRING, description: 'Khóa danh mục phù hợp' },
            note: { type: Type.STRING, description: 'Tên ghi chú rõ ràng' },
            date: { type: Type.STRING, description: 'Ngày YYYY-MM-DD' },
            account: { type: Type.STRING, description: 'Tên tài khoản hoặc ví thanh toán nếu có nhắc đến' },
          },
          required: ['amount', 'type', 'category', 'note', 'date'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error quick parse text:', err);
    return res.status(500).json({ error: err.message || 'Lỗi khi phân tích câu lệnh' });
  }
});

// 3. Phân tích tài chính cá nhân & đưa ra lời khuyên thông minh
app.post('/api/gemini/advisor', async (req, res) => {
  try {
    const { month, income, expense, byCategory, netWorth, debts, savings, budget } = req.body;

    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const prompt = `Bạn là chuyên gia hoạch định tài chính cá nhân và gia đình giàu kinh nghiệm tại Việt Nam.
Dưới đây là bức tranh tài chính tháng ${month || 'gần đây'}:
- Tổng thu nhập: ${income?.toLocaleString('vi-VN')} ₫
- Tổng chi tiêu: ${expense?.toLocaleString('vi-VN')} ₫
- Hạn mức ngân sách tháng đã đặt: ${budget ? budget.toLocaleString('vi-VN') + ' ₫' : 'Chưa đặt'}
- Thặng dư/Tiết kiệm trong tháng: ${(income - expense)?.toLocaleString('vi-VN')} ₫
- Chi tiết theo danh mục: ${JSON.stringify(byCategory || {})}
- Tổng tài sản ròng (Net Worth): ${netWorth?.toLocaleString('vi-VN')} ₫
- Tổng nợ (vay nợ, thẻ tín dụng): ${debts?.toLocaleString('vi-VN')} ₫
- Tổng tiết kiệm & đầu tư: ${savings?.toLocaleString('vi-VN')} ₫

Hãy phân tích sức khỏe tài chính thực tế, chỉ ra điểm tích cực, những khoản chi có thể đang lãng phí hoặc vượt chuẩn 50/30/20, và đưa ra 3 lời khuyên cụ thể, hành động được ngay cho lối sống tại Việt Nam.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            financialHealthScore: { type: Type.NUMBER, description: 'Điểm sức khỏe tài chính từ 1 đến 100' },
            healthStatus: { type: Type.STRING, description: 'Đánh giá ngắn: Xuất sắc, Tốt, Cần lưu ý, Nguy cơ' },
            summary: { type: Type.STRING, description: 'Tóm tắt tình hình tài chính tháng' },
            rule503020: {
              type: Type.OBJECT,
              properties: {
                needPct: { type: Type.NUMBER, description: 'Tỷ lệ % chi thiết yếu' },
                wantPct: { type: Type.NUMBER, description: 'Tỷ lệ % chi theo sở thích cá nhân' },
                savePct: { type: Type.NUMBER, description: 'Tỷ lệ % tiết kiệm & đầu tư' },
                comment: { type: Type.STRING, description: 'Nhận xét về tỉ lệ 50/30/20' },
              },
              required: ['needPct', 'wantPct', 'savePct', 'comment'],
            },
            keyInsights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: { type: Type.STRING, description: "'success' | 'warning' | 'tip'" },
                  description: { type: Type.STRING },
                },
                required: ['title', 'type', 'description'],
              },
            },
            actionSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  estimatedSaving: { type: Type.STRING },
                },
                required: ['title', 'detail'],
              },
            },
          },
          required: ['financialHealthScore', 'healthStatus', 'summary', 'rule503020', 'keyInsights', 'actionSteps'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error in financial advisor:', err);
    return res.status(500).json({ error: err.message || 'Lỗi khi phân tích tài chính với AI' });
  }
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
