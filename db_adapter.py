"""
Database Adapter for MOHO Storefront
Supports dual-mode database access:
1. Supabase Cloud PostgreSQL (when SUPABASE_URL and SUPABASE_KEY are provided in .env)
2. Local SQLite database (moho_store.db) as seamless offline fallback

Allows multiple machines, mobile devices, and deployed instances to share
the exact same real-time cloud data on Supabase without local data silos.
"""

import os
import json
import logging
from database import get_db_connection, init_db

# Load environment variables from .env if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger('moho.db_adapter')

SUPABASE_URL = (os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or '').strip()
SUPABASE_KEY = (os.environ.get('SUPABASE_KEY') or os.environ.get('SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or '').strip()

supabase_client = None
_using_supabase = False

def init_supabase():
    global supabase_client, _using_supabase
    if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL.startswith('http'):
        try:
            from supabase import create_client, Client
            supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            # Lightweight verification ping
            supabase_client.table('categories').select('id').limit(1).execute()
            _using_supabase = True
            print(f"[DB ADAPTER] -> Successfully connected to Supabase Cloud Database: {SUPABASE_URL}")
            return True
        except Exception as e:
            print(f"[DB ADAPTER] -> Supabase connection attempt failed: {e}")
            print("[DB ADAPTER] -> Falling back to local SQLite database (moho_store.db)")
            _using_supabase = False
            supabase_client = None
            return False
    else:
        _using_supabase = False
        supabase_client = None
        return False

# Attempt initial connection
init_supabase()

def is_supabase_enabled():
    """Return whether the application is currently connected to Supabase Cloud"""
    return _using_supabase and supabase_client is not None

def get_db_info():
    """Return current database mode and status"""
    if is_supabase_enabled():
        # Mask key for safety
        masked_key = SUPABASE_KEY[:8] + '...' + SUPABASE_KEY[-4:] if len(SUPABASE_KEY) > 12 else '***'
        return {
            'mode': 'supabase',
            'status': 'connected',
            'url': SUPABASE_URL,
            'key_preview': masked_key,
            'description': 'Đang kết nối Supabase Cloud PostgreSQL (Đồng bộ đa thiết bị)'
        }
    else:
        return {
            'mode': 'sqlite',
            'status': 'active',
            'url': 'local://moho_store.db',
            'description': 'Đang sử dụng SQLite nội bộ (Chỉ lưu trên máy hiện tại)'
        }

def normalize_json_field(val):
    """Normalize JSON fields whether stored as string (SQLite) or native (Postgres JSONB)"""
    if val is None:
        return []
    if isinstance(val, (list, dict)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return []
    return []

def format_product_dict(d):
    """Ensure consistent formatting for product dicts"""
    if not d:
        return d
    res = dict(d)
    res['gallery'] = normalize_json_field(res.get('gallery'))
    res['colors'] = normalize_json_field(res.get('colors'))
    res['highlights'] = normalize_json_field(res.get('highlights'))
    return res

def format_order_dict(d):
    """Ensure consistent formatting for order dicts"""
    if not d:
        return d
    res = dict(d)
    res['items'] = normalize_json_field(res.get('items'))
    return res

def format_quote_dict(d):
    """Ensure consistent formatting for quote dicts"""
    if not d:
        return d
    return dict(d)

# ==============================================================================
# DATA ACCESS FUNCTIONS
# ==============================================================================

def get_categories():
    """Fetch categories with product count"""
    if is_supabase_enabled():
        try:
            cats_res = supabase_client.table('categories').select('*').order('id').execute()
            categories = cats_res.data or []
            
            # Fetch products to calculate product counts
            prod_res = supabase_client.table('products').select('category').execute()
            counts = {}
            for p in (prod_res.data or []):
                cat_name = p.get('category')
                counts[cat_name] = counts.get(cat_name, 0) + 1
                
            for c in categories:
                c['product_count'] = counts.get(c.get('name'), 0)
                
            return categories
        except Exception as e:
            logger.error(f"Supabase get_categories error: {e}")
            # Fall back to SQLite if error
            pass

    # SQLite Fallback
    conn = get_db_connection()
    rows = conn.execute('''
        SELECT c.*, COUNT(p.id) as product_count 
        FROM categories c
        LEFT JOIN products p ON c.name = p.category
        GROUP BY c.id
    ''').fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_products(category=None, search=None, bestseller=None, promo=None, sort='default'):
    """Fetch products with optional filters and sorting"""
    if is_supabase_enabled():
        try:
            query = supabase_client.table('products').select('*')
            
            if category and category.lower() != 'all':
                query = query.eq('category', category)
                
            if bestseller == '1' or bestseller is True or bestseller == 1:
                query = query.eq('is_bestseller', 1)
                
            if promo == '1' or promo is True or promo == 1:
                query = query.eq('is_promo', 1)
                
            if search:
                # Postgrest ilike query
                s = f"%{search}%"
                query = query.or_(f"title.ilike.{s},description.ilike.{s},collection.ilike.{s}")
                
            if sort == 'price_asc':
                query = query.order('price', desc=False)
            elif sort == 'price_desc':
                query = query.order('price', desc=True)
            elif sort == 'sold':
                query = query.order('sold_count', desc=True)
            elif sort == 'discount':
                query = query.order('discount_percent', desc=True)
            else:
                query = query.order('id', desc=False)
                
            res = query.execute()
            return [format_product_dict(p) for p in (res.data or [])]
        except Exception as e:
            logger.error(f"Supabase get_products error: {e}")
            pass

    # SQLite Fallback
    conn = get_db_connection()
    q = 'SELECT * FROM products WHERE 1=1'
    params = []

    if category and category.lower() != 'all':
        q += ' AND category = ?'
        params.append(category)

    if search:
        q += ' AND (title LIKE ? OR description LIKE ? OR collection LIKE ?)'
        s_pat = f'%{search}%'
        params.extend([s_pat, s_pat, s_pat])

    if bestseller == '1' or bestseller is True or bestseller == 1:
        q += ' AND is_bestseller = 1'

    if promo == '1' or promo is True or promo == 1:
        q += ' AND is_promo = 1'

    if sort == 'price_asc':
        q += ' ORDER BY price ASC'
    elif sort == 'price_desc':
        q += ' ORDER BY price DESC'
    elif sort == 'sold':
        q += ' ORDER BY sold_count DESC'
    elif sort == 'discount':
        q += ' ORDER BY discount_percent DESC'
    else:
        q += ' ORDER BY id ASC'

    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [format_product_dict(dict(r)) for r in rows]

def get_product_by_id(product_id):
    """Fetch a single product by ID"""
    if is_supabase_enabled():
        try:
            res = supabase_client.table('products').select('*').eq('id', product_id).limit(1).execute()
            if res.data:
                return format_product_dict(res.data[0])
            return None
        except Exception as e:
            logger.error(f"Supabase get_product_by_id error: {e}")
            pass

    # SQLite Fallback
    conn = get_db_connection()
    row = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
    conn.close()
    if row is None:
        return None
    return format_product_dict(dict(row))

def create_product(product_data):
    """Create a new product in the database"""
    if is_supabase_enabled():
        try:
            # Format payload for Supabase PostgreSQL
            payload = {
                'title': product_data['title'],
                'category': product_data['category'],
                'collection': product_data.get('collection', 'MOHO'),
                'price': product_data['price'],
                'original_price': product_data.get('original_price', product_data['price']),
                'discount_percent': product_data.get('discount_percent', 0),
                'sold_count': int(product_data.get('sold_count') or 0),
                'image': product_data.get('image', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800'),
                'description': product_data.get('description', ''),
                'material': product_data.get('material', 'Gỗ tự nhiên'),
                'dimensions': product_data.get('dimensions', 'Tiêu chuẩn'),
                'is_bestseller': 1 if product_data.get('is_bestseller') else 0,
                'is_promo': 1 if product_data.get('is_promo') else 0,
                'gallery': normalize_json_field(product_data.get('gallery')),
                'colors': normalize_json_field(product_data.get('colors')),
                'highlights': normalize_json_field(product_data.get('highlights'))
            }
            res = supabase_client.table('products').insert(payload).execute()
            if res.data:
                return res.data[0]['id']
            return True
        except Exception as e:
            logger.error(f"Supabase create_product error: {e}")
            raise

    # SQLite Fallback
    conn = get_db_connection()
    cursor = conn.cursor()
    gallery_str = json.dumps(normalize_json_field(product_data.get('gallery', [product_data.get('image')])))
    colors_str = json.dumps(normalize_json_field(product_data.get('colors', [{"name": "Mặc định", "hex": "#e3c299"}])))
    highlights_str = json.dumps(normalize_json_field(product_data.get('highlights', [])))
    sold_count = int(product_data.get('sold_count') or 0)

    cursor.execute('''
        INSERT INTO products (
            title, category, collection, price, original_price, discount_percent,
            sold_count, image, gallery, colors, is_bestseller, is_promo, description, material, dimensions, highlights
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        product_data['title'], product_data['category'], product_data.get('collection', 'MOHO'),
        product_data['price'], product_data.get('original_price', product_data['price']),
        product_data.get('discount_percent', 0), sold_count, product_data.get('image', ''),
        gallery_str, colors_str, 1 if product_data.get('is_bestseller') else 0,
        1 if product_data.get('is_promo') else 0, product_data.get('description', ''),
        product_data.get('material', 'Gỗ tự nhiên'), product_data.get('dimensions', 'Tiêu chuẩn'),
        highlights_str
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id

def update_product(product_id, product_data):
    """Update product information, including sold_count, price, title, etc."""
    if is_supabase_enabled():
        try:
            payload = {}
            for field in ['title', 'category', 'collection', 'price', 'original_price',
                          'discount_percent', 'sold_count', 'image', 'description',
                          'material', 'dimensions', 'is_bestseller', 'is_promo']:
                if field in product_data:
                    if field in ['price', 'original_price', 'discount_percent', 'sold_count', 'is_bestseller', 'is_promo']:
                        payload[field] = int(product_data[field])
                    else:
                        payload[field] = product_data[field]
            if 'gallery' in product_data:
                payload['gallery'] = normalize_json_field(product_data['gallery'])
            if 'colors' in product_data:
                payload['colors'] = normalize_json_field(product_data['colors'])
            if 'highlights' in product_data:
                payload['highlights'] = normalize_json_field(product_data['highlights'])

            if payload:
                supabase_client.table('products').update(payload).eq('id', product_id).execute()
            return True
        except Exception as e:
            logger.error(f"Supabase update_product error: {e}")
            raise

    # SQLite Fallback
    conn = get_db_connection()
    cursor = conn.cursor()
    fields = []
    params = []
    for field in ['title', 'category', 'collection', 'price', 'original_price',
                  'discount_percent', 'sold_count', 'image', 'description',
                  'material', 'dimensions', 'is_bestseller', 'is_promo']:
        if field in product_data:
            fields.append(f"{field} = ?")
            if field in ['price', 'original_price', 'discount_percent', 'sold_count', 'is_bestseller', 'is_promo']:
                params.append(int(product_data[field]))
            else:
                params.append(product_data[field])

    if 'gallery' in product_data:
        fields.append("gallery = ?")
        params.append(json.dumps(normalize_json_field(product_data['gallery'])))
    if 'colors' in product_data:
        fields.append("colors = ?")
        params.append(json.dumps(normalize_json_field(product_data['colors'])))
    if 'highlights' in product_data:
        fields.append("highlights = ?")
        params.append(json.dumps(normalize_json_field(product_data['highlights'])))

    if fields:
        params.append(product_id)
        cursor.execute(f"UPDATE products SET {', '.join(fields)} WHERE id = ?", params)
        conn.commit()
    conn.close()
    return True

def delete_product(product_id):
    """Delete a product by ID"""
    if is_supabase_enabled():
        try:
            supabase_client.table('products').delete().eq('id', product_id).execute()
            return True
        except Exception as e:
            logger.error(f"Supabase delete_product error: {e}")
            raise

    # SQLite Fallback
    conn = get_db_connection()
    conn.execute('DELETE FROM products WHERE id = ?', (product_id,))
    conn.commit()
    conn.close()
    return True

def create_order(order_data):
    """Create a new order in the database and increment sold_count for purchased products"""
    items = normalize_json_field(order_data.get('items', []))
    status = order_data.get('status', 'pending')

    if is_supabase_enabled():
        try:
            payload = {
                'user_id': order_data['user_id'],
                'order_code': order_data['order_code'],
                'customer_name': order_data['customer_name'],
                'customer_phone': order_data['customer_phone'],
                'customer_email': order_data.get('customer_email', ''),
                'customer_address': order_data['customer_address'],
                'payment_method': order_data.get('payment_method', 'COD'),
                'note': order_data.get('note', ''),
                'items': items,
                'total_amount': order_data['total_amount'],
                'status': status
            }
            supabase_client.table('orders').insert(payload).execute()

            # Increase sold_count for purchased products
            for item in items:
                pid = item.get('id') or item.get('product_id')
                qty = int(item.get('quantity') or 1)
                if pid and qty > 0:
                    try:
                        p_res = supabase_client.table('products').select('sold_count').eq('id', pid).single().execute()
                        curr_sold = (p_res.data or {}).get('sold_count') or 0
                        supabase_client.table('products').update({'sold_count': curr_sold + qty}).eq('id', pid).execute()
                    except Exception as err:
                        logger.error(f"Failed to increment sold_count in Supabase for product {pid}: {err}")

            return True
        except Exception as e:
            logger.error(f"Supabase create_order error: {e}")
            raise

    # SQLite Fallback
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO orders (
            user_id, order_code, customer_name, customer_phone, customer_email,
            customer_address, payment_method, note, items, total_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        order_data['user_id'], order_data['order_code'], order_data['customer_name'],
        order_data['customer_phone'], order_data.get('customer_email', ''),
        order_data['customer_address'], order_data.get('payment_method', 'COD'),
        order_data.get('note', ''), json.dumps(items),
        order_data['total_amount'], status
    ))

    # Increase sold_count for purchased products
    for item in items:
        pid = item.get('id') or item.get('product_id')
        qty = int(item.get('quantity') or 1)
        if pid and qty > 0:
            cursor.execute('''
                UPDATE products 
                SET sold_count = COALESCE(sold_count, 0) + ? 
                WHERE id = ?
            ''', (qty, pid))

    conn.commit()
    conn.close()
    return True

def get_user_orders(user_id):
    """Retrieve all orders placed by a specific user"""
    if is_supabase_enabled():
        try:
            res = supabase_client.table('orders').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
            return [format_order_dict(o) for o in (res.data or [])]
        except Exception as e:
            logger.error(f"Supabase get_user_orders error: {e}")
            pass

    # SQLite Fallback
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', (user_id,)).fetchall()
    conn.close()
    return [format_order_dict(dict(r)) for r in rows]

def get_orders():
    """Retrieve all orders for admin management"""
    if is_supabase_enabled():
        try:
            res = supabase_client.table('orders').select('*').order('created_at', desc=True).execute()
            return [format_order_dict(o) for o in (res.data or [])]
        except Exception as e:
            logger.error(f"Supabase get_orders error: {e}")
            pass

    # SQLite Fallback
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM orders ORDER BY created_at DESC').fetchall()
    conn.close()
    return [format_order_dict(dict(r)) for r in rows]

def update_order_status(order_code, new_status):
    """Update status of an order by its unique code and adjust sold_count if status changed to/from cancelled"""
    if is_supabase_enabled():
        try:
            # Check old status to adjust sold_count
            res = supabase_client.table('orders').select('*').eq('order_code', order_code).single().execute()
            order = res.data
            if order:
                old_status = order.get('status')
                items = normalize_json_field(order.get('items'))
                if old_status != new_status:
                    if new_status == 'cancelled' and old_status != 'cancelled':
                        for item in items:
                            pid = item.get('id') or item.get('product_id')
                            qty = int(item.get('quantity') or 1)
                            if pid and qty > 0:
                                try:
                                    p_res = supabase_client.table('products').select('sold_count').eq('id', pid).single().execute()
                                    if p_res.data:
                                        curr = p_res.data.get('sold_count') or 0
                                        supabase_client.table('products').update({'sold_count': max(0, curr - qty)}).eq('id', pid).execute()
                                except Exception as err:
                                    logger.error(f"Error decreasing sold_count in Supabase: {err}")
                    elif old_status == 'cancelled' and new_status != 'cancelled':
                        for item in items:
                            pid = item.get('id') or item.get('product_id')
                            qty = int(item.get('quantity') or 1)
                            if pid and qty > 0:
                                try:
                                    p_res = supabase_client.table('products').select('sold_count').eq('id', pid).single().execute()
                                    if p_res.data:
                                        curr = p_res.data.get('sold_count') or 0
                                        supabase_client.table('products').update({'sold_count': curr + qty}).eq('id', pid).execute()
                                except Exception as err:
                                    logger.error(f"Error increasing sold_count in Supabase: {err}")

            supabase_client.table('orders').update({'status': new_status}).eq('order_code', order_code).execute()
            return True
        except Exception as e:
            logger.error(f"Supabase update_order_status error: {e}")
            raise

    # SQLite Fallback
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute('SELECT status, items FROM orders WHERE order_code = ?', (order_code,)).fetchone()
    if row:
        old_status = row['status']
        items = normalize_json_field(row['items'])
        if old_status != new_status:
            if new_status == 'cancelled' and old_status != 'cancelled':
                for item in items:
                    pid = item.get('id') or item.get('product_id')
                    qty = int(item.get('quantity') or 1)
                    if pid and qty > 0:
                        cursor.execute('UPDATE products SET sold_count = MAX(0, COALESCE(sold_count, 0) - ?) WHERE id = ?', (qty, pid))
            elif old_status == 'cancelled' and new_status != 'cancelled':
                for item in items:
                    pid = item.get('id') or item.get('product_id')
                    qty = int(item.get('quantity') or 1)
                    if pid and qty > 0:
                        cursor.execute('UPDATE products SET sold_count = COALESCE(sold_count, 0) + ? WHERE id = ?', (qty, pid))

    cursor.execute('UPDATE orders SET status = ? WHERE order_code = ?', (new_status, order_code))
    conn.commit()
    conn.close()
    return True

def sync_sold_counts_from_orders():
    """
    Synchronize product sold_count by scanning all valid (non-cancelled) orders.
    Ensures that every product reflects at least the number of items sold in orders.
    """
    if is_supabase_enabled():
        try:
            o_res = supabase_client.table('orders').select('items, status').neq('status', 'cancelled').execute()
            orders = o_res.data or []
            item_counts = {}
            for o in orders:
                for item in normalize_json_field(o.get('items')):
                    pid = item.get('id') or item.get('product_id')
                    qty = int(item.get('quantity') or 1)
                    if pid and qty > 0:
                        item_counts[pid] = item_counts.get(pid, 0) + qty

            for pid, count in item_counts.items():
                p_res = supabase_client.table('products').select('sold_count').eq('id', pid).single().execute()
                if p_res.data:
                    curr = p_res.data.get('sold_count') or 0
                    if curr < count:
                        supabase_client.table('products').update({'sold_count': count}).eq('id', pid).execute()
            return True
        except Exception as e:
            logger.error(f"Supabase sync_sold_counts_from_orders error: {e}")
            pass

    # SQLite
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute("SELECT items FROM orders WHERE status != 'cancelled'").fetchall()
    item_counts = {}
    for r in rows:
        for item in normalize_json_field(r['items']):
            pid = item.get('id') or item.get('product_id')
            qty = int(item.get('quantity') or 1)
            if pid and qty > 0:
                item_counts[pid] = item_counts.get(pid, 0) + qty

    for pid, count in item_counts.items():
        cursor.execute('''
            UPDATE products 
            SET sold_count = CASE 
                WHEN sold_count IS NULL OR sold_count < ? THEN ? 
                ELSE sold_count 
            END 
            WHERE id = ?
        ''', (count, count, pid))
    conn.commit()
    conn.close()
    return True

# ==============================================================================
# B2B QUOTES DATA ACCESS FUNCTIONS
# ==============================================================================

def create_quote(quote_data):
    """Insert a new B2B quote request"""
    fullname = quote_data.get('fullname') or quote_data.get('name') or ''
    phone = quote_data.get('phone') or ''
    email = quote_data.get('email', '')
    project_type = quote_data.get('project_type', '')
    note = quote_data.get('note', '')
    status = quote_data.get('status', 'pending')

    if is_supabase_enabled():
        try:
            payload = {
                'fullname': fullname,
                'phone': phone,
                'email': email,
                'project_type': project_type,
                'note': note,
                'status': status
            }
            res = supabase_client.table('quotes').insert(payload).execute()
            if res.data:
                return res.data[0]['id']
            return True
        except Exception as e:
            logger.error(f"Supabase create_quote error: {e}")
            raise

    # SQLite Fallback
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO quotes (fullname, phone, email, project_type, note, status)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (fullname, phone, email, project_type, note, status))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id

def get_quotes():
    """Retrieve all B2B quote requests for admin management"""
    if is_supabase_enabled():
        try:
            res = supabase_client.table('quotes').select('*').order('created_at', desc=True).execute()
            return [format_quote_dict(q) for q in (res.data or [])]
        except Exception as e:
            logger.error(f"Supabase get_quotes error: {e}")
            pass

    # SQLite Fallback
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM quotes ORDER BY created_at DESC').fetchall()
    conn.close()
    return [format_quote_dict(dict(r)) for r in rows]

def update_quote_status(quote_id, new_status):
    """Update status of a quote request by its ID"""
    if is_supabase_enabled():
        try:
            supabase_client.table('quotes').update({'status': new_status}).eq('id', quote_id).execute()
            return True
        except Exception as e:
            logger.error(f"Supabase update_quote_status error: {e}")
            raise

    # SQLite Fallback
    conn = get_db_connection()
    conn.execute('UPDATE quotes SET status = ? WHERE id = ?', (new_status, quote_id))
    conn.commit()
    conn.close()
    return True

def delete_quote(quote_id):
    """Delete a quote request by ID"""
    if is_supabase_enabled():
        try:
            supabase_client.table('quotes').delete().eq('id', quote_id).execute()
            return True
        except Exception as e:
            logger.error(f"Supabase delete_quote error: {e}")
            raise

    # SQLite Fallback
    conn = get_db_connection()
    conn.execute('DELETE FROM quotes WHERE id = ?', (quote_id,))
    conn.commit()
    conn.close()
    return True

def get_stats():
    """Calculate dashboard metrics (products count, orders count, total revenue, quotes count)"""
    if is_supabase_enabled():
        try:
            # Count products
            p_res = supabase_client.table('products').select('id', count='exact').execute()
            total_products = p_res.count if p_res.count is not None else len(p_res.data or [])
            
            # Count orders and calculate revenue
            o_res = supabase_client.table('orders').select('total_amount, status').execute()
            orders = o_res.data or []
            total_orders = len(orders)
            total_revenue = sum(o.get('total_amount', 0) for o in orders if o.get('status') != 'cancelled')

            # Count quotes
            q_res = supabase_client.table('quotes').select('id', count='exact').execute()
            total_quotes = q_res.count if q_res.count is not None else len(q_res.data or [])
            
            return {
                'total_products': total_products,
                'total_orders': total_orders,
                'total_revenue': total_revenue,
                'total_quotes': total_quotes
            }
        except Exception as e:
            logger.error(f"Supabase get_stats error: {e}")
            pass

    # SQLite Fallback
    conn = get_db_connection()
    total_products = conn.execute('SELECT COUNT(*) FROM products').fetchone()[0]
    total_orders = conn.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
    total_revenue = conn.execute('SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status != "cancelled"').fetchone()[0]
    try:
        total_quotes = conn.execute('SELECT COUNT(*) FROM quotes').fetchone()[0]
    except Exception:
        total_quotes = 0
    conn.close()
    return {
        'total_products': total_products,
        'total_orders': total_orders,
        'total_revenue': total_revenue,
        'total_quotes': total_quotes
    }

def register_user(fullname, email, phone, password):
    """Register a new customer account"""
    if is_supabase_enabled():
        try:
            # Check if email exists
            existing = supabase_client.table('users').select('id').eq('email', email).execute()
            if existing.data and len(existing.data) > 0:
                return {'error': 'Email này đã được sử dụng. Vui lòng đăng nhập'}
                
            payload = {
                'fullname': fullname,
                'email': email,
                'phone': phone,
                'password': password,
                'role': 'customer'
            }
            res = supabase_client.table('users').insert(payload).execute()
            if res.data:
                user = res.data[0]
                return {
                    'success': True,
                    'user': {
                        'id': user['id'],
                        'fullname': user['fullname'],
                        'email': user['email'],
                        'phone': user['phone'],
                        'role': user['role']
                    }
                }
            return {'error': 'Không thể tạo tài khoản trên cloud'}
        except Exception as e:
            logger.error(f"Supabase register_user error: {e}")
            return {'error': f'Lỗi đăng ký Supabase: {str(e)}'}

    # SQLite Fallback
    import sqlite3
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO users (fullname, email, phone, password, role) VALUES (?, ?, ?, ?, "customer")',
            (fullname, email, phone, password)
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return {
            'success': True,
            'user': {'id': user_id, 'fullname': fullname, 'email': email, 'phone': phone, 'role': 'customer'}
        }
    except sqlite3.IntegrityError:
        conn.close()
        return {'error': 'Email này đã được sử dụng. Vui lòng đăng nhập'}

def authenticate_user(email, password):
    """Authenticate user login credentials"""
    if is_supabase_enabled():
        try:
            res = supabase_client.table('users').select('*').eq('email', email).eq('password', password).limit(1).execute()
            if res.data and len(res.data) > 0:
                user = res.data[0]
                return {
                    'id': user['id'],
                    'fullname': user['fullname'],
                    'email': user['email'],
                    'phone': user['phone'],
                    'role': user['role']
                }
            return None
        except Exception as e:
            logger.error(f"Supabase authenticate_user error: {e}")
            pass

    # SQLite Fallback
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE email = ? AND password = ?', (email, password)).fetchone()
    conn.close()
    if user:
        return {
            'id': user['id'],
            'fullname': user['fullname'],
            'email': user['email'],
            'phone': user['phone'],
            'role': user['role']
        }
    return None
