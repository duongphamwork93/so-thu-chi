import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function classifyGeminiError(err: any): {
  status: number;
  retryable: boolean;
  modelUnavailable: boolean;
  message: string;
} {
  const raw = typeof err?.message === 'string' ? err.message : String(err || '');
  let parsedMsg = raw;
  let code: number | undefined = typeof err?.status === 'number' ? err.status : undefined;
  let statusText = '';

  if (raw.trim().startsWith('{')) {
    try {
      const obj = JSON.parse(raw);
      parsedMsg = obj?.error?.message || raw;
      code = obj?.error?.code || code;
      statusText = obj?.error?.status || '';
    } catch {
      // keep raw
    }
  }

  const lower = `${parsedMsg} ${statusText}`.toLowerCase();

  if (
    code === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied')
  ) {
    return {
      status: 403,
      retryable: false,
      modelUnavailable: false,
      message: 'Khóa GEMINI_API_KEY chưa hợp lệ hoặc chưa đủ quyền. Vui lòng kiểm tra lại cấu hình API Key.',
    };
  }

  if (code === 404 || lower.includes('not_found') || lower.includes('is not found')) {
    return {
      status: 404,
      retryable: true,
      modelUnavailable: true,
      message: 'Model AI tạm không khả dụng trên khóa API này.',
    };
  }

  if (
    code === 503 ||
    code === 500 ||
    code === 502 ||
    code === 504 ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily')
  ) {
    return {
      status: 503,
      retryable: true,
      modelUnavailable: false,
      message:
        'Máy chủ AI của Google đang tạm thời quá tải (mã 503). Bạn đợi vài giây rồi bấm "Thử quét lại" nhé!',
    };
  }

  if (code === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      retryable: true,
      modelUnavailable: false,
      message:
        'Hệ thống AI tạm chạm giới hạn lượt gọi (mã 429). Bạn đợi khoảng 15–30 giây rồi bấm "Thử quét lại" nhé!',
    };
  }

  if (lower.includes('quá thời gian') || lower.includes('timeout')) {
    return {
      status: 504,
      retryable: true,
      modelUnavailable: false,
      message: 'Yêu cầu quét hóa đơn quá thời gian phản hồi. Bạn vui lòng bấm "Thử quét lại".',
    };
  }

  return {
    status: 500,
    retryable: false,
    modelUnavailable: false,
    message: parsedMsg || 'Lỗi khi phân tích hóa đơn. Vui lòng thử lại.',
  };
}

