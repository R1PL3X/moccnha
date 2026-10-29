"""
CÔNG CỤ CẤU HÌNH & ĐỒNG BỘ SUPABASE CLOUD (MOCNHA STOREFRONT)
Giúp kết nối dự án với Supabase Cloud Database để dữ liệu đồng bộ
tự động trên mọi máy tính, điện thoại và môi trường triển khai (Vercel/Hosting).

Cách dùng:
    python setup_cloud.py
hoặc:
    python setup_cloud.py --url https://xxxx.supabase.co --key eyJhbGci...
"""

import os
import sys
import json
import argparse

# Load current app modules
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import db_adapter

def print_banner():
    print("=" * 68)
    print("☁️  MOCNHA - CẤU HÌNH ĐỒNG BỘ SUPABASE CLOUD DATABASE CHO MỌI THIẾT BỊ")
    print("=" * 68)

def main():
    parser = argparse.ArgumentParser(description="Thiết lập kết nối Supabase Cloud cho mocnha")
    parser.add_argument("--url", help="Supabase Project URL (https://xxxx.supabase.co)")
    parser.add_argument("--key", help="Supabase Anon/Public Key (hoặc Service Role Key)")
    parser.add_argument("--sync", action="store_true", help="Tự động đẩy dữ liệu từ SQLite nội bộ lên Supabase Cloud")
    args = parser.parse_args()

    print_banner()

    curr_info = db_adapter.get_db_info()
    print(f"📊 Trạng thái hiện tại: {curr_info.get('description', '')}")
    if curr_info.get('mode') == 'supabase':
        print(f"   URL: {curr_info.get('url')}")
        print(f"   Key: {curr_info.get('key_preview')}")
    print("-" * 68)

    url = args.url
    key = args.key

    if not url or not key:
        saved_cfg = db_adapter.load_stored_config()
        default_url = os.environ.get('SUPABASE_URL') or saved_cfg.get('supabase_url') or ''
        default_key = os.environ.get('SUPABASE_KEY') or saved_cfg.get('supabase_key') or ''

        print("Nhập thông tin kết nối Supabase (lấy tại Supabase Dashboard -> Project Settings -> API):")
        if default_url:
            user_url = input(f"1. Supabase Project URL [{default_url}]: ").strip()
            url = user_url if user_url else default_url
        else:
            url = input("1. Supabase Project URL (ví dụ: https://xyz.supabase.co): ").strip()

        if default_key:
            mask_k = default_key[:8] + '...' + default_key[-4:] if len(default_key) > 12 else '***'
            user_key = input(f"2. Supabase API Key (anon/service_role) [{mask_k}]: ").strip()
            key = user_key if user_key else default_key
        else:
            key = input("2. Supabase API Key (anon public key): ").strip()

    if not url or not key:
        print("\n❌ LỖI: Vui lòng nhập đầy đủ Supabase URL và API Key!")
        sys.exit(1)

    print("\n⏳ Đang kiểm tra kết nối tới Supabase Cloud...")
    ok, msg = db_adapter.test_and_configure_supabase(url, key)
    if not ok:
        print(f"❌ Kết nối thất bại: {msg}")
        print("\n👉 Gợi ý:")
        print("  - Đảm bảo URL bắt đầu bằng https:// và chính xác.")
        print("  - Đảm bảo bạn đã chạy file supabase_schema.sql trong SQL Editor của Supabase.")
        sys.exit(1)

    print("✅ Kết nối Supabase Cloud THÀNH CÔNG!")

    # Save to db_config.json
    db_adapter.save_stored_config({'supabase_url': url, 'supabase_key': key})
    print("💾 Đã lưu cấu hình vào db_config.json (Sẽ tự động nhận diện trên các máy tính khác)")

    # Save to .env
    env_path = os.path.join(ROOT_DIR, '.env')
    try:
        lines = []
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        new_lines = []
        url_done = False
        key_done = False
        for line in lines:
            if line.startswith('SUPABASE_URL='):
                new_lines.append(f'SUPABASE_URL={url}\n')
                url_done = True
            elif line.startswith('SUPABASE_KEY='):
                new_lines.append(f'SUPABASE_KEY={key}\n')
                key_done = True
            else:
                new_lines.append(line)
        if not url_done:
            new_lines.append(f'SUPABASE_URL={url}\n')
        if not key_done:
            new_lines.append(f'SUPABASE_KEY={key}\n')
        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print("💾 Đã lưu cấu hình vào file .env")
    except Exception as e:
        print(f"⚠️ Lưu .env cảnh báo: {e}")

    # Prompt sync
    do_sync = args.sync
    if not do_sync and not args.url:
        ans = input("\nBạn có muốn đồng bộ danh mục, sản phẩm và đơn hàng từ SQLite lên Supabase ngay? (Y/n): ").strip().lower()
        do_sync = (ans == 'y' or ans == '' or ans == 'yes')

    if do_sync:
        print("\n🔄 Đang tiến hành đồng bộ dữ liệu lên Supabase Cloud...")
        s_ok, stats = db_adapter.sync_local_to_supabase()
        if s_ok:
            print("🎉 ĐỒNG BỘ THÀNH CÔNG!")
            if isinstance(stats, dict):
                for k, v in stats.items():
                    print(f"   + {k.capitalize()}: {v}")
        else:
            print(f"⚠️ Quá trình đồng bộ gặp lỗi: {stats}")

    print("\n" + "=" * 68)
    print("🚀 HOÀN TẤT THIẾT LẬP ĐỒNG BỘ ĐA THIẾT BỊ!")
    print("Bây giờ bạn có thể:")
    print("  1. Chạy 'python app.py' trên máy tính này hoặc bất kỳ máy tính nào khác.")
    print("  2. Tất cả máy tính sẽ cùng chia sẻ một kho dữ liệu Supabase duy nhất.")
    print("  3. Mọi đơn hàng, trạng thái hay doanh thu cập nhật ở máy này đều sẽ")
    print("     hiển thị tức thì trên các máy tính khác.")
    print("=" * 68 + "\n")

if __name__ == '__main__':
    main()
