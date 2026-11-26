import { guessCategoryByText, removeVietnameseAccents } from '../constants/categories';
import { StorageData, TransactionType } from '../types/finance';

export interface QuickParseResult {
  amount: number;
  type: TransactionType;
  cat: string;
  accountId?: string;
  note: string;
  date?: string;
  /** Đọc từ tin nhắn biến động số dư ngân hàng */
  isBankSms: boolean;
}

interface AmountCandidate {
  value: number;
  index: number;
  length: number;
  sign: '+' | '-' | '';
  score: number;
}

const norm = (s: string) => removeVietnameseAccents(s).replace(/\s+/g, ' ').trim();

/** Đổi một cụm số tiền tiếng Việt ("85k", "1tr5", "1,5 triệu", "2.000.000đ") ra số. */
export function parseMoneyToken(raw: string): number {
  const t = norm(raw).replace(/\s+/g, '');
  let m = t.match(/^(\d+(?:[.,]\d+)?)(?:tr|trieu|m)(\d{1,3})?$/);
  if (m) {
    const main = parseFloat(m[1].replace(',', '.')) * 1_000_000;
    const sub = m[2] ? parseFloat(m[2]) * Math.pow(10, 6 - m[2].length) : 0;
    return Math.round(main + sub);
  }
  m = t.match(/^(\d+(?:[.,]\d+)?)(?:ty|ti)$/);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1_000_000_000);
  m = t.match(/^(\d+(?:[.,]\d+)?)(?:k|nghin|ngan|ng)$/);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1_000);
  m = t.match(/^(\d{1,3}(?:[.,]\d{3})+)(?:d|vnd|dong)?$/);
  if (m) return parseInt(m[1].replace(/[.,]/g, ''), 10);
  m = t.match(/^(\d+)(?:d|vnd|dong)?$/);
  if (m) return parseInt(m[1], 10);
  return 0;
}

const MONEY_RE =
  /([+-])?\s?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s?(k|nghìn|nghin|ngàn|ngan|tr(?:iệu|ieu)?|m|tỷ|ty|vnd|vnđ|đ|d|dong|đồng)?(\d{1,3})?(?![\w%/:])/gi;

function findAmountCandidates(text: string): AmountCandidate[] {
  const out: AmountCandidate[] = [];
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(text))) {
    const [full, sign, num, unit, tail] = m;
    const token = `${num}${unit || ''}${tail && unit && /^tr/i.test(unit) ? tail : ''}`;
    const value = parseMoneyToken(token);
    if (!value) continue;
    const before = norm(text.slice(Math.max(0, m.index - 14), m.index));
    const hasUnit = Boolean(unit);
    const isGrouped = /[.,]\d{3}/.test(num);
    let score = 0;
    if (hasUnit) score += 3;
    if (isGrouped) score += 2;
    if (sign) score += 3;
    if (/(gd|ps|so tien|st|giao dich|thanh toan|tru|cong)[: ]*$/.test(before)) score += 4;
    if (/(sd|so du|du|bal|balance)[: ]*$/.test(before)) score -= 10; // số dư sau giao dịch → bỏ
    if (!hasUnit && !isGrouped && value < 1000) score -= 6; // số nhỏ trơn (ngày, giờ, số lượng)
    if (/^\d{6,}$/.test(num) && !hasUnit && !sign) score -= 3; // có thể là số tài khoản
    out.push({ value, index: m.index, length: full.length, sign: (sign as '+' | '-') || '', score });
  }
  return out;
}

const GENERIC_NAME_WORDS = new Set([
  'the', 'tk', 'tai', 'khoan', 'ngan', 'hang', 'vi', 'visa', 'master', 'card', 'credit', 'tien', 'mat', 'chinh', 'cua', 'toi',
]);

function nameKeywords(name: string): string[] {
  const n = norm(name);
  const words = n.split(' ').filter(w => w.length >= 2 && !GENERIC_NAME_WORDS.has(w));
  return Array.from(new Set([n, ...words]));
}

/** Tìm ví/thẻ được nhắc trong câu ("thẻ VIB", "momo", "tech", "TK 1903…"). */
export function detectPaymentSource(text: string, data: StorageData): string | undefined {
  const t = ' ' + norm(text) + ' ';
  const cardHint = /\b(the|quet|visa|master|tin dung|credit)\b/.test(t);
  let best: { id: string; score: number } | undefined;

  const consider = (id: string, name: string, isCard: boolean, extra: string[] = [], strong: string[] = []) => {
    const kws = [...nameKeywords(name), ...extra.map(norm)];
    let score = 0;
    const hit = (kw: string) =>
      new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(t);
    kws.forEach((kw, i) => {
      if (kw && hit(kw)) score = Math.max(score, i === 0 ? 5 : 2 + Math.min(2, kw.length / 4));
    });
    // Số tài khoản (đầy đủ hoặc 4 số cuối) là dấu hiệu chắc chắn nhất trong SMS ngân hàng
    strong.forEach(kw => {
      if (kw && hit(kw)) score = Math.max(score, 8);
    });
    if (score > 0 && isCard && cardHint) score += 2;
    if (score > 0 && !isCard && cardHint) score -= 1;
    if (score > 0 && (!best || score > best.score)) best = { id, score };
  };

  data.cards.forEach(c => consider(c.id, c.name, true, c.bank ? [c.bank] : []));
  data.accts.forEach(a => {
    const extra: string[] = [];
    const strong: string[] = [];
    if (a.bankName) extra.push(a.bankName);
    if (a.type === 'cash') extra.push('tien mat', 'cash');
    const digits = (a.accountNumber || '').replace(/\D/g, '');
    if (digits.length >= 4) strong.push(digits, digits.slice(-4));
    consider(a.id, a.name, false, extra, strong);
  });
  return best?.id;
}