async function generateWithFallback(
  ai: GoogleGenAI,
  contents: any,
  baseConfig: Record<string, any>
) {
  const attempts: Array<{ model: string; thinkingLevel?: ThinkingLevel; timeoutMs: number; delayBeforeMs: number }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, timeoutMs: 22000, delayBeforeMs: 0 },
    { model: 'gemini-3.1-flash-lite', timeoutMs: 20000, delayBeforeMs: 500 },
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, timeoutMs: 20000, delayBeforeMs: 1400 },
    { model: 'gemini-3.1-flash-lite', timeoutMs: 18000, delayBeforeMs: 1600 },
  ];

  const skippedModels = new Set<string>();
  let lastError: any = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    if (skippedModels.has(attempt.model)) continue;

    if (attempt.delayBeforeMs > 0 && lastError) {
      const prevInfo = classifyGeminiError(lastError);
      if (!prevInfo.modelUnavailable) {
        await sleep(attempt.delayBeforeMs);
      }
    }

    const config = attempt.thinkingLevel
      ? { ...baseConfig, thinkingConfig: { thinkingLevel: attempt.thinkingLevel } }
      : { ...baseConfig };

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Yêu cầu AI quá thời gian xử lý')), attempt.timeoutMs)
      );
      const callPromise = ai.models.generateContent({
        model: attempt.model,
        contents,
        config,
      });
      const response: any = await Promise.race([callPromise, timeoutPromise]);
      return response;
    } catch (err: any) {
      lastError = err;
      const info = classifyGeminiError(err);
      console.warn(`[parse-receipt] Attempt ${i + 1} (${attempt.model}) failed:`, info.status, err?.message || err);
      if (info.modelUnavailable) {
        skippedModels.add(attempt.model);
        continue;
      }
      if (!info.retryable) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Không thể kết nối tới máy chủ AI.');
}

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
    const { imageBase64, mimeType, rawText, todayDate } = req.body || {};

    // Resolve local upload date (YYYY-MM-DD). Prefer client local date; fallback to UTC+7 (Vietnam).
    const safeTodayDate =
      typeof todayDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todayDate.trim())
        ? todayDate.trim()
        : new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const currentYear = safeTodayDate.slice(0, 4);

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
      const marker = ';base64,';
      const idx = imageBase64.indexOf(marker);
      const cleanBase64 = idx !== -1 ? imageBase64.slice(idx + marker.length) : imageBase64;
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    const promptText = `Bạn là chuyên gia bóc tách biên lai thanh toán, hóa đơn siêu thị/nhà hàng/nhà thuốc, ảnh chụp màn hình LỊCH SỬ GIAO DỊCH / BIẾN ĐỘNG SỐ DƯ ngân hàng (Vietcombank, Techcombank, MB, Momo,...), và ảnh chụp màn hình đơn hàng từ các ứng dụng mua sắm / nhà thuốc (Shopee, Lazada, TikTok Shop, Tiki, FPT Long Châu, Pharmacity,...).

Ngày hiện tại (hôm nay) là: ${safeTodayDate}.

QUY TẮC RẤT QUAN TRỌNG:
1. TRÍCH XUẤT NHIỀU KHOẢN GIAO DỊCH (MULTI-TRANSACTIONS):
- Nếu ảnh chứa NHIỀU ĐƠN HÀNG HOẶC NHIỀU GIAO DỊCH (Ví dụ: danh sách đơn mua có 2 đơn của 2 shop khác nhau; hoặc màn hình sao kê có 2-5 giao dịch):
  BẠN BẮT BUỘC PHẢI TRÍCH XUẤT TẤT CẢ TỪNG GIAO DỊCH / TỪNG ĐƠN HÀNG ĐÓ VÀO MẢNG "transactions".
  Tuyệt đối không gộp chung lại thành 1 khoản duy nhất!
- Nếu ảnh chỉ là CHI TIẾT 1 ĐƠN HÀNG hoặc 1 BIÊN LAI CHUYỂN KHOẢN ngân hàng (gồm nhiều sản phẩm cộng lại thành 1 dòng "Thành tiền" / "Tổng thanh toán" hoặc 1 số tiền chuyển khoản duy nhất), mảng "transactions" chỉ chứa 1 phần tử với số tiền thực trả cuối cùng.

2. QUY TẮC BẮT BUỘC VỀ NGÀY MUA / NGÀY GIAO DỊCH (TUYỆT ĐỐI KHÔNG TỰ ĐOÁN MÒ):
- CHỈ đặt "hasDateInImage": true và điền "date" (YYYY-MM-DD) khi trên ảnh THỰC SỰ CÓ IN/HIỂN THỊ ngày mua hàng hoặc ngày giờ thanh toán (ví dụ: "24/11/2026", "19:24 24/11/2026", "15-10-2026 14:30", "Ngày 05/04/2026").
- Nếu ảnh chỉ ghi ngày/tháng mà không ghi năm (ví dụ "20/11"), dùng năm ${currentYear} và đặt "hasDateInImage": true.
- Nếu trên ảnh KHÔNG CÓ bất kỳ dòng ngày tháng mua hàng/thanh toán nào (ví dụ chỉ thấy giờ trên thanh trạng thái điện thoại như 11:33, danh sách sản phẩm và thông tin thanh toán mà không có ngày), TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ BỊA NGÀY CŨ HAY ĐOÁN NGÀY — bắt buộc đặt "hasDateInImage": false và "date": "".

3. QUY TẮC TÊN ĐỐI TÁC / CỬA HÀNG & ĐƠN HÀNG ONLINE / CHUYỂN KHOẢN:
- Chỉ ghi "Shopee" nếu trên ảnh thực sự có thương hiệu/giao diện Shopee.
- Nếu người nhận là "WINCOMMERCE" / "WINCOMMERCE GENERAL COMMERCIAL SERVICES" -> ghi merchant là "WinMart" và chọn danh mục 'cho_sieu_thi'.
- Nếu là đơn hàng nhà thuốc (ví dụ giao diện xanh dương có điểm thưởng chữ F của Nhà thuốc Long Châu, hoặc Pharmacity, An Khang...) thì ghi đúng tên nhà thuốc (ví dụ "Nhà thuốc Long Châu") hoặc tên cửa hàng hiển thị trên ảnh. Nếu không rõ tên cửa hàng, ghi ngắn gọn tên loại cửa hàng/đơn hàng (ví dụ "Đơn hàng nhà thuốc", "Đơn mua hàng online").
- amount: Lấy đúng số tiền thực trả cuối cùng ("Thành tiền", "Tổng thanh toán", "Tổng số tiền", hoặc số tiền chuyển khoản như "-VND 84,100" -> 84100) sau khi đã trừ giảm giá trực tiếp & voucher. Bỏ qua giá gạch bỏ.
- note: Tóm tắt tên sản phẩm chính của đơn hàng hoặc nội dung chuyển khoản ngắn gọn dễ hiểu.
- type: 'out' nếu là Tiền ra / Mua sắm / Thanh toán / Trừ tiền (-); 'in' nếu là Tiền vào / Nhận tiền / Cộng tiền (+).

4. Danh mục khả dụng (chọn đúng một mã key phù hợp nhất cho từng giao dịch):
- an_uong (Cơm, bún, phở, nhà hàng, quán ăn, GrabFood, ShopeeFood)
- cho_sieu_thi (WinMart, WinCommerce, Co.opmart, Bách Hóa Xanh, Lotte, Aeon, đồ đi chợ tươi sống)
- di_lai (Xăng xe Petrolimex, Grab, Be, Xanh SM, VETC, vé máy bay, gửi xe)
- dien (Tiền điện EVN)
- nuoc (Tiền nước sinh hoạt)
- internet (Internet FPT/VNPT/Viettel)
- do_sinh_hoat (Đồ dùng sinh hoạt: giấy ăn, giấy vệ sinh, nước giặt, nước rửa bát, túi rác, đồ tiêu hao trong nhà)
- con_sua_bim (Sữa bột, bỉm tã, nước yến/dinh dưỡng cho trẻ em, Con Cưng, KidsPlaza, BiboMart)
- giao_duc (Học phí, trường mầm non, sách vở, học tiếng Anh)
- con_quan_ao (Quần áo trẻ em, đồ dùng cho bé)
- con_do_dung (Đồ chơi cho bé)
- con_hoc_can_thiep (Học can thiệp, trị liệu ngôn ngữ/hoạt động cho bé)
- con_y_te (Khám nhi, tiêm chủng VNVC, thuốc/chăm sóc răng miệng cho bé)
- suc_khoe (Nhà thuốc Long Châu, Pharmacity, thuốc, nước súc miệng, thực phẩm chức năng, khám bệnh, bảo hiểm)
- cafe (Highlands, Phúc Long, Starbucks, trà sữa, quán cafe)
- mua_sam (Shopee, Lazada, TikTok Shop, quần áo, mỹ phẩm, điện tử)
- giai_tri (Xem phim CGV, du lịch, Netflix, Spotify, tiệc tùng)
- hieu_hi (Đám cưới, mừng tân gia, sinh nhật, phong bì, quà tặng)
- tiet_kiem (Gửi tiết kiệm)
- mua_vang (Mua vàng tích trữ: SJC, PNJ, DOJI, vàng nhẫn)
- dau_tu (Đầu tư chứng khoán, chứng chỉ quỹ, ETF)
- tra_no (Trả nợ vay ngân hàng, thẻ tín dụng, trả góp)
- khac (Chi tiêu khác)
- luong (Lương nhận vào)
- thuong (Tiền thưởng)
- thu_phu (Làm thêm ngoài giờ, bán hàng online)
- loi_dau_tu (Lãi tiết kiệm, cổ tức, tiền lời)
- duoc_tang (Tiền lì xì, người khác biếu tặng)

Văn bản bổ sung nếu có: ${rawText || ''}`;

    parts.push({ text: promptText });

    const response: any = await generateWithFallback(
      ai,
      { parts },
      {
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
                  merchant: { type: Type.STRING, description: 'Tên đối tác / cửa hàng / người nhận / người gửi' },
                  amount: { type: Type.NUMBER, description: 'Số tiền thực trả của khoản này (VNĐ, số nguyên > 0)' },
                  type: { type: Type.STRING, description: "'out' cho tiền ra/chi tiêu, 'in' cho tiền vào/thu nhập" },
                  category: { type: Type.STRING, description: 'Mã category key tương ứng' },
                  hasDateInImage: {
                    type: Type.BOOLEAN,
                    description: 'true CHỈ KHI có ngày mua/giao dịch hiển thị rõ ràng trong ảnh; false nếu ảnh không ghi ngày',
                  },
                  date: {
                    type: Type.STRING,
                    description: 'Ngày giao dịch YYYY-MM-DD nếu hasDateInImage là true; để chuỗi rỗng "" nếu ảnh không ghi ngày',
                  },
                  note: { type: Type.STRING, description: 'Tên sản phẩm chính hoặc nội dung chuyển khoản của khoản này' },
                },
                required: ['merchant', 'amount', 'type', 'category', 'hasDateInImage', 'date', 'note'],
              },
            },
            merchant: { type: Type.STRING },
            hasDateInImage: { type: Type.BOOLEAN },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            type: { type: Type.STRING },
            category: { type: Type.STRING },
            note: { type: Type.STRING },
          },
          required: ['transactions'],
        },
      }
    );

    const parsed = JSON.parse(response.text || '{}');

    const resolveTxDate = (rawDate: unknown, hasDateFlag: unknown) => {
      const cleaned = typeof rawDate === 'string' ? rawDate.trim() : '';
      const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(cleaned) && !Number.isNaN(Date.parse(cleaned));
      if (hasDateFlag === true && validFormat) {
        return { date: cleaned, dateDefaultedToToday: false };
      }
      return { date: safeTodayDate, dateDefaultedToToday: true };
    };

    // Ensure backwards compatibility and normalize dates
    if (!Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
      if (parsed.amount) {
        const resolved = resolveTxDate(parsed.date, parsed.hasDateInImage);
        parsed.transactions = [
          {
            merchant: parsed.merchant || 'Giao dịch',
            amount: parsed.amount || 0,
            type: parsed.type || 'out',
            category: parsed.category || 'khac',
            date: resolved.date,
            dateDefaultedToToday: resolved.dateDefaultedToToday,
            note: parsed.note || '',
          },
        ];
      } else {
        parsed.transactions = [];
      }
    } else {
      parsed.transactions = parsed.transactions.map((t: any) => {
        const resolved = resolveTxDate(t.date, t.hasDateInImage);
        return {
          ...t,
          date: resolved.date,
          dateDefaultedToToday: resolved.dateDefaultedToToday,
        };
      });
    }

    if (parsed.transactions.length > 0) {
      parsed.merchant = parsed.merchant || parsed.transactions[0].merchant;
      parsed.amount = parsed.amount || parsed.transactions[0].amount;
      parsed.type = parsed.type || parsed.transactions[0].type;
      parsed.category = parsed.category || parsed.transactions[0].category;
      parsed.date = parsed.transactions[0].date;
      parsed.dateDefaultedToToday = parsed.transactions[0].dateDefaultedToToday;
      parsed.note = parsed.note || parsed.transactions[0].note;
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error parsing receipt:', err);
    const info = classifyGeminiError(err);
    return res.status(info.status).json({ error: info.message });
  }
}
