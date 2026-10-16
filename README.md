# Website Nội Thất MOHO (Full-stack Backend & Frontend với Dark Mode)

Dự án website thương mại điện tử nội thất cao cấp phong cách **MOHO**, được xây dựng dựa trên hình ảnh thực tế với đầy đủ **Backend API (Flask & SQLite)**, giao diện **Frontend hiện đại**, hỗ trợ chuyển đổi linh hoạt **Dark Mode / Light Mode**, giỏ hàng trực tiếp, đặt hàng thanh toán và trang quản trị **Admin Dashboard**.

---

## 🌟 Tính Năng Nổi Bật

### 1. Giao diện chuẩn xác theo thiết kế ảnh mẫu (MOHO Storefront)
- **Header chuẩn hóa**: Logo `moho.`, thanh tìm kiếm thông minh có gợi ý tự động (live search), khu vực tài khoản khách hàng, giỏ hàng với badge đếm số lượng.
- **Thanh Menu điều hướng**: Menu đa tầng gồm *Sản phẩm (Dropdown danh mục)*, *Khuyến mãi*, *Bán chạy*, *Nội thất giá sỉ*, *Tin tức*, *Về MOHO*, *Cửa hàng*.
- **Hero Banner VLINE đặc trưng**: Khung tag `VLINE`, tiêu đề phong cách *Lưu Giữ Nét Xưa Trong Không Gian Đương Đại*, phân nhóm *Phòng Khách | Phòng Ngủ | Phòng Ăn*, nút bấm *Xem Chi Tiết*.
- **Mục "Ưu Đãi Tháng Phái Đẹp" & "Bán chạy"**: Các thẻ sản phẩm chuẩn từng chi tiết:
  - Tag giảm giá nổi bật (`-26%`, `-32%`, `-10%`, `-42%`...)
  - Combo Giường - Tủ Đầu Giường VLINE (Màu tự nhiên, màu nâu), HOBRO, DALUMD 301, Sofa băng VLINE, Sofa giường thông minh,...
  - Giá khuyến mãi đỏ đậm, giá gốc gạch ngang, số lượng *Đã bán*, đánh giá sao và bảng chọn màu (color swatches).
- **Cụm nút liên hệ nổi (Floating Action Buttons)** ở góc phải dưới:
  - 📞 Hotline (Xanh lá - sao chép số gọi ngay `097 114 1140`)
  - 💬 Zalo CSKH (Xanh dương)
  - 💬 Facebook Messenger (Xanh dương)
  - ⬆️ Cuộn lên đầu trang (Xanh lá - Scroll to top)

### 2. Chế độ Dark Mode (Giao diện ban đêm) 🌙
- Nút chuyển đổi nhanh **Sun / Moon** đặt trên Header.
- Đồng bộ theo giao diện hệ thống máy tính và lưu trữ lựa chọn trong `localStorage`.
- Phối màu Dark Mode sang trọng, giảm mỏi mắt, tương phản cao, bảo toàn độ ấm và màu sắc của chất liệu gỗ nội thất.

### 3. Backend & Cơ Sở Dữ Liệu Hoàn Chỉnh (Flask + SQLite)
- **Cơ sở dữ liệu SQLite (`moho_store.db`)**: Bảng `products`, `categories`, `orders`, `users`.
- **RESTful API**:
  - `GET /api/products`: Lấy danh sách sản phẩm (hỗ trợ lọc danh mục, tìm kiếm từ khóa, sắp xếp theo giá, bán chạy, giảm giá).
  - `GET /api/products/<id>`: Chi tiết sản phẩm, thư viện ảnh (gallery), kích thước, chất liệu, màu sắc.
  - `POST /api/products`: Thêm sản phẩm mới vào kho.
  - `DELETE /api/products/<id>`: Xóa sản phẩm khỏi hệ thống.
  - `GET /api/categories`: Danh mục kèm số lượng sản phẩm.
  - `POST /api/orders`: Tiếp nhận đơn đặt hàng từ khách hàng, tạo mã đơn tự động dạng `MOHO-XXXXX`.
  - `GET /api/orders`: Danh sách đơn hàng cho ban quản trị.
  - `PATCH /api/orders/<code_order>/status`: Cập nhật trạng thái đơn (Chờ xử lý, Đã xác nhận, Đang vận chuyển, Hoàn thành, Hủy).
  - `POST /api/auth/login` & `POST /api/auth/register`: Xác thực tài khoản khách hàng và quản trị viên.
  - `GET /api/stats`: Thống kê doanh thu, đơn hàng, tổng sản phẩm.

### 4. Tính Năng Mua Hàng & Quản Trị Khép Kín
- **Ngăn kéo Giỏ hàng (Cart Drawer)** trượt từ bên phải: Tăng giảm số lượng, xóa món, thanh tiến độ miễn phí vận chuyển cho đơn trên 2 triệu.
- **Modal Thanh toán (Checkout)**: Nhập thông tin người nhận, lựa chọn hình thức COD hoặc chuyển khoản quét mã VietQR.
- **Trang Quản trị Admin (`/admin`)**:
  - Xem bảng thống kê doanh thu và tổng số đơn.
  - Cập nhật trạng thái đơn hàng khi xử lý.
  - Thêm sản phẩm mới hoặc xóa sản phẩm khỏi kho bán lẻ.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Yêu cầu hệ thống:
- Python 3.10+ (Đã có sẵn trên máy của bạn: Python 3.12.7)
- Thư viện Flask (Đã được cài đặt)

### Cách khởi động:

1. Mở cửa sổ dòng lệnh (PowerShell hoặc CMD) tại thư mục dự án:
   ```powershell
   cd c:\Users\1\Downloads\mocnhaa
   ```

2. Khởi động máy chủ web:
   ```powershell
   python app.py
   ```

3. Mở trình duyệt web và truy cập:
   - **Trang chủ cửa hàng**: [http://localhost:5000](http://localhost:5000)
   - **Trang quản trị Admin**: [http://localhost:5000/admin](http://localhost:5000/admin)

> **Tài khoản Admin mẫu:**
> - Email: `admin@moho.vn`
> - Mật khẩu: `admin123`

---

## 🧪 Chạy Kiểm Thử Tự Động (Automated Tests)

Chạy bộ kiểm thử backend API:
```powershell
python test_app.py
```
Kết quả kiểm tra gồm 6 test cases kiểm định toàn bộ từ việc render trang, lọc sản phẩm, tạo đơn hàng cho đến đăng nhập thành công.
