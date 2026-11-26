import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      audioBase64,
      mimeType,
      transcript,
      currentDate,
      accounts = [],
      cards = [],
      categories = [],
      savedTrips = [],
    } = req.body || {};

    if (!audioBase64 && (!transcript || !String(transcript).trim())) {
      return res.status(400).json({ error: 'Vui lòng ghi âm hoặc nhập câu nói giao dịch.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ để nhận diện giọng nói AI.',
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

    let spokenText = typeof transcript === 'string' ? transcript.trim() : '';
    let audioPart: { inlineData: { mimeType: string; data: string } } | null = null;

    // 1. Prepare audio payload & transcribe using gemini-3.5-transcribe
    if (audioBase64 && typeof audioBase64 === 'string') {
      const trimmedInput = audioBase64.trim();
      const b64MarkerIdx = trimmedInput.indexOf(';base64,');
      const cleanBase64 = (
        b64MarkerIdx !== -1
          ? trimmedInput.slice(b64MarkerIdx + 8)
          : trimmedInput.replace(/^data:[^,]*,/, '')
      ).replace(/\s+/g, '');

      let detectedMime = typeof mimeType === 'string' && mimeType ? mimeType : '';
      if (!detectedMime && trimmedInput.startsWith('data:')) {
        const semiIdx = trimmedInput.indexOf(';');
        const commaIdx = trimmedInput.indexOf(',');
        const endIdx = semiIdx !== -1 && (commaIdx === -1 || semiIdx < commaIdx) ? semiIdx : commaIdx;
        if (endIdx > 5) detectedMime = trimmedInput.slice(5, endIdx);
      }
      const rawMime = (detectedMime || 'audio/wav').split(';')[0].trim().toLowerCase();
      const cleanMimeType =
        rawMime === 'audio/x-m4a' || rawMime === 'video/mp4' ? 'audio/mp4' : rawMime || 'audio/wav';

      if (cleanBase64.length > 20) {
        audioPart = {
          inlineData: {
            mimeType: cleanMimeType,
            data: cleanBase64,
          },
        };

        const transcribeTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Hết thời gian chuyển giọng nói thành văn bản')), 30000)
        );

        const transcribePromise = ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              audioPart,
              {
                text: 'Chép lại chính xác nguyên văn tiếng Việt trong đoạn ghi âm giao dịch tài chính cá nhân này. Giữ nguyên mọi con số, đơn vị tiền (nghìn, trăm, triệu, k), tên ngân hàng/ví, tên người và địa điểm. Chỉ trả về đúng câu nói, không thêm lời bình.',
              },
            ],
          },
        });

        try {
          const transcribeRes: any = await Promise.race([transcribePromise, transcribeTimeout]);
          const partText = Array.isArray(transcribeRes?.candidates?.[0]?.content?.parts)
            ? transcribeRes.candidates[0].content.parts
                .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
                .join(' ')
            : '';
          const transcribed = (transcribeRes?.text || partText || '').trim();
          if (transcribed) {
            spokenText = transcribed;
          }
        } catch (transErr) {
          console.warn('gemini-3.5-transcribe failed, will try direct audio fallback:', transErr);
        }
      }
    }

    // Prepare common context for transaction parsing
    const todayStr = currentDate || new Date().toISOString().slice(0, 10);
    const accountNames = [
      ...(Array.isArray(accounts) ? accounts.map((a: any) => a?.name).filter(Boolean) : []),
      ...(Array.isArray(cards) ? cards.map((c: any) => `${c?.name} (thẻ tín dụng)`).filter(Boolean) : []),
    ];
    const catListText =
      Array.isArray(categories) && categories.length > 0
        ? categories.map((c: any) => `${c.key} (${c.name} - ${c.type === 'in' ? 'Thu' : 'Chi'})`).join(', ')
        : 'an_uong (Ăn uống), cho_sieu_thi (Chợ siêu thị), di_lai (Đi lại xăng xe), nha_o (Nhà ở điện nước), con_sua_bim (Sữa bỉm), giao_duc (Học phí), con_do_dung (Đồ dùng bé), con_y_te (Y tế bé), suc_khoe (Sức khỏe), cafe (Cà phê), mua_sam (Mua sắm), giai_tri (Giải trí du lịch), hieu_hi (Hiếu hỉ quà tặng), tiet_kiem (Tiết kiệm), tra_no (Trả nợ), khac (Khác), luong (Lương), thuong (Thưởng), thu_phu (Làm thêm), loi_dau_tu (Lãi đầu tư), duoc_tang (Được tặng lì xì), thu_khac (Thu khác)';

    const tripContext =
      Array.isArray(savedTrips) && savedTrips.length > 0
        ? `Các chuyến đi/sự kiện hiện có: ${savedTrips.join(', ')}.`
        : '';

    const rulesText = `Hôm nay là ngày: ${todayStr}.
Danh sách tài khoản/thẻ hiện có của người dùng: ${accountNames.length > 0 ? accountNames.join(', ') : 'Chưa rõ'}.
Danh sách mã danh mục (category key) hợp lệ: ${catListText}.
${tripContext}

Quy tắc bóc tách chuẩn:
1. amount: Đổi chính xác chữ hoặc số thành số nguyên VNĐ (VD: "một trăm nghìn" -> 100000, "hai triệu rưỡi" -> 2500000, "năm mươi ngàn" -> 50000, "45k" -> 45000).
2. type: 'in' nếu là thu nhập/nhận tiền/lương/thưởng/được trả nợ/được tặng; 'out' nếu là chi tiêu/mua/trả tiền/đi ăn/đổ xăng.
3. category: Chọn đúng 1 mã key phù hợp nhất từ danh sách danh mục hợp lệ ở trên.
4. account: Nếu có nhắc đến tài khoản, ví hoặc thẻ (VD: Vietcombank, VCB, Techcombank, MoMo, Tiền mặt, VPBank...), trả về đúng tên tài khoản khớp nhất từ danh sách của người dùng hoặc tên được nhắc đến.
5. date: Định dạng YYYY-MM-DD. Tự tính nếu nói "hôm nay", "hôm qua", "hôm kia", "ngày 5 tháng này"...
6. note: Ghi chú ngắn gọn, tự nhiên rõ nghĩa (VD: "Đi siêu thị", "Ăn trưa bún chả").
7. counterparty: Tên người hoặc đối tác thu/chi cùng nếu có nhắc (VD: "Anh Nam", "Chị Lan").
8. location: Tên địa điểm, quán, siêu thị nếu có nhắc (VD: "Siêu thị WinMart", "Quán Phở 24").
9. tripName: Tên chuyến đi hoặc sự kiện nếu có nhắc (VD: "Du lịch Đà Lạt", "Tết 2026").
10. beneficiary: Chỉ điền nếu rõ ràng dành cho ai: 'me', 'spouse', 'child1', 'child2', 'both_children', hoặc 'family'.`;

    // 2A. Fallback: if gemini-3.5-transcribe yielded empty text but we have valid audio, listen & parse directly with gemini-4-hydrogen
    if (!spokenText && audioPart) {
      const directTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Yêu cầu phân tích giọng nói quá thời gian xử lý')), 40000)
      );
      const directPromise = ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            audioPart,
            {
              text: `Hãy nghe đoạn ghi âm tiếng Việt đính kèm. Chép lại chính xác nội dung câu nói vào trường "transcript", đồng thời bóc tách thông tin giao dịch tài chính cá nhân theo quy tắc sau:\n${rulesText}\nNếu đoạn âm thanh hoàn toàn im lặng hoặc không có lời nói tiếng Việt rõ ràng, trả về transcript: "" và amount: 0.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: { type: Type.STRING, description: 'Nguyên văn câu nói tiếng Việt nghe được trong audio' },
              amount: { type: Type.NUMBER, description: 'Số tiền VNĐ dương' },
              type: { type: Type.STRING, description: "'out' hoặc 'in'" },
              category: { type: Type.STRING, description: 'Mã category key hợp lệ' },
              note: { type: Type.STRING, description: 'Ghi chú giao dịch ngắn gọn' },
              date: { type: Type.STRING, description: 'Ngày YYYY-MM-DD' },
              account: { type: Type.STRING, description: 'Tên tài khoản/ví/thẻ thanh toán nếu có' },
              beneficiary: { type: Type.STRING, description: 'Người thụ hưởng nếu rõ' },
              location: { type: Type.STRING, description: 'Địa điểm chi tiêu nếu có' },
              counterparty: { type: Type.STRING, description: 'Với ai / đối tượng thu chi nếu có' },
              tripName: { type: Type.STRING, description: 'Tên chuyến đi / sự kiện nếu có' },
            },
            required: ['transcript', 'amount', 'type', 'category', 'note', 'date'],
          },
        },
      });

      const directRes: any = await Promise.race([directPromise, directTimeout]);
      const directParsed = JSON.parse(directRes?.text || '{}');
      if (directParsed?.transcript && String(directParsed.transcript).trim()) {
        return res.status(200).json({
          success: true,
          data: {
            ...directParsed,
            transcript: String(directParsed.transcript).trim(),
          },
        });
      }
    }

    if (!spokenText) {
      return res.status(400).json({
        error: 'Không nghe rõ nội dung giọng nói. Bạn vui lòng nói gần micro rõ hơn hoặc thử lại.',
      });
    }

    // 2B. Structured transaction parsing from transcribed text
    const parsePrompt = `Câu nói tiếng Việt người dùng vừa ghi âm để ghi sổ thu chi:
"${spokenText}"

${rulesText}

Hãy phân tích và trả về JSON chính xác.`;

    const parseBaseConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          amount: { type: Type.NUMBER, description: 'Số tiền VNĐ dương' },
          type: { type: Type.STRING, description: "'out' hoặc 'in'" },
          category: { type: Type.STRING, description: 'Mã category key hợp lệ' },
          note: { type: Type.STRING, description: 'Ghi chú giao dịch ngắn gọn' },
          date: { type: Type.STRING, description: 'Ngày YYYY-MM-DD' },
          account: { type: Type.STRING, description: 'Tên tài khoản/ví/thẻ thanh toán nếu có' },
          beneficiary: { type: Type.STRING, description: 'Người thụ hưởng nếu rõ' },
          location: { type: Type.STRING, description: 'Địa điểm chi tiêu nếu có' },
          counterparty: { type: Type.STRING, description: 'Với ai / đối tượng thu chi nếu có' },
          tripName: { type: Type.STRING, description: 'Tên chuyến đi / sự kiện nếu có' },
        },
        required: ['amount', 'type', 'category', 'note', 'date'],
      },
    };

    const parseModels: Array<{ model: string; thinkingLevel?: ThinkingLevel }> = [
      { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
      { model: 'gemini-3.1-flash-lite' },
    ];

    let parseRes: any = null;
    let lastParseErr: any = null;
    for (let idx = 0; idx < parseModels.length; idx++) {
      const m = parseModels[idx];
      try {
        const parseTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Yêu cầu phân tích giọng nói quá thời gian xử lý')), 22000)
        );
        const parsePromise = ai.models.generateContent({
          model: m.model,
          contents: parsePrompt,
          config: m.thinkingLevel
            ? { ...parseBaseConfig, thinkingConfig: { thinkingLevel: m.thinkingLevel } }
            : parseBaseConfig,
        });
        parseRes = await Promise.race([parsePromise, parseTimeout]);
        break;
      } catch (pErr) {
        lastParseErr = pErr;
        if (idx < parseModels.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
    if (!parseRes) throw lastParseErr || new Error('Không thể phân tích nội dung giọng nói.');

    const parsed = JSON.parse(parseRes?.text || '{}');

    return res.status(200).json({
      success: true,
      data: {
        ...parsed,
        transcript: spokenText,
      },
    });
  } catch (err: any) {
    console.error('Error in voice-parse:', err);
    let errMsg = err?.message || 'Lỗi khi nhận diện giọng nói. Vui lòng thử lại.';
    let status = 500;
    if (typeof errMsg === 'string' && errMsg.trim().startsWith('{')) {
      try {
        const parsedErr = JSON.parse(errMsg);
        errMsg = parsedErr?.error?.message || errMsg;
        if (parsedErr?.error?.code === 503) status = 503;
        if (parsedErr?.error?.code === 429) status = 429;
      } catch {
        // keep original
      }
    }
    const lower = String(errMsg).toLowerCase();
    if (status === 503 || lower.includes('high demand') || lower.includes('unavailable') || lower.includes('overloaded')) {
      status = 503;
      errMsg = 'Máy chủ AI đang tạm thời quá tải (503). Bạn đợi vài giây rồi thử ghi âm lại nhé!';
    } else if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
      status = 429;
      errMsg = 'Hệ thống AI tạm chạm giới hạn lượt gọi. Vui lòng thử lại sau giây lát.';
    }
    return res.status(status).json({
      error: errMsg,
    });
  }
}