function parseSmsDate(text: string): string | undefined {
  const m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (!m) return undefined;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const INCOME_HINT = /\b(nhan (tien|luong|thuong|chuyen khoan|ck|lai)|tien ve|luong|thuong|hoan tien|cashback|duoc cho|li xi|thu no|ban hang|tien vao)\b/;

/**
 * Bộ đọc nhanh chạy ngay trên máy (không cần mạng):
 * "Mua sữa chua cho con 85k thẻ VIB", "đổ xăng 70k vcb", hoặc dán SMS ngân hàng
 * "TK 1903xxx GD: -85,000VND 26/11/26 SD: 12,000,000VND ND: CK mua sua".
 */
export function parseQuickText(raw: string, data: StorageData): QuickParseResult {
  const text = raw.replace(/\s+/g, ' ').trim();
  const n = norm(text);
  const isBankSms = /\b(sd|so du|gd|ps|tk|tai khoan)\b[: ]/.test(n) && /(vnd|\d{1,3}[.,]\d{3}[.,]\d{3})/.test(n);

  const candidates = findAmountCandidates(text).sort((a, b) => b.score - a.score || b.value - a.value);
  const picked = candidates.find(c => c.score > -5);
  const amount = picked?.value || 0;

  // Nội dung giao dịch trong SMS (sau "ND:" / "Noi dung:")
  let noteSource = text;
  const ndMatch = text.match(/(?:\bND|N[ộo]i dung|ND GD|Description)\s*[:.]\s*(.+)$/i);
  if (isBankSms && ndMatch) noteSource = ndMatch[1];

  let type: TransactionType = 'out';
  if (picked?.sign === '+') type = 'in';
  else if (picked?.sign === '-') type = 'out';
  else if (INCOME_HINT.test(' ' + norm(noteSource) + ' ')) type = 'in';

  let catGuess = guessCategoryByText(noteSource);
  if (catGuess === 'khac') {
    const nn = ' ' + norm(noteSource) + ' ';
    const forKid = /\b(cho con|cho be|cua con|cua be)\b/.test(nn);
    if (/\b(sua chua|sua|banh|keo|an dam|vitamin)\b/.test(nn)) catGuess = forKid ? 'con_sua_bim' : 'an_uong';
    else if (forKid) catGuess = 'con_do_dung';
  }
  const incomeKeys = new Set(['luong', 'thuong', 'lai_tiet_kiem', 'loi_dau_tu', 'duoc_tang', 'thu_no', 'thu_phu', 'hoan_tien']);
  let cat = catGuess;
  if (type === 'in' && !incomeKeys.has(catGuess)) cat = 'thu_khac';
  if (type === 'out' && incomeKeys.has(catGuess)) type = 'in';

  const accountId = detectPaymentSource(text, data);

  // Ghi chú: bỏ cụm số tiền, cụm "thẻ/tk/qua <tên>", từ đệm
  let note = noteSource;
  if (picked && noteSource === text) {
    note = note.slice(0, picked.index) + ' ' + note.slice(picked.index + picked.length);
  }
  note = note
    .replace(/\b(bằng|bang|qua|từ|tu|trả bằng|tra bang)?\s*(thẻ|the|tk|tài khoản|tai khoan|ví|vi)\s+[\p{L}\d]+(\s+(max|visa|platinum|plus|stk))?/giu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .trim();
  if (accountId && !(isBankSms && ndMatch)) {
    const card = data.cards.find(c => c.id === accountId);
    const acct = data.accts.find(a => a.id === accountId);
    const drop = new Set<string>(['the', 'tk', 'vi', 'qua', 'bang', 'visa', 'cua']);
    norm(`${card?.name || ''} ${card?.bank || ''} ${acct?.name || ''} ${acct?.bankName || ''}`)
      .split(' ')
      .filter(Boolean)
      .forEach(w => drop.add(w));
    if (acct?.type === 'cash') ['tien', 'mat'].forEach(w => drop.add(w));
    const words = note.split(' ');
    // Chỉ cắt các từ chỉ nguồn tiền ở cuối câu ("... 45k momo", "... thẻ VIB Max")
    while (words.length > 1 && drop.has(norm(words[words.length - 1]))) words.pop();
    note = words.join(' ').trim();
  }
  if (note) note = note.charAt(0).toUpperCase() + note.slice(1);

  return {
    amount,
    type,
    cat,
    accountId,
    note: note.slice(0, 200),
    date: isBankSms ? parseSmsDate(text) : undefined,
    isBankSms,
  };
}
