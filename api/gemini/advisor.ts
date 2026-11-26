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
  return { status: 500, retryable: false, modelUnavailable: false, message: msg || 'Lỗi khi phân tích tài chính với AI.' };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { month, income, expense, byCategory, netWorth, debts, savings, budget } = req.body || {};

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

    const baseConfig = {
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
          setTimeout(() => reject(new Error('Yêu cầu AI quá thời gian xử lý')), 25000)
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
    console.error('Error in financial advisor:', err);
    const info = parseFriendlyError(err);
    return res.status(info.status).json({ error: info.message });
  }
}
