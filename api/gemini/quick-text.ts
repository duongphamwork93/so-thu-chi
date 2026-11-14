import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, currentDate } = req.body || {};
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

Hãy bóc tách thành giao dịch chuẩn.`;

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

    const response: any = await Promise.race([callPromise, timeoutPromise]);
    const parsed = JSON.parse(response.text || '{}');
    return res.status(200).json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error quick parse text:', err);
    return res.status(500).json({ error: err.message || 'Lỗi khi phân tích câu lệnh' });
  }
}
