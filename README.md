# Sổ Thu Chi (Personal & Family Finance Tracker)

Ứng dụng quản lý thu chi cá nhân và gia đình, theo dõi tài sản ròng (Net Worth), sổ tiết kiệm, danh mục đầu tư, thẻ tín dụng, khoản nợ và tích hợp trợ lý AI thông minh (Google Gemini 3.8 Flash).

Dữ liệu lưu trữ an toàn 100% trong `localStorage` trên trình duyệt thiết bị của bạn với khóa `sothuchi.v1`.

---

## 🌟 Tính Năng Nổi Bật

### 1. Tổng Quan Tài Chính & Quy Tắc 50/30/20
- **Hero Card trực quan**: Tổng Thu, Tổng Chi, Thặng Dư tích luỹ và Tỉ lệ % tiết kiệm trong tháng.
- **Phân bổ 50/30/20**: Tự động phân loại chi tiêu theo **Thiết yếu (50%)**, **Sở thích (30%)** và **Tích luỹ (20%)**.
- **Ngân sách tháng**: Thiết lập hạn mức chi tiêu với thanh đo tiến độ và cảnh báo khi sắp chạm hoặc vượt mức.
- **Việc cần lưu ý**: Tự động nhắc nhở ngày đến hạn thanh toán thẻ tín dụng, sổ tiết kiệm sắp đáo hạn, khoản nợ cần thu hồi/trả và các khoản định kỳ đến kỳ thanh toán.

### 2. Sổ Giao Dịch & Nhập Liệu Siêu Tốc
- **Nhập tự nhiên (Natural Language)**: Gõ tự do bằng tiếng Việt (*"cơm trưa 45k momo"*, *"đổ xăng 70k vcb"*, *"nhận lương 28tr"*) — hệ thống tự động bóc tách số tiền, danh mục, tài khoản và ghi chú.
- **Phím số nhanh**: Các phím tắt `+10k`, `+20k`, `+50k`, `+100k`, `+200k`, `+500k`, `+1tr`, `+000`.
- **Bộ lọc & Nhóm theo ngày**: Lọc theo Chi / Thu, danh mục, ví thanh toán; nhóm theo từng ngày kèm tổng tiền từng ngày.

### 3. Quản Lý Toàn Bộ Tài Sản Ròng (Net Worth)
- **Tài khoản & Ví**: Ngân hàng (VCB, MB, Techcombank...), ví MoMo, ZaloPay, Tiền mặt kèm tính năng **Chuyển tiền nội bộ**.
- **Sổ tiết kiệm**: Tự động tính lãi suất thực tế tích lũy theo ngày, đếm ngược ngày đáo hạn và nút tất toán về ví.
- **Đầu tư & Vàng**: Cổ phiếu, Quỹ mở/ETF, Vàng nhẫn 9999/SJC, Bất động sản kèm tính toán **Lãi/Lỗ (+/- %)**.
- **Thẻ tín dụng**: Theo dõi hạn mức, tỷ lệ sử dụng, ngày sao kê, hạn trả nợ và nút thanh toán thẻ.
- **Sổ Vay & Nợ**: Quản lý ai nợ mình / mình nợ ai, tiến độ trả nợ từng phần.
- **Mục tiêu tiết kiệm**: Đặt mục tiêu mua sắm/quỹ dự phòng kèm thanh tiến độ và hiệu ứng ăn mừng khi đạt 100%.

### 4. Trợ Lý AI Thông Minh (Gemini 3.8 Flash)
- **Quét Hóa Đơn & Sao Kê**: Chụp ảnh hoặc tải lên bill siêu thị (Co.opmart, WinMart), nhà hàng, cây xăng hoặc biên lai chuyển khoản ngân hàng — AI tự động nhận diện tên nơi bán, ngày, tổng tiền, danh sách món hàng và tự động gán danh mục chuẩn xác.
- **Chẩn đoán sức khỏe tài chính**: Đánh giá thói quen chi tiêu, chấm điểm từ 1-100 và đưa ra 3 lời khuyên tài chính cụ thể, dễ hành động cho gia đình Việt Nam.

### 5. Bảo Mật & Quyền Riêng Tư
- **Chế độ ẩn số tiền (Privacy Mask)**: Làm mờ toàn bộ số tiền trên màn hình khi mở ở nơi công cộng hoặc công sở.
- **Sao lưu & Khôi phục**: Xuất và nhập file JSON dễ dàng (tương thích 100% với khóa `sothuchi.v1`).

---

## 🚀 Cài Đặt & Chạy Cục Bộ (Local)

Yêu cầu: **Node.js 18+**

```bash
# Cài đặt thư viện
npm install

# Chạy môi trường phát triển (Full-stack Express + Vite)
npm run dev

# Mở trình duyệt tại http://localhost:3000
```

### Đóng gói sản phẩm (Build):

```bash
npm run build
```

Kết quả build nằm trong thư mục `dist/` và `app/`, sẵn sàng triển khai trên GitHub Pages, Vercel, Netlify hoặc bất kỳ static web server nào.

---

## 📄 Giấy Phép

Mã nguồn mở theo giấy phép MIT. Toàn bộ dữ liệu nằm 100% trên thiết bị của người dùng.
