import { guessCategoryByText, removeVietnameseAccents } from '../constants/categories';

/**
 * ENGINE PHÂN LOẠI TỰ ĐỘNG DÙNG CHUNG
 * Dùng cho: Quét hoá đơn (AI), Nhập nhanh bằng chữ, Giọng nói.
 *
 * Quy tắc theo NGỮ CẢNH SẢN PHẨM, ưu tiên cụm từ cụ thể trước từ chung chung.
 * Không bắt từ đơn dễ nhầm (VD: "vàng" trong "Khăn giấy Bông Sen Vàng").
 */

export interface ClassifyResult {
  cat: string;
  /** strong = khớp quy tắc ngữ cảnh chắc chắn; weak = khớp từ khoá chung; none = không khớp */
  confidence: 'strong' | 'weak' | 'none';
  matched?: string;
}

interface Rule {
  cat: string;
  /** Cụm từ đã bỏ dấu, viết thường. Khớp theo ranh giới từ. */
  any: string[];
  /** Tất cả các nhóm phải có ít nhất 1 cụm khớp (ngữ cảnh bắt buộc) */
  requireAll?: string[][];
}

// Thứ tự = độ ưu tiên khi số lần khớp bằng nhau
const RULES: Rule[] = [
  // Trung tính: mua hộ / cho vay / tạm ứng
  { cat: 'cho_vay', any: ['mua ho', 'mua giup', 'tra ho', 'cho vay', 'cho muon', 'tam ung', 'ung truoc', 'ung tien'] },

  // Thuê bao / phần mềm
  {
    cat: 'thue_bao',
    any: [
      'claude', 'anthropic', 'youtube premium', 'youtube', 'netflix', 'spotify', 'icloud', 'google one', 'chatgpt',
      'openai', 'apple music', 'app store', 'google play', 'canva', 'subscription', 'gia han phan mem', 'gia han goi',
      'gia han app', 'gia han tai khoan', 'thue bao', 'microsoft 365', 'office 365',
    ],
  },

  // Con cái
  { cat: 'con_hoc_can_thiep', any: ['hoc can thiep', 'can thiep', 'tri lieu', 'ngon ngu tri lieu', 'hoat dong tri lieu', 'ot tri lieu'] },
  {
    cat: 'con_sua_bim',
    any: [
      'sua cong thuc', 'sua bot', 'sua cho be', 'sua tre em', 'ta dan', 'ta quan', 'bim', 'yen sao', 'nuoc yen', 'to yen',
      'vang sua', 'an dam', 'chao an dam', 'banh an dam', 'vitamin cho be', 'vitamin tre em', 'dha', 'siro cho be',
      'friso', 'similac', 'enfa', 'enfamil', 'aptamil', 'meiji', 'nan optipro', 'glico', 'morinaga', 'moony', 'merries',
      'huggies', 'bobby', 'pampers', 'goon', 'con cung', 'kids plaza', 'kidsplaza', 'bibo mart', 'bibomart',
    ],
  },
  {
    cat: 'con_quan_ao',
    any: [
      'quan ao tre em', 'quan ao be', 'quan ao cho be', 'quan ao cho con', 'quan ao con', 'ao be', 'vay be', 'tat be',
      'vo be', 'tat cho be', 'giay be', 'dep be', 'giay tre em', 'dep tre em', 'body be', 'bo do be',
    ],
  },
  { cat: 'con_y_te', any: ['tiem chung', 'vac xin', 'vaccine', 'vnvc', 'kham nhi', 'benh vien nhi', 'phong kham nhi'] },

  // Đồ dùng sinh hoạt tiêu hao
  {
    cat: 'do_sinh_hoat',
    any: [
      'khan giay', 'giay an', 'giay ve sinh', 'giay rut', 'tui rac', 'tui dung rac', 'nuoc giat', 'bot giat', 'vien giat',
      'nuoc xa', 'nuoc rua chen', 'nuoc rua bat', 'nuoc lau san', 'nuoc lau kinh', 'dao cao', 'ban chai', 'kem danh rang',
      'xa phong', 'sua tam', 'dau goi', 'dau xa', 'bong tay trang', 'mang boc thuc pham', 'giay bac', 'do dung sinh hoat',
      'do sinh hoat', 'tay bon cau', 'nuoc tay',
    ],
  },

  // Sức khoẻ
  {
    cat: 'thuoc_men',
    any: [
      'thuoc', 'muoi rua mui', 'nuoc muoi sinh ly', 'nuoc suc mieng', 'xit mui', 'nha thuoc', 'long chau', 'pharmacity',
      'an khang', 'khau trang y te', 'bang gac', 'thuc pham chuc nang',
    ],
  },
  { cat: 'kham_chua_benh', any: ['kham benh', 'kham chua benh', 'benh vien', 'phong kham', 'nha khoa', 'xet nghiem', 'sieu am'] },

  // Ăn uống (đặt trước Đi lại để GrabFood/ShopeeFood không bị nhận là taxi)
  { cat: 'an_uong', any: ['grabfood', 'grab food', 'shopeefood', 'shopee food', 'baemin', 'befood', 'be food', 'xanh sm food'] },

  // Đi lại
  { cat: 'xang_xe', any: ['xang', 'do xang', 'petrolimex', 'pvoil', 'tram xang', 'cay xang', 'sac xe dien', 'sac vinfast'] },
  { cat: 'gui_xe', any: ['gui xe', 've xe thang', 'bai xe', 'vetc', 'epass', 'phi cau duong', 'phi duong bo'] },
  {
    cat: 'di_lai',
    any: ['grab', 'grabbike', 'grabcar', 'green sm', 'xanh sm', 'gsm', 'be car', 'be bike', 'taxi', 'mai linh', 'thue xe', 've may bay', 've tau'],
  },

  // Đi chợ / siêu thị
  {
    cat: 'cho_sieu_thi',
    any: [
      'winmart', 'wincommerce', 'fujimart', 'fuji mart', 'co.opmart', 'coopmart', 'co op', 'bach hoa xanh', 'aeon', 'lotte mart',
      'big c', 'go!', 'emart', 'mm mega', 'kingfoodmart', 'di cho', 'thit', 'ca hoi', 'hai san', 'rau cu', 'rau', 'cu qua',
      'trai cay', 'hoa qua', 'trung ga', 'gao',
    ],
  },

  // Mua vàng: chỉ khi có ngữ cảnh mua vàng tích sản / tiệm vàng
  {
    cat: 'mua_vang',
    any: ['mua vang', 'vang nhan', 'vang mieng', 'nhan tron', 'vang sjc', 'tiem vang', 'tich tru vang', 'chi vang', 'cay vang'],
  },
  { cat: 'mua_vang', any: ['sjc', 'pnj', 'doji', 'bao tin minh chau', 'phu quy'], requireAll: [['vang', 'nhan', 'mieng', 'chi', 'cay']] },
  { cat: 'dau_tu', any: ['chung chi quy', 'ccq', 'dau tu', 'chung khoan', 'co phieu', 'mua quy', 'etf', 'dcds', 'vesaf', 'fmarket'] },
];

