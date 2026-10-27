# Mộc Nhà - Nền tảng thương mại điện tử và quản lý nội thất đồ gỗ

Một hệ thống quản lý và nền tảng thương mại điện tử toàn diện, được xây dựng bằng Python. Dự án bao gồm trang dành cho khách hàng (B2C & B2B), bảng điều khiển quản trị để quản lý đơn hàng, doanh thu, sản phẩm, và được tích hợp một trợ lý ảo thông minh (Chat Advisor).

## 🌟 Tính năng nổi bật

*   **Giao diện Khách hàng:** Khám phá sản phẩm, hệ thống cửa hàng, tin tức, và chính sách.
*   **Hỗ trợ B2B & B2C:** Các trang và quy trình riêng biệt phục vụ cho cả khách hàng lẻ và đối tác doanh nghiệp (Báo giá/Quotes).
*   **Quản trị hệ thống:**
    *   Quản lý Sản phẩm (`admin_products`).
    *   Quản lý Đơn hàng (`admin_orders`).
    *   Báo cáo Doanh thu (`admin_revenue`).
    *   Quản lý Yêu cầu Báo giá (`admin_quotes`).
*   **Tích hợp AI Chat Advisor:** Trợ lý ảo hỗ trợ khách hàng trực tuyến (`chat_advisor.py`).
*   **Cơ sở dữ liệu Supabase:** Quản lý dữ liệu mạnh mẽ với PostgreSQL thông qua Supabase (`sync_to_supabase.py`, `db_adapter.py`).
*   **Hỗ trợ triển khai đa nền tảng:** Sẵn sàng deploy lên Vercel (`vercel.json`) hoặc các nền tảng sử dụng Procfile/Gunicorn.

## 🛠 Công nghệ sử dụng

*   **Backend:** Python (Flask/FastAPI - thông qua `app.py`)
*   **Database:** Supabase (PostgreSQL)
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (`templates/`, `static/`)
*   **Deployment:** Vercel, Gunicorn

## ⚙️ Yêu cầu hệ thống

*   Python 3.8+
*   Tài khoản Supabase (để thiết lập cơ sở dữ liệu)

## 🚀 Hướng dẫn cài đặt

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd moccnha
   ```

2. **Tạo môi trường ảo (Virtual Environment):**
   ```bash
   python -m venv venv
   # Kích hoạt trên Windows:
   venv\Scripts\activate
   # Kích hoạt trên macOS/Linux:
   source venv/bin/activate
   ```

3. **Cài đặt thư viện phụ thuộc:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Thiết lập biến môi trường:**
   * Copy file `.env.example` thành `.env`
   * Cập nhật các thông tin cấu hình (đặc biệt là API Keys của Supabase và AI Chat):
   ```bash
   cp .env.example .env
   ```

5. **Thiết lập cơ sở dữ liệu:**
   * Chạy các script SQL trong `supabase_schema.sql` trên Supabase Dashboard của bạn để tạo bảng.

6. **Khởi chạy ứng dụng (Local Development):**
   * Sử dụng file batch chạy trên Windows:
   ```bash
   start.bat
   ```
   * Hoặc chạy trực tiếp bằng Python:
   ```bash
   python app.py
   ```
   Ứng dụng sẽ hoạt động tại `http://localhost:5000`

## ☁️ Triển khai (Deployment)

Dự án này đã được cấu hình sẵn để triển khai dễ dàng:

*   **Vercel:** Sử dụng file `vercel.json` và thư mục `api/` để deploy dạng Serverless Functions.
*   **Heroku / Render:** Sử dụng `Procfile` (chạy qua lệnh `web: gunicorn app:app`).
Ứng dụng bản chính thức đang hoạt động tại [https://moccnha.vercel.app/](https://moccnha.vercel.app/)

## 📁 Cấu trúc thư mục chính

```text
├── api/                  # Serverless functions cho Vercel
├── public/               # Cấu trúc tệp tĩnh public
├── static/               # Assets (CSS, JS, Hình ảnh)
│   ├── css/
│   └── js/               # Chứa app.js, admin.js, chat.js
├── templates/            # Giao diện HTML (Admin, B2B, Stores, News,...)
├── app.py                # Điểm vào chính của ứng dụng
├── chat_advisor.py       # Logic xử lý cho Chatbot AI
├── database.py           # Kết nối cơ sở dữ liệu
├── db_adapter.py         # Cầu nối thao tác dữ liệu
├── supabase_schema.sql   # File cấu trúc bảng Supabase
└── sync_to_supabase.py   # Script đồng bộ dữ liệu
```

## 🧪 Kiểm thử

Chạy script kiểm thử để đảm bảo hệ thống hoạt động ổn định:
```bash
python test_app.py
```
