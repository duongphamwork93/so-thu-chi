import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

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

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Yêu cầu Gemini quá thời gian xử lý')), 50000)
    );

    const callPromise = ai.models.generateContent({
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

    const response: any = await Promise.race([callPromise, timeoutPromise]);
    const parsed = JSON.parse(response.text || '{}');
    return res.status(200).json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error in financial advisor:', err);
    return res.status(500).json({ error: err.message || 'Lỗi khi phân tích tài chính với AI' });
  }
}
