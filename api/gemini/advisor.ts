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
  return { status: 500, retryable: false, modelUnavailable: false, message: msg || 'Lỗi khi kiểm toán tài chính với AI.' };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { audit } = req.body || {};
    if (!audit || typeof audit !== 'object') {
      return res.status(400).json({ error: 'Thiếu dữ liệu kiểm toán tài chính.' });
    }

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

    // Giới hạn kích thước dữ liệu gửi AI
    const safeAudit = {
      ...audit,
      transactions: Array.isArray(audit.transactions) ? audit.transactions.slice(-300) : [],
    };
    const auditJson = JSON.stringify(safeAudit).slice(0, 120000);

    const systemInstruction = `Bạn là Chuyên gia Hoạch định Tài chính Gia đình (CFP) tại Việt Nam, đang KIỂM TOÁN tài chính cá nhân cho một gia đình có con nhỏ.
Văn phong: thẳng thắn, sắc sảo, thực tế, đi thẳng vào SỐ LIỆU THẬT của người dùng (tên ví, tên thẻ, số tiền, ngày cụ thể). Không nói lý thuyết chung chung, không khuyên kiểu sách vở.
QUY TẮC BẮT BUỘC:
1. Mọi đánh giá chi tiêu dựa trên HỆ THỐNG 6 HŨ (NEC, PLAY, EDUC, GIVE, LTS, FFA) với ngân sách trần = Thu nhập định mức tháng × % từng hũ. KHÔNG dùng quy tắc 50/30/20.
2. Giao dịch "Trung tính" (Cho vay / Mua hộ / Tạm ứng) KHÔNG phải chi tiêu gia đình — tách riêng, chỉ dùng để nhắc thu hồi.
3. Thanh khoản: so tiền mặt trong ví/tài khoản với dư nợ thẻ, đặc biệt sao kê sắp đến hạn. "Tiền mặt thực khả dụng" = Tiền mặt − Dư nợ thẻ.
4. Số tiền viết dạng Việt Nam có dấu chấm (VD: 1.250.000đ). Ngày viết dd/mm.
5. VÙNG ĐỆM AN TOÀN (buffer): khoản thu giữa tháng (khoảng 25–28 triệu) có thể về từ ngày midIncomeFrom đến bufferEnd (thường 10–12). Từ sau kỳ lương cuối tháng, ví giữ vùng đệm phải đủ: khoản cố định đến hạn trước bufferEnd (VD học phí ngày 10) + sao kê thẻ đến hạn + chi thiết yếu mỗi ngày đến hết bufferEnd. Nếu buffer.active và buffer.shortfall > 0 thì PHẢI cảnh báo trong phần thanh khoản và đưa 1 hành động bù vùng đệm vào kế hoạch.
6. NGƯỜI GÁC CỔNG TIẾT KIỆM (savingsGoal): mục tiêu tiết kiệm tháng = savingsGoal.targetAmount (savingsGoal.targetPct% thu nhập định mức), đổ vào các Quỹ mục tiêu / sổ tiết kiệm (savings). BẮT BUỘC trả lời thẳng 3 câu trong savingsGate:
   (1) Tháng này có trích đủ mục tiêu không, hay hụt bao nhiêu tiền (dựa trên tiền mặt dư sau khi trừ chi tiêu và dư nợ thẻ, projectedSavable, projectedGap)?
   (2) Đích danh 2–3 nguyên nhân cụ thể đang kéo lùi tiết kiệm (hũ vượt trần với số tiền, nhóm đơn lắt nhắt, tiền mua hộ chưa thu…).
   (3) Mệnh lệnh cắt giảm đến hết kỳ: hạn mức chi tối đa mỗi ngày (tham khảo dailyCapToHitTarget) và danh sách khoản cần "đóng băng" ngay.
7. Kế hoạch hành động đúng 3 việc, mỗi việc có con số thực tế và hạn chót trong 7 ngày tới (tính từ ngày hôm nay trong dữ liệu).`;

    const prompt = `DỮ LIỆU KIỂM TOÁN (JSON, đã được app tính sẵn các con số cứng — hãy tin tưởng các số này):
${auditJson}

Giải thích trường:
- period: kỳ đang xem (elapsedPct = % thời gian đã trôi qua, daysLeft = số ngày còn lại).
- monthlyIncome, jarTargets: thu nhập định mức và % từng hũ.
- jars[]: từng hũ với budget (trần), spent (đã chi), remaining (còn lại, âm = vượt trần), usedPct.
- liquidity: tiền mặt từng ví (cashAccounts), tổng dư nợ thẻ, realSpendable, dueSoonTotal = sao kê phải trả trong 35 ngày.
- cards[]: dư nợ, số sao kê còn phải trả (statementDue), hạn trả (dueDate), selfLimit (hạn mức tự đặt).
- pendingLoans[]: khoản Cho vay/Mua hộ chưa thấy bút toán Thu nợ.
- leaks[]: nhóm giao dịch nhỏ (≤500k) tần suất cao trong kỳ.
- savingsGoal: mục tiêu tiết kiệm tháng và dự báo đạt/hụt (projectedGap > 0 = hụt).
- buffer: vùng đệm chờ thu nhập giữa tháng (accountName, accountBalance, required, shortfall, bufferEnd, fixedItems, cardItems, essentialTotal).
- savings: sổ tiết kiệm & quỹ mục tiêu.
- transactions[]: toàn bộ giao dịch trong kỳ (jar = mã hũ, "Trung tính" hoặc "Thu").

Hãy lập BÁO CÁO KIỂM TOÁN TÀI CHÍNH CÁ NHÂN gồm 4 phần theo schema.`;

    const baseConfig = {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          healthScore: { type: Type.NUMBER, description: 'Điểm sức khỏe tài chính 0-100' },
          healthStatus: { type: Type.STRING, description: 'Xuất sắc | Tốt | Cần lưu ý | Báo động' },
          headline: { type: Type.STRING, description: 'Một câu kết luận sắc gọn về tình hình (≤ 25 từ)' },
          liquidity: {
            type: Type.OBJECT,
            properties: {
              level: { type: Type.STRING, description: "'safe' | 'warning' | 'danger'" },
              verdict: { type: Type.STRING, description: 'Nhận định thanh khoản, nêu tên ví/thẻ và số tiền cụ thể (2-3 câu)' },
            },
            required: ['level', 'verdict'],
          },
          jars: {
            type: Type.OBJECT,
            properties: {
              verdict: { type: Type.STRING, description: 'Nhận định chung 6 hũ, chỉ rõ hũ lẹm nhiều nhất và số tiền (2-3 câu)' },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING, description: 'NEC | PLAY | EDUC | GIVE | LTS | FFA' },
                    comment: { type: Type.STRING, description: 'Nhận xét 1 câu cho hũ này' },
                  },
                  required: ['code', 'comment'],
                },
              },
            },
            required: ['verdict', 'items'],
          },
          issues: {
            type: Type.OBJECT,
            properties: {
              loansComment: { type: Type.STRING, description: 'Nhắc các khoản cho vay/mua hộ cần đòi (rỗng nếu không có)' },
              leaksComment: { type: Type.STRING, description: 'Chỉ ra điểm rò rỉ tiền từ giao dịch lắt nhắt (rỗng nếu không có)' },
              otherFindings: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Tối đa 3 phát hiện bất thường khác' },
            },
            required: ['loansComment', 'leaksComment', 'otherFindings'],
          },
          savingsGate: {
            type: Type.OBJECT,
            properties: {
              progress: { type: Type.STRING, description: 'Trả lời câu 1: đủ hay hụt mục tiêu tiết kiệm, hụt bao nhiêu (có số tiền)' },
              gapAmount: { type: Type.NUMBER, description: 'Số tiền dự kiến hụt mục tiêu (0 nếu đủ)' },
              causes: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Câu 2: 2-3 nguyên nhân đích danh, có số tiền' },
              dailyCap: { type: Type.NUMBER, description: 'Câu 3: hạn mức chi tối đa mỗi ngày đến hết kỳ (VNĐ)' },
              freeze: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Câu 3: các khoản/nhóm chi cần đóng băng ngay' },
            },
            required: ['progress', 'gapAmount', 'causes', 'dailyCap', 'freeze'],
          },
          actionPlan: {
            type: Type.ARRAY,
            description: 'Đúng 3 hành động trong 7 ngày tới',
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Hành động ngắn gọn, có con số' },
                detail: { type: Type.STRING, description: 'Cách làm cụ thể 1-2 câu' },
                amount: { type: Type.NUMBER, description: 'Số tiền liên quan (VNĐ), 0 nếu không có' },
                deadline: { type: Type.STRING, description: 'Hạn chót dạng dd/mm' },
              },
              required: ['title', 'detail', 'amount', 'deadline'],
            },
          },
        },
        required: ['healthScore', 'healthStatus', 'headline', 'liquidity', 'jars', 'issues', 'savingsGate', 'actionPlan'],
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
