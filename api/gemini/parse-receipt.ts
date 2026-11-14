import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  // Enable CORS for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType, rawText } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trong Environment Variables của Vercel.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

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

    return res.status(200).json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error parsing receipt:', err);
    return res.status(500).json({ error: err.message || 'Lỗi khi phân tích hoá đơn' });
  }
}