const normalize = (s: string) =>
  ' ' +
  removeVietnameseAccents(s || '')
    .replace(/[^a-z0-9!.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() +
  ' ';

const hasPhrase = (text: string, phrase: string) => {
  const p = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).test(text);
};

/**
 * Phân loại một giao dịch theo nội dung.
 * @param rawText câu nhập / ghi chú / tên sản phẩm chính
 * @param items danh sách tên sản phẩm (nếu có, VD từ hoá đơn)
 * @param merchant tên cửa hàng / người nhận
 */
export function autoClassifyTransaction(rawText: string, items: string[] = [], merchant = ''): ClassifyResult {
  const sources = [rawText, merchant, ...items].filter(Boolean).map(normalize);
  if (sources.length === 0) return { cat: 'khac', confidence: 'none' };

  // Đếm số nguồn (dòng sản phẩm/ghi chú/cửa hàng) khớp từng quy tắc
  let best: { cat: string; score: number; order: number; matched: string } | null = null;
  RULES.forEach((rule, order) => {
    let score = 0;
    let matched = '';
    for (const src of sources) {
      const hit = rule.any.find(p => hasPhrase(src, p));
      if (!hit) continue;
      if (rule.requireAll && !rule.requireAll.every(group => group.some(g => hasPhrase(src, g)))) continue;
      score += 1;
      matched = matched || hit;
    }
    if (score > 0 && (!best || score > best.score)) best = { cat: rule.cat, score, order, matched };
  });
  if (best) {
    const b = best as { cat: string; matched: string };
    return { cat: b.cat, confidence: 'strong', matched: b.matched };
  }

  // Dự phòng: bộ từ khoá chung sẵn có
  const fallback = guessCategoryByText(sources.join(' '));
  return fallback && fallback !== 'khac' ? { cat: fallback, confidence: 'weak' } : { cat: 'khac', confidence: 'none' };
}
