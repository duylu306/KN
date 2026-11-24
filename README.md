

## Các phân hệ trong bản PoC Demo

1. **Sàn Thời Trang Tuần Hoàn (`#market`)**: Kho sản phẩm Nhóm A (Secondhand kiểm định 3-Không) & Nhóm B (Upcycled Độc bản 1-of-1) kèm **Hộ chiếu Sản phẩm Số (Digital Product Passport)**, thông số Studio Box và nhãn phụ pháp lý IP.
2. **AI Phối Đồ & Chống Định Kiến (`#ai-stylist`)**: Hệ thống gợi ý phối đồ cá nhân hóa kết hợp **Body Shape** + **Style Spectrum** (chống định kiến thuật toán AI Bias) cùng **Virtual Try-On Silhouette Preview**.
3. **Cổng Đăng Bán & Ký Gửi (`#sell`)**: Đánh giá tiêu chuẩn **"3 Không"** tự động phân luồng Nhóm A / Nhóm B / Nhóm C, ước tính thanh toán **Mua đứt (MoMo/ZaloPay)** và **Ký gửi 60 ngày**, theo dõi trạng thái xử lý tại trạm KTX ĐHQG-HCM.
4. **Trạm Xử Lý 5 Phân Khu & Tác Động (`#ecosystem`)**: Sơ đồ mặt bằng **One-Way Flow 100m²** tại Làng Đại học và công cụ tính toán CO₂, nước ngọt & chi phí tiết kiệm.
5. **Mô Hình Kinh Doanh & Tài Chính (`#pitch`)**: Bộ mô phỏng điểm hòa vốn (`8.200 users`), biểu đồ doanh thu vs chi phí, lộ trình 3 giai đoạn, biểu đồ Gantt 6 tháng và đội ngũ sáng lập.

## Triển khai trên GitHub Pages (`github.io`)

Website hoàn toàn là ứng dụng tĩnh (HTML5 + CSS3 + ES Modules thuần), không cần bước build Node.js:
- Push toàn bộ thư mục này lên repository GitHub (nhánh `main`, thư mục gốc `/`).
- Vào **Settings → Pages → Build and deployment → Source: Deploy from a branch (`main` / `/ (root)`)**.
