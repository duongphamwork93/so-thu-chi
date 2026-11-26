export interface CategoryInfo {
  key: string;
  name: string;
  shortName: string;
  color: string;
  group: 'need' | 'want' | 'save' | 'income';
  section: string;
  isKid?: boolean;
  iconName: string;
}

export const EXPENSE_CATEGORIES: CategoryInfo[] = [
  // 1. Ăn uống
  { key: 'an_uong', name: 'Ăn uống', shortName: 'Ăn uống', color: '#EA580C', group: 'need', section: 'Ăn uống', iconName: 'Utensils' },
  { key: 'an_sang', name: 'Ăn sáng', shortName: 'Ăn sáng', color: '#F97316', group: 'need', section: 'Ăn uống', iconName: 'Utensils' },
  { key: 'an_trua', name: 'Ăn trưa', shortName: 'Ăn trưa', color: '#FB923C', group: 'need', section: 'Ăn uống', iconName: 'Utensils' },
  { key: 'an_toi', name: 'Ăn tối', shortName: 'Ăn tối', color: '#C2410C', group: 'need', section: 'Ăn uống', iconName: 'Pizza' },
  { key: 'an_tiem', name: 'Ăn tiệm', shortName: 'Ăn tiệm', color: '#E11D48', group: 'want', section: 'Ăn uống', iconName: 'Pizza' },
  { key: 'cafe', name: 'Cafe, trà sữa', shortName: 'Cafe', color: '#854D0E', group: 'want', section: 'Ăn uống', iconName: 'Coffee' },
  { key: 'cho_sieu_thi', name: 'Đi chợ / Siêu thị', shortName: 'Đi chợ/ST', color: '#D97706', group: 'need', section: 'Ăn uống', iconName: 'ShoppingCart' },

  // 2. Con cái
  { key: 'con_sua_bim', name: 'Sữa, bỉm, đồ ăn bé', shortName: 'Sữa, bỉm', color: '#EC4899', group: 'need', section: 'Con cái', isKid: true, iconName: 'Baby' },
  { key: 'giao_duc', name: 'Học phí', shortName: 'Học phí', color: '#16A34A', group: 'need', section: 'Con cái', isKid: true, iconName: 'GraduationCap' },
  { key: 'con_sach_vo', name: 'Sách vở', shortName: 'Sách vở', color: '#0D9488', group: 'need', section: 'Con cái', isKid: true, iconName: 'BookOpen' },
  { key: 'con_do_dung', name: 'Đồ chơi, đồ dùng bé', shortName: 'Đồ chơi', color: '#F59E0B', group: 'want', section: 'Con cái', isKid: true, iconName: 'ToyBrick' },
  { key: 'con_y_te', name: 'Khám bệnh, tiêm chủng', shortName: 'Y tế bé', color: '#0891B2', group: 'need', section: 'Con cái', isKid: true, iconName: 'Stethoscope' },
  { key: 'con_tieu_vat', name: 'Tiền tiêu vặt', shortName: 'Tiêu vặt', color: '#10B981', group: 'want', section: 'Con cái', isKid: true, iconName: 'Coins' },

  // 3. Đi lại
  { key: 'di_lai', name: 'Taxi / Thuê xe / Đi lại', shortName: 'Taxi/Đi lại', color: '#2563EB', group: 'need', section: 'Đi lại', iconName: 'Car' },
  { key: 'xang_xe', name: 'Xăng xe', shortName: 'Xăng xe', color: '#DC2626', group: 'need', section: 'Đi lại', iconName: 'Fuel' },
  { key: 'gui_xe', name: 'Gửi xe', shortName: 'Gửi xe', color: '#0284C7', group: 'need', section: 'Đi lại', iconName: 'ParkingCircle' },
  { key: 'rua_xe', name: 'Rửa xe', shortName: 'Rửa xe', color: '#06B6D4', group: 'want', section: 'Đi lại', iconName: 'Droplets' },
  { key: 'sua_xe', name: 'Sửa chữa, bảo dưỡng xe', shortName: 'Sửa xe', color: '#475569', group: 'need', section: 'Đi lại', iconName: 'Wrench' },
  { key: 'bao_hiem_xe', name: 'Bảo hiểm xe', shortName: 'BH xe', color: '#16A34A', group: 'need', section: 'Đi lại', iconName: 'Shield' },

  // 4. Dịch vụ sinh hoạt
  { key: 'dien', name: 'Điện', shortName: 'Điện', color: '#EAB308', group: 'need', section: 'Dịch vụ sinh hoạt', iconName: 'Zap' },
  { key: 'nuoc', name: 'Nước', shortName: 'Nước', color: '#0EA5E9', group: 'need', section: 'Dịch vụ sinh hoạt', iconName: 'Droplets' },
  { key: 'internet', name: 'Internet', shortName: 'Internet', color: '#4F46E5', group: 'need', section: 'Dịch vụ sinh hoạt', iconName: 'Wifi' },
  { key: 'gas', name: 'Gas', shortName: 'Gas', color: '#EF4444', group: 'need', section: 'Dịch vụ sinh hoạt', iconName: 'Flame' },
  { key: 'dien_thoai_dd', name: 'Điện thoại di động', shortName: 'Di động', color: '#3B82F6', group: 'need', section: 'Dịch vụ sinh hoạt', iconName: 'Smartphone' },
  { key: 'dien_thoai_cd', name: 'Điện thoại cố định', shortName: 'ĐT cố định', color: '#16A34A', group: 'need', section: 'Dịch vụ sinh hoạt', iconName: 'Phone' },
  { key: 'truyen_hinh', name: 'Truyền hình', shortName: 'Truyền hình', color: '#F59E0B', group: 'want', section: 'Dịch vụ sinh hoạt', iconName: 'Tv' },
  { key: 'thue_giup_viec', name: 'Thuê người giúp việc', shortName: 'Giúp việc', color: '#EA580C', group: 'need', section: 'Dịch vụ sinh hoạt', iconName: 'Home' },

  // 5. Nhà cửa
  { key: 'nha_o', name: 'Thuê nhà / Nhà ở', shortName: 'Thuê nhà', color: '#4F46E5', group: 'need', section: 'Nhà cửa', iconName: 'Home' },
  { key: 'mua_sam_do_dac', name: 'Mua sắm đồ đạc', shortName: 'Đồ đạc', color: '#B45309', group: 'want', section: 'Nhà cửa', iconName: 'Sofa' },
  { key: 'sua_chua_nha', name: 'Sửa chữa nhà cửa', shortName: 'Sửa nhà', color: '#DC2626', group: 'need', section: 'Nhà cửa', iconName: 'Hammer' },

  // 6. Sức khỏe
  { key: 'suc_khoe', name: 'Sức khỏe, bảo hiểm', shortName: 'Sức khỏe', color: '#0D9488', group: 'need', section: 'Sức khỏe', iconName: 'HeartPulse' },
  { key: 'kham_chua_benh', name: 'Khám chữa bệnh', shortName: 'Khám bệnh', color: '#0284C7', group: 'need', section: 'Sức khỏe', iconName: 'Stethoscope' },
  { key: 'thuoc_men', name: 'Thuốc men', shortName: 'Thuốc men', color: '#16A34A', group: 'need', section: 'Sức khỏe', iconName: 'Pill' },
  { key: 'the_thao', name: 'Thể thao', shortName: 'Thể thao', color: '#EA580C', group: 'want', section: 'Sức khỏe', iconName: 'Dumbbell' },

  // 7. Trang phục & Làm đẹp
  { key: 'mua_sam', name: 'Mua sắm cá nhân', shortName: 'Mua sắm', color: '#DB2777', group: 'want', section: 'Trang phục', iconName: 'ShoppingBag' },
  { key: 'quan_ao', name: 'Quần áo', shortName: 'Quần áo', color: '#EC4899', group: 'want', section: 'Trang phục', iconName: 'Shirt' },
  { key: 'giay_dep', name: 'Giầy dép', shortName: 'Giầy dép', color: '#F59E0B', group: 'want', section: 'Trang phục', iconName: 'Footprints' },
  { key: 'phu_kien', name: 'Phụ kiện khác', shortName: 'Phụ kiện', color: '#E11D48', group: 'want', section: 'Trang phục', iconName: 'Glasses' },
  { key: 'lam_dep', name: 'Làm đẹp', shortName: 'Làm đẹp', color: '#9333EA', group: 'want', section: 'Trang phục', iconName: 'Scissors' },
  { key: 'my_pham', name: 'Mỹ phẩm', shortName: 'Mỹ phẩm', color: '#DB2777', group: 'want', section: 'Trang phục', iconName: 'Sparkles' },

  // 8. Hưởng thụ & Phát triển bản thân
  { key: 'du_lich', name: 'Du lịch', shortName: 'Du lịch', color: '#059669', group: 'want', section: 'Hưởng thụ', iconName: 'Plane' },
  { key: 'giai_tri', name: 'Vui chơi giải trí', shortName: 'Giải trí', color: '#9333EA', group: 'want', section: 'Hưởng thụ', iconName: 'Gamepad2' },
  { key: 'phim_nhac', name: 'Phim ảnh, ca nhạc', shortName: 'Phim nhạc', color: '#7C3AED', group: 'want', section: 'Hưởng thụ', iconName: 'Film' },
  { key: 'hoc_hanh', name: 'Học hành, phát triển', shortName: 'Học hành', color: '#16A34A', group: 'need', section: 'Phát triển', iconName: 'BookOpen' },
  { key: 'giao_luu', name: 'Giao lưu, quan hệ', shortName: 'Giao lưu', color: '#EA580C', group: 'want', section: 'Phát triển', iconName: 'Handshake' },

  // 9. Hiếu hỉ
  { key: 'hieu_hi', name: 'Biếu tặng, hiếu hỉ', shortName: 'Biếu tặng', color: '#E11D48', group: 'want', section: 'Hiếu hỉ', iconName: 'Gift' },
  { key: 'cuoi_xin', name: 'Cưới xin', shortName: 'Cưới xin', color: '#F59E0B', group: 'want', section: 'Hiếu hỉ', iconName: 'Sparkles' },
  { key: 'tham_hoi', name: 'Thăm hỏi', shortName: 'Thăm hỏi', color: '#EC4899', group: 'want', section: 'Hiếu hỉ', iconName: 'HeartHandshake' },
  { key: 'ma_chay', name: 'Ma chay', shortName: 'Ma chay', color: '#64748B', group: 'want', section: 'Hiếu hỉ', iconName: 'HeartHandshake' },

  // 10. Ngân hàng & Tài chính khác
  { key: 'tra_no', name: 'Trả nợ, trả góp', shortName: 'Trả góp/Nợ', color: '#DC2626', group: 'need', section: 'Ngân hàng & Khác', iconName: 'CreditCard' },
  { key: 'phi_chuyen_khoan', name: 'Phí chuyển khoản', shortName: 'Phí CK', color: '#D97706', group: 'need', section: 'Ngân hàng & Khác', iconName: 'ArrowLeftRight' },
  { key: 'cho_vay', name: 'Cho vay', shortName: 'Cho vay', color: '#059669', group: 'save', section: 'Ngân hàng & Khác', iconName: 'HandCoins' },
  { key: 'tiet_kiem', name: 'Tiết kiệm, mua tài sản', shortName: 'Mua TS/TK', color: '#059669', group: 'save', section: 'Ngân hàng & Khác', iconName: 'PiggyBank' },
  { key: 'khac', name: 'Tiền ra / Chi khác', shortName: 'Chi khác', color: '#64748B', group: 'want', section: 'Ngân hàng & Khác', iconName: 'CircleEllipsis' },
];

