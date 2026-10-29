"""
Công cụ đồng bộ hình ảnh sản phẩm từ Cloud về thư mục static/uploads trên máy tính.
Chạy lệnh:
    python sync_images.py
"""

import os
import sys
import json
import base64
import re
import urllib.request

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

def slugify(text):
    text = re.sub(r'[^\w\s-]', '', text.lower())
    return re.sub(r'[-\s]+', '_', text).strip('_')

def run_sync_images():
    print("=" * 60)
    print("📥 MOHO STORE - ĐỒNG BỘ ẢNH TỪ CLOUD VỀ THƯ MỤC TRÊN MÁY")
    print("=" * 60)

    static_dir = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
    pub_dir = os.path.join(os.path.dirname(__file__), 'public', 'static', 'uploads')
    os.makedirs(static_dir, exist_ok=True)
    os.makedirs(pub_dir, exist_ok=True)

    url = 'https://moccnha.vercel.app/api/products'
    print(f"🔄 Đang lấy danh sách sản phẩm từ {url}...")

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            products = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"❌ Không thể tải dữ liệu: {e}")
        return

    print(f"📦 Tìm thấy {len(products)} sản phẩm. Bắt đầu lưu ảnh vào static/uploads/...")

    saved_count = 0
    for p in products:
        pid = p.get('id')
        title = p.get('title', f'product_{pid}')
        img = p.get('image', '')
        slug = slugify(title)[:30]

        if not img:
            continue

        filename = f"prod_{pid}_{slug}.jpg"
        file_path = os.path.join(static_dir, filename)
        pub_path = os.path.join(pub_dir, filename)

        try:
            if img.startswith('data:image'):
                # Base64 image
                header, b64_str = img.split(',', 1)
                img_bytes = base64.b64decode(b64_str)
                with open(file_path, 'wb') as f:
                    f.write(img_bytes)
                with open(pub_path, 'wb') as f:
                    f.write(img_bytes)
                print(f"   ✅ [Base64] Lưu ảnh sản phẩm #{pid} ({title[:30]}...) -> {filename} ({len(img_bytes)//1024} KB)")
                saved_count += 1
            elif img.startswith('http'):
                # Remote URL (nếu file chưa tồn tại thì tải về)
                if not os.path.exists(file_path):
                    try:
                        img_req = urllib.request.Request(img, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(img_req, timeout=10) as img_resp:
                            data = img_resp.read()
                        with open(file_path, 'wb') as f:
                            f.write(data)
                        with open(pub_path, 'wb') as f:
                            f.write(data)
                        print(f"   🌐 [URL] Tải ảnh sản phẩm #{pid} ({title[:30]}...) -> {filename} ({len(data)//1024} KB)")
                        saved_count += 1
                    except Exception as err:
                        print(f"   ⚠️ Bỏ qua tải URL #{pid}: {err}")
        except Exception as e:
            print(f"   ⚠️ Lỗi lưu ảnh #{pid}: {e}")

    print("\n" + "=" * 60)
    print(f"🎉 HOÀN TẤT! Đã đồng bộ {saved_count} file ảnh vào thư mục:")
    print(f"👉 {os.path.abspath(static_dir)}")
    print("=" * 60 + "\n")

if __name__ == '__main__':
    run_sync_images()
