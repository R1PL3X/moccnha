"""
Script đồng bộ dữ liệu từ SQLite nội bộ (moho_store.db) lên Supabase Cloud Database.
Chạy lệnh:
    python sync_to_supabase.py

Yêu cầu:
    Đã điền SUPABASE_URL và SUPABASE_KEY trong file .env
"""

import os
import sys
import json
from database import get_db_connection

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SUPABASE_URL = (os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or '').strip()
SUPABASE_KEY = (os.environ.get('SUPABASE_KEY') or os.environ.get('SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or '').strip()

def parse_json_safely(val):
    if not val:
        return []
    if isinstance(val, (list, dict)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return []

def run_sync():
    print("=" * 60)
    print("🚀 MOHO STORE - CÔNG CỤ ĐỒNG BỘ DỮ LIỆU LÊN SUPABASE CLOUD")
    print("=" * 60)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\n❌ LỖI: Chưa tìm thấy thông tin SUPABASE_URL hoặc SUPABASE_KEY!")
        print("👉 Hướng dẫn khắc phục:")
        print("   1. Mở file .env (hoặc tạo file .env từ .env.example)")
        print("   2. Thêm 2 dòng sau với thông tin từ Supabase Dashboard của bạn:")
        print("      SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co")
        print("      SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...")
        print("   3. Chạy lại: python sync_to_supabase.py\n")
        sys.exit(1)

    try:
        from supabase import create_client
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"✅ Đã kết nối tới Supabase: {SUPABASE_URL}")
    except Exception as e:
        print(f"\n❌ Không thể kết nối tới Supabase: {e}")
        sys.exit(1)

    conn = get_db_connection()

    # 1. Đồng bộ Categories
    print("\n📂 [1/3] Đang đồng bộ danh mục sản phẩm (categories)...")
    cats = conn.execute('SELECT * FROM categories').fetchall()
    cat_count = 0
    for c in cats:
        cat_data = {
            'name': c['name'],
            'slug': c['slug'],
            'icon': c['icon']
        }
        try:
            # Upsert category by name
            res = supabase.table('categories').upsert(cat_data, on_conflict='name').execute()
            cat_count += 1
        except Exception as e:
            print(f"   ⚠️ Lỗi đồng bộ danh mục {c['name']}: {e}")
    print(f"   ✅ Đã đồng bộ thành công {cat_count}/{len(cats)} danh mục lên Supabase!")

    # 2. Đồng bộ Products
    print("\n🛋️ [2/3] Đang đồng bộ sản phẩm (products)...")
    prods = conn.execute('SELECT * FROM products').fetchall()
    prod_count = 0
    for p in prods:
        prod_dict = dict(p)
        payload = {
            'title': prod_dict['title'],
            'full_title': prod_dict.get('full_title') or prod_dict['title'],
            'category': prod_dict['category'],
            'collection': prod_dict.get('collection') or 'MOHO',
            'price': prod_dict['price'],
            'original_price': prod_dict.get('original_price', prod_dict['price']),
            'discount_percent': prod_dict.get('discount_percent', 0),
            'rating': prod_dict.get('rating', 5.0),
            'review_count': prod_dict.get('review_count', 0),
            'sold_count': prod_dict.get('sold_count', 0),
            'image': prod_dict.get('image', ''),
            'detail_image': prod_dict.get('detail_image', ''),
            'gallery': parse_json_safely(prod_dict.get('gallery')),
            'colors': parse_json_safely(prod_dict.get('colors')),
            'highlights': parse_json_safely(prod_dict.get('highlights')),
            'is_bestseller': prod_dict.get('is_bestseller', 0),
            'is_promo': prod_dict.get('is_promo', 0),
            'description': prod_dict.get('description', ''),
            'material': prod_dict.get('material', 'Gỗ tự nhiên'),
            'dimensions': prod_dict.get('dimensions', 'Tiêu chuẩn')
        }
        try:
            # Check if product with same title exists
            existing = supabase.table('products').select('id').eq('title', payload['title']).execute()
            if existing.data and len(existing.data) > 0:
                supabase.table('products').update(payload).eq('title', payload['title']).execute()
            else:
                supabase.table('products').insert(payload).execute()
            prod_count += 1
            print(f"   + {payload['title'][:40]}... (OK)")
        except Exception as e:
            print(f"   ⚠️ Lỗi tải sản phẩm {prod_dict['title']}: {e}")
    print(f"   ✅ Đã đồng bộ thành công {prod_count}/{len(prods)} sản phẩm lên Supabase!")

    # 3. Đồng bộ Users (Admin & Customers)
    print("\n👤 [3/3] Đang đồng bộ tài khoản người dùng (users)...")
    users = conn.execute('SELECT * FROM users').fetchall()
    user_count = 0
    for u in users:
        u_dict = dict(u)
        user_payload = {
            'fullname': u_dict['fullname'],
            'email': u_dict['email'],
            'phone': u_dict.get('phone', ''),
            'password': u_dict['password'],
            'role': u_dict.get('role', 'customer')
        }
        try:
            supabase.table('users').upsert(user_payload, on_conflict='email').execute()
            user_count += 1
        except Exception as e:
            print(f"   ⚠️ Lỗi đồng bộ user {u_dict['email']}: {e}")
    print(f"   ✅ Đã đồng bộ thành công {user_count}/{len(users)} người dùng lên Supabase!")

    conn.close()

    print("\n" + "=" * 60)
    print("🎉 HOÀN TẤT ĐỒNG BỘ DỮ LIỆU LÊN SUPABASE CLOUD!")
    print("Tất cả máy tính, điện thoại hoặc trang web khi mở sẽ truy cập chung")
    print("vào cơ sở dữ liệu Supabase đám mây này mà không còn bị lưu nội bộ.")
    print("=" * 60 + "\n")

if __name__ == '__main__':
    run_sync()