export const INCOME_CATEGORIES: CategoryInfo[] = [
  { key: 'luong', name: 'Lương', shortName: 'Lương', color: '#16A34A', group: 'income', section: 'Thu nhập', iconName: 'Briefcase' },
  { key: 'thuong', name: 'Thưởng', shortName: 'Thưởng', color: '#D97706', group: 'income', section: 'Thu nhập', iconName: 'Award' },
  { key: 'lai_tiet_kiem', name: 'Lãi tiết kiệm', shortName: 'Lãi TK', color: '#EC4899', group: 'income', section: 'Thu nhập', iconName: 'PiggyBank' },
  { key: 'loi_dau_tu', name: 'Tiền lãi, cổ tức', shortName: 'Tiền lãi', color: '#059669', group: 'income', section: 'Thu nhập', iconName: 'TrendingUp' },
  { key: 'thu_phu', name: 'Làm thêm, bán hàng', shortName: 'Làm thêm', color: '#2563EB', group: 'income', section: 'Thu nhập', iconName: 'Laptop' },
  { key: 'duoc_tang', name: 'Được cho / tặng, lì xì', shortName: 'Được tặng', color: '#E11D48', group: 'income', section: 'Thu nhập', iconName: 'Gift' },
  { key: 'di_vay', name: 'Đi vay', shortName: 'Đi vay', color: '#F59E0B', group: 'income', section: 'Thu nhập', iconName: 'Wallet' },
  { key: 'thu_no', name: 'Thu nợ', shortName: 'Thu nợ', color: '#0D9488', group: 'income', section: 'Thu nhập', iconName: 'HandCoins' },
  { key: 'quy_nhom', name: 'Quỹ nhóm', shortName: 'Quỹ nhóm', color: '#3B82F6', group: 'income', section: 'Thu nhập', iconName: 'Users' },
  { key: 'bhxh', name: 'Trợ cấp BHXH, thai sản', shortName: 'BHXH', color: '#0891B2', group: 'income', section: 'Thu nhập', iconName: 'ShieldCheck' },
  { key: 'hoan_thue', name: 'Hoàn thuế TNCN', shortName: 'Hoàn thuế', color: '#4F46E5', group: 'income', section: 'Thu nhập', iconName: 'Receipt' },
  { key: 'thu_khac', name: 'Tiền vào / Thu khác', shortName: 'Tiền vào', color: '#64748B', group: 'income', section: 'Thu nhập', iconName: 'Coins' },
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
export const CATEGORY_MAP = Object.fromEntries(ALL_CATEGORIES.map(c => [c.key, c]));

// Vietnamese keyword rules for matching
export const KEYWORD_RULES: [string, string[]][] = [
  ['con_sua_bim', ['con cung', 'kids plaza', 'kidsplaza', 'bibo mart', 'bibomart', 'sua bot', 'sua tuoi', 'ta dan', 'ta quan', 'bim ', 'friso', 'similac', 'enfa', 'aptamil', 'meiji', 'nan optipro', 'an dam']],
  ['con_y_te', ['vnvc', 'tiem chung', 'vac xin', 'vaccine', 'nhi dong', 'benh vien nhi', 'phong kham nhi', 'kham nhi']],
  ['con_sach_vo', ['sach vo', 'dung cu hoc tap', 'nha sach', 'fahasa']],
  ['giao_duc', ['hoc phi', 'mam non', 'tieu hoc', 'truong mam', 'anh ngu', 'hoc them', 'nang khieu']],
  ['cafe', ['highlands', 'phuc long', 'starbucks', 'the coffee house', 'coffee house', 'katinat', 'trung nguyen', 'cong caphe', 'cafe', 'ca phe', 'coffee', 'tra sua', 'gong cha', 'tocotoco', 'koi the', 'phe la', 'milk tea', 'tra dao']],
  ['an_sang', ['an sang', 'banh mi', 'xoi ', 'chao long', 'pho sang']],
  ['an_trua', ['an trua', 'com trua', 'bun cha trua']],
  ['an_toi', ['an toi', 'com toi']],
  ['an_tiem', ['an tiem', 'an ngoai', 'nha hang', 'buffet', 'haidilao', 'gogi', 'manwah', 'lau ']],
  ['an_uong', ['grabfood', 'grab food', 'shopeefood', 'shopee food', 'baemin', 'befood', 'kfc', 'lotteria', 'jollibee', 'mcdonald', 'pizza', 'quan an', 'com tam', 'com ga', 'pho ', 'bun ']],
  ['xang_xe', ['petrolimex', 'xang dau', 'do xang', 'xang ', 'pvoil']],
  ['gui_xe', ['gui xe', 'bai xe', 'vetc', 'epass', 'cau duong']],
  ['sua_xe', ['sua xe', 'bao duong xe', 'thay nhot']],
  ['rua_xe', ['rua xe']],
  ['di_lai', ['grabbike', 'grabcar', 'grab bike', 'grab car', 'xanh sm', 'vietjet', 'vietnam airlines', 'bamboo airways', 'grab', 'be ', 'taxi', 'thue xe']],
  ['cho_sieu_thi', ['co.opmart', 'coopmart', 'co.op', 'winmart', 'vinmart', 'bach hoa xanh', 'lotte mart', 'aeon', 'big c', 'go! ', 'emart', 'mm mega', 'circle k', 'familymart', '7-eleven', 'ministop', 'gs25', 'sieu thi', 'cho dau moi', 'di cho', 'rau cu', 'thit ca']],
  ['thuoc_men', ['long chau', 'pharmacity', 'an khang', 'nha thuoc', 'thuoc men', 'mua thuoc']],
  ['kham_chua_benh', ['benh vien', 'phong kham', 'medlatec', 'hoan my', 'vinmec', 'nha khoa', 'kham rang', 'kham benh']],
  ['suc_khoe', ['bao hiem y te', 'bao hiem nhan tho', 'suc khoe']],
  ['dien', ['evn', 'dien luc', 'tien dien']],
  ['nuoc', ['cap nuoc', 'tien nuoc']],
  ['internet', ['fpt telecom', 'vnpt', 'internet', 'wifi']],
  ['gas', ['tien gas', 'binh gas', 'doi gas']],
  ['dien_thoai_dd', ['nap the', 'cuoc di dong', '4g', '5g', 'viettel', 'mobifone', 'vinaphone']],
  ['nha_o', ['tien nha', 'phi quan ly', 'thue nha']],
  ['quan_ao', ['quan ao', 'uniqlo', 'zara', 'vay dam']],
  ['giay_dep', ['giay dep', 'bitis', 'nike', 'adidas']],
  ['my_pham', ['my pham', 'guardian', 'watsons', 'son ', 'kem chong nang']],
  ['lam_dep', ['lam dep', 'cat toc', 'spa', 'lam nail', 'goi dau']],
  ['mua_sam', ['shopee', 'lazada', 'tiki', 'tiktok shop', 'the gioi di dong', 'dien may xanh', 'fpt shop', 'cellphones']],
  ['du_lich', ['du lich', 'khach san', 'agoda', 'booking.com', 'traveloka', 'homestay']],
  ['phim_nhac', ['cgv', 'lotte cinema', 'galaxy', 'bhd', 've xem phim', 'ca nhac']],
  ['giai_tri', ['netflix', 'spotify', 'youtube', 'vinwonders', 'vui choi']],
  ['cuoi_xin', ['dam cuoi', 'mung cuoi']],
  ['hieu_hi', ['phung vieng', 'qua tang', 'sinh nhat', 'mung tho', 'phong bi', 'bieu tang']],
  ['phi_chuyen_khoan', ['phi chuyen khoan', 'phi ngan hang', 'phi duy tri']],
  ['tra_no', ['tra no', 'tra gop', 'fe credit', 'home credit', 'tra the', 'du no']],
  ['tiet_kiem', ['gui tiet kiem', 'mua vang', 'tich luy', 'gui ngan hang']],
  ['luong', ['luong', 'salary', 'nhan luong', 'cong ty chuyen khoan']],
  ['thuong', ['thuong', 'bonus', 'kpi', 'thuong tet', 'thuong le']],
  ['lai_tiet_kiem', ['lai tiet kiem']],
  ['loi_dau_tu', ['co tuc', 'tien lai', 'chot loi']],
  ['duoc_tang', ['li xi', 'lì xì', 'bieu tang', 'tang tien', 'mung tuoi']],
];

export function removeVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function guessCategoryByText(text: string): string {
  const normalized = ' ' + removeVietnameseAccents(text).replace(/\s+/g, ' ') + ' ';
  for (const [catKey, keywords] of KEYWORD_RULES) {
    if (keywords.some(kw => normalized.includes(kw))) {
      return catKey;
    }
  }
  return 'khac';
}
