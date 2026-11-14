import { GoogleGenAI, Type } from '@google/genai';

// Reference benchmark prices for Vietnamese stocks, gold, silver, crypto & funds
const BENCHMARK_MAP: Record<string, { price: number; name: string; note: string }> = {
  FPT: { price: 138500, name: 'Cổ phiếu FPT Corp', note: 'Sàn HOSE' },
  VCB: { price: 91500, name: 'Vietcombank', note: 'Sàn HOSE' },
  HPG: { price: 27400, name: 'Tập đoàn Hòa Phát', note: 'Sàn HOSE' },
  MWG: { price: 64200, name: 'Thế Giới Di Động', note: 'Sàn HOSE' },
  SSI: { price: 32600, name: 'Chứng khoán SSI', note: 'Sàn HOSE' },
  TCB: { price: 24200, name: 'Techcombank', note: 'Sàn HOSE' },
  VHM: { price: 42500, name: 'Vinhomes', note: 'Sàn HOSE' },
  VIC: { price: 41800, name: 'Vingroup', note: 'Sàn HOSE' },
  MBB: { price: 25400, name: 'MBBank', note: 'Sàn HOSE' },
  MSN: { price: 74500, name: 'Masan Group', note: 'Sàn HOSE' },
  VPB: { price: 19800, name: 'VPBank', note: 'Sàn HOSE' },
  CTG: { price: 36500, name: 'VietinBank', note: 'Sàn HOSE' },
  ACB: { price: 25800, name: 'Á Châu ACB', note: 'Sàn HOSE' },
  VNM: { price: 68500, name: 'Vinamilk', note: 'Sàn HOSE' },
  DGC: { price: 114000, name: 'Hóa chất Đức Giang', note: 'Sàn HOSE' },

  // Vàng
  SJC: { price: 8850000, name: 'Vàng miếng SJC (1 chỉ)', note: 'Giá vàng SJC niêm yết' },
  SJC9999: { price: 8850000, name: 'Vàng miếng SJC 999.9 (1 chỉ)', note: 'Giá vàng SJC niêm yết' },
  VANG9999: { price: 8750000, name: 'Vàng nhẫn trơn 999.9 (1 chỉ)', note: 'Giá vàng nhẫn 9999' },
  VANG_NHAN: { price: 8750000, name: 'Vàng nhẫn 999.9 (1 chỉ)', note: 'Giá vàng nhẫn tròn trơn' },
  VANG_24K: { price: 8700000, name: 'Vàng 24K (1 chỉ)', note: 'Giá vàng 24K trang sức' },
  DOJI: { price: 8820000, name: 'Vàng DOJI (1 chỉ)', note: 'Giá tập đoàn DOJI' },
  PNJ: { price: 8780000, name: 'Vàng PNJ (1 chỉ)', note: 'Giá vàng PNJ 24K' },

  // Bạc
  BAC: { price: 1080000, name: 'Bạc 999 Phú Quý (1 lượng)', note: 'Giá bạc miếng 999' },
  BAC999: { price: 1080000, name: 'Bạc ta 999 (1 lượng)', note: 'Giá bạc nguyên chất' },
  BAC_PHU_QUY: { price: 1080000, name: 'Bạc Phú Quý 999 (1 lượng)', note: 'Giá bạc Phú Quý' },
  BAC_THOI: { price: 10800000, name: 'Bạc thỏi (10 lượng / cây)', note: 'Giá bạc thỏi 10 lượng' },
  SILVER: { price: 1080000, name: 'Bạc nguyên chất (1 lượng)', note: 'Giá bạc thị trường' },

  // Quỹ & Crypto
  DCDS: { price: 67200, name: 'Quỹ Dragon Capital DCDS', note: 'NAV chứng chỉ quỹ' },
  VESAF: { price: 34500, name: 'Quỹ VinaCapital VESAF', note: 'NAV chứng chỉ quỹ' },
  BTC: { price: 2420000000, name: 'Bitcoin (BTC)', note: 'Quy đổi VNĐ' },
  ETH: { price: 85000000, name: 'Ethereum (ETH)', note: 'Quy đổi VNĐ' },
  USDT: { price: 25650, name: 'Tether USD (USDT)', note: 'Tỷ giá P2P VNĐ' },
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { holdings = [] } = req.body || {};

    if (!Array.isArray(holdings) || holdings.length === 0) {
      return res.status(200).json({
        success: true,
        updatedHoldings: [],
        message: 'Chưa có mã đầu tư nào trong danh mục để cập nhật.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Helper fallback using benchmark map
    const applyFallback = () => {
      return holdings.map((h: any) => {
        const cleanCode = (h.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const matched = BENCHMARK_MAP[cleanCode] || Object.entries(BENCHMARK_MAP).find(([k]) => cleanCode.includes(k))?.[1];

        if (matched) {
          const oldPrice = Number(h.currentPrice) || Number(h.buyPrice) || matched.price;
          const newPrice = matched.price;
          const diff = newPrice - oldPrice;
          const changePercent = oldPrice > 0 ? (diff / oldPrice) * 100 : 0;
          return {
            id: h.id,
            code: h.code,
            name: h.name || matched.name,
            oldPrice,
            newPrice,
            diff,
            changePercent: Number(changePercent.toFixed(2)),
            note: matched.note,
          };
        }

        // Keep current price if unknown code
        const price = Number(h.currentPrice) || Number(h.buyPrice) || 0;
        return {
          id: h.id,
          code: h.code,
          name: h.name,
          oldPrice: price,
          newPrice: price,
          diff: 0,
          changePercent: 0,
          note: 'Giữ nguyên giá hiện tại (Mã chưa có trong danh mục tham chiếu)',
        };
      });
    };

    if (!apiKey) {
      const fallbackResult = applyFallback();
      return res.status(200).json({
        success: true,
        updatedHoldings: fallbackResult,
        source: 'benchmark',
        updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      });
    }

    // Call Gemini 3.1 Flash Lite to fetch realistic current market prices
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const promptItems = holdings.map((h: any) => ({
        id: h.id,
        code: h.code,
        name: h.name,
        type: h.type,
        currentPrice: h.currentPrice,
      }));

      const prompt = `Bạn là chuyên viên tài chính thị trường Việt Nam.
Hãy cập nhật GIÁ THỊ TRƯỜNG THỰC TẾ HÔM NAY (bằng VNĐ) cho danh sách tài sản sau:
${JSON.stringify(promptItems, null, 2)}

Quy tắc đơn vị và giá thực tế:
1. Cổ phiếu Việt Nam: Đơn vị VNĐ/cổ phiếu (VD: FPT khoảng 130k-145k, VCB 85k-95k, HPG 26k-30k, MWG 60k-68k...).
2. Vàng (SJC, Vàng 9999, DOJI, PNJ):
   - Nếu số lượng theo "chỉ" (giá hiện tại đang ở mức 8-9 triệu), giá 1 chỉ khoảng 8.500.000 - 8.950.000 VNĐ.
   - Nếu số lượng theo "lượng" (giá cũ đang ở mức 85-90 triệu), giá khoảng 86.000.000 - 89.500.000 VNĐ.
3. Bạc (Bạc Phú Quý, Bạc 999, Bạc thỏi):
   - Đơn vị 1 lượng (cây bạc) khoảng 980.000 - 1.250.000 VNĐ.
   - Đơn vị 1 kg / 10 lượng khoảng 10.000.000 - 12.000.000 VNĐ.
4. Tiền điện tử (BTC, ETH, USDT): Quy đổi sang VNĐ (BTC ~2.3 - 2.5 tỷ VNĐ, ETH ~80-90 triệu VNĐ, USDT ~25.600 VNĐ).
5. Quỹ (DCDS, VESAF): NAV khoảng 30k-70k VNĐ.

Hãy trả về giá thị trường mới nhất thực tế và hợp lý cho từng mã.`;

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Yêu cầu Gemini quá thời gian xử lý')), 25000)
      );

      const callPromise = ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                code: { type: Type.STRING },
                newPrice: { type: Type.NUMBER, description: 'Giá thị trường mới (VNĐ, số nguyên dương)' },
                note: { type: Type.STRING, description: 'Ghi chú nguồn giá (VD: Sàn HOSE, Vàng SJC, Bạc Phú Quý...)' },
              },
              required: ['id', 'code', 'newPrice'],
            },
          },
        },
      });

      const response: any = await Promise.race([callPromise, timeoutPromise]);
      const parsedArray = JSON.parse(response.text || '[]');

      if (Array.isArray(parsedArray) && parsedArray.length > 0) {
        const resultMap = new Map(parsedArray.map((item: any) => [item.id || item.code, item]));
        const updatedHoldings = holdings.map((h: any) => {
          const resItem = resultMap.get(h.id) || resultMap.get(h.code);
          const oldPrice = Number(h.currentPrice) || Number(h.buyPrice) || 0;
          const newPrice = resItem && Number(resItem.newPrice) > 0 ? Number(resItem.newPrice) : oldPrice;
          const diff = newPrice - oldPrice;
          const changePercent = oldPrice > 0 ? (diff / oldPrice) * 100 : 0;
          return {
            id: h.id,
            code: h.code,
            name: h.name,
            oldPrice,
            newPrice,
            diff,
            changePercent: Number(changePercent.toFixed(2)),
            note: resItem?.note || 'Cập nhật từ AI thị trường',
          };
        });

        return res.status(200).json({
          success: true,
          updatedHoldings,
          source: 'gemini-ai',
          updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    } catch (aiErr) {
      console.warn('Gemini price update failed, falling back to benchmark:', aiErr);
    }

    // Fallback if AI call timed out or failed
    const fallbackResult = applyFallback();
    return res.status(200).json({
      success: true,
      updatedHoldings: fallbackResult,
      source: 'benchmark',
      updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    });
  } catch (err: any) {
    console.error('Error updating market prices:', err);
    return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật giá thị trường' });
  }
}
