import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function parseFriendlyError(err: any): { status: number; retryable: boolean; modelUnavailable: boolean; message: string } {
  const raw = typeof err?.message === 'string' ? err.message : String(err || '');
  let msg = raw;
  let code: number | undefined = typeof err?.status === 'number' ? err.status : undefined;
  let statusText = '';
  if (raw.trim().startsWith('{')) {
    try {
      const obj = JSON.parse(raw);
      msg = obj?.error?.message || raw;
      code = obj?.error?.code || code;
      statusText = obj?.error?.status || '';
    } catch {
      // ignore
    }
  }
  const lower = `${msg} ${statusText}`.toLowerCase();
  if (code === 404 || lower.includes('not_found') || lower.includes('is not found')) {
    return { status: 404, retryable: true, modelUnavailable: true, message: 'Model AI tạm không khả dụng.' };
  }
  if (code === 503 || code === 502 || code === 504 || lower.includes('unavailable') || lower.includes('high demand') || lower.includes('overloaded')) {
    return { status: 503, retryable: true, modelUnavailable: false, message: 'Máy chủ AI đang tạm thời quá tải (503). Vui lòng thử lại sau vài giây.' };
  }
  if (code === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return { status: 429, retryable: true, modelUnavailable: false, message: 'Hệ thống AI tạm chạm giới hạn lượt gọi. Vui lòng thử lại sau giây lát.' };
  }
  return { status: 500, retryable: false, modelUnavailable: false, message: msg || 'Lỗi khi phân tích câu lệnh.' };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, currentDate, categories } = req.body || {};
    const categoryListText =
      Array.isArray(categories) && categories.length > 0
        ? `\nDanh mục hợp lệ (cat phải là một trong các key sau):\n` +
          categories
            .filter((c: any) => c && typeof c.key === 'string')
            .slice(0, 200)
            .map((c: any) => `- ${c.key} (${String(c.name || c.key).slice(0, 80)} - ${c.type === 'in' ? 'Thu' : 'Chi'})`)
            .join('\n')
        : '';
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Chưa cấu hình GEMINI_API_KEY trong Environment Variables.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const todayStr = currentDate || new Date().toISOString().slice(0, 10);
    const prompt = `Hôm nay là ngày: ${todayStr}.
Người dùng nhập câu tiếng Việt nhanh để ghi sổ thu chi: "${text}".
Ví dụ:
- "ăn trưa bún chả 45k" => amount: 45000, type: "out", cat: "an_uong", note: "Ăn trưa bún chả"
- "đổ xăng 70k cây petrolimex bằng momo" => amount: 70000, type: "out", cat: "di_lai", note: "Đổ xăng cây petrolimex", account: "momo"
- "mua 2 hộp sữa bột meiji 1100k con cung" => amount: 1100000, type: "out", cat: "con_sua_bim", note: "Sữa bột meiji Con Cưng"
- "nhận lương 28 triệu về vcb" => amount: 28000000, type: "in", cat: "luong", note: "Lương tháng", account: "vietcombank"
- "hôm qua cà phê highland 65k" => date sẽ tính là ngày hôm qua (${todayStr} trừ 1 ngày).

${categoryListText}
Hãy bóc tách thành giao dịch chuẩn.`;

    const baseConfig = {
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
    };

    const attempts: Array<{ model: string; thinkingLevel?: ThinkingLevel; delay: number }> = [
      { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, delay: 0 },
      { model: 'gemini-3.1-flash-lite', delay: 500 },
      { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, delay: 1200 },
    ];

    let response: any = null;
    let lastErr: any = null;
    const skipped = new Set<string>();

    for (const attempt of attempts) {
      if (skipped.has(attempt.model)) continue;
      if (attempt.delay > 0 && lastErr && !parseFriendlyError(lastErr).modelUnavailable) {
        await sleep(attempt.delay);
      }
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Yêu cầu AI quá thời gian xử lý')), 22000)
        );
        const callPromise = ai.models.generateContent({
          model: attempt.model,
          contents: prompt,
          config: attempt.thinkingLevel
            ? { ...baseConfig, thinkingConfig: { thinkingLevel: attempt.thinkingLevel } }
            : baseConfig,
        });
        response = await Promise.race([callPromise, timeoutPromise]);
        break;
      } catch (err: any) {
        lastErr = err;
        const info = parseFriendlyError(err);
        if (info.modelUnavailable) {
          skipped.add(attempt.model);
          continue;
        }
        if (!info.retryable) throw err;
      }
    }

    if (!response) throw lastErr || new Error('Không nhận được phản hồi từ AI');

    const parsed = JSON.parse(response.text || '{}');
    return res.status(200).json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error quick parse text:', err);
    const info = parseFriendlyError(err);
    return res.status(info.status).json({ error: info.message });
  }
}
