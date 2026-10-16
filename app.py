from flask import Flask, render_template, request, jsonify, session
import sqlite3
import json
import random
import string
import os
from database import get_db_connection, init_db

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'moho-vietnam-default-secret-key-2026')

# Ensure database is initialized
init_db()

def dict_from_row(row):
    """Convert sqlite3.Row to standard dict and parse JSON fields"""
    d = dict(row)
    if 'gallery' in d and d['gallery']:
        try:
            d['gallery'] = json.loads(d['gallery'])
        except Exception:
            d['gallery'] = []
    if 'colors' in d and d['colors']:
        try:
            d['colors'] = json.loads(d['colors'])
        except Exception:
            d['colors'] = []
    if 'items' in d and d['items']:
        try:
            d['items'] = json.loads(d['items'])
        except Exception:
            d['items'] = []
    if 'highlights' in d and d['highlights']:
        try:
            d['highlights'] = json.loads(d['highlights'])
        except Exception:
            d['highlights'] = []
    return d

# --- FRONTEND PAGES ---
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/admin')
def admin_page():
    return render_template('admin.html')

# --- API ENDPOINTS ---

@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db_connection()
    categories = conn.execute('''
        SELECT c.*, COUNT(p.id) as product_count 
        FROM categories c
        LEFT JOIN products p ON c.name = p.category
        GROUP BY c.id
    ''').fetchall()
    conn.close()
    return jsonify([dict(c) for c in categories])

@app.route('/api/products', methods=['GET'])
def get_products():
    conn = get_db_connection()
    category = request.args.get('category')
    search = request.args.get('search')
    bestseller = request.args.get('bestseller')
    promo = request.args.get('promo')
    sort = request.args.get('sort', 'default')

    query = 'SELECT * FROM products WHERE 1=1'
    params = []

    if category and category.lower() != 'all':
        query += ' AND category = ?'
        params.append(category)

    if search:
        query += ' AND (title LIKE ? OR description LIKE ? OR collection LIKE ?)'
        search_pattern = f'%{search}%'
        params.extend([search_pattern, search_pattern, search_pattern])

    if bestseller == '1':
        query += ' AND is_bestseller = 1'

    if promo == '1':
        query += ' AND is_promo = 1'

    if sort == 'price_asc':
        query += ' ORDER BY price ASC'
    elif sort == 'price_desc':
        query += ' ORDER BY price DESC'
    elif sort == 'sold':
        query += ' ORDER BY sold_count DESC'
    elif sort == 'discount':
        query += ' ORDER BY discount_percent DESC'
    else:
        query += ' ORDER BY id ASC'

    rows = conn.execute(query, params).fetchall()
    conn.close()

    products = [dict_from_row(row) for row in rows]
    return jsonify(products)

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    conn = get_db_connection()
    row = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
    conn.close()
    if row is None:
        return jsonify({'error': 'Không tìm thấy sản phẩm'}), 404
    return jsonify(dict_from_row(row))

@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.get_json() or {}
    title = data.get('title')
    category = data.get('category')
    price = data.get('price')
    original_price = data.get('original_price', price)
    discount_percent = data.get('discount_percent', 0)
    image = data.get('image', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800')
    collection = data.get('collection', 'MOHO')
    description = data.get('description', '')
    material = data.get('material', 'Gỗ tự nhiên')
    dimensions = data.get('dimensions', 'Tiêu chuẩn')
    colors = json.dumps(data.get('colors', [{"name": "Mặc định", "hex": "#e3c299"}]))
    gallery = json.dumps(data.get('gallery', [image]))
    is_bestseller = 1 if data.get('is_bestseller') else 0
    is_promo = 1 if data.get('is_promo') else 0

    if not title or not category or price is None:
        return jsonify({'error': 'Vui lòng điền đủ tên, danh mục và giá sản phẩm'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO products (
            title, category, collection, price, original_price, discount_percent,
            image, gallery, colors, is_bestseller, is_promo, description, material, dimensions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        title, category, collection, price, original_price, discount_percent,
        image, gallery, colors, is_bestseller, is_promo, description, material, dimensions
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return jsonify({'success': True, 'id': new_id, 'message': 'Thêm sản phẩm thành công'}), 201

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM products WHERE id = ?', (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Đã xóa sản phẩm thành công'})

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.get_json() or {}
    user_id = data.get('user_id')
    customer_name = data.get('name')
    customer_phone = data.get('phone')
    customer_email = data.get('email', '')
    customer_address = data.get('address')
    payment_method = data.get('payment_method', 'COD')
    note = data.get('note', '')
    items = data.get('items', [])
    total_amount = data.get('total_amount', 0)

    if not user_id:
        return jsonify({'error': 'Quý khách vui lòng đăng nhập tài khoản trước khi đặt hàng'}), 401

    if not customer_name or not customer_phone or not customer_address or not items:
        return jsonify({'error': 'Vui lòng cung cấp đầy đủ thông tin giao hàng và giỏ hàng'}), 400

    # Generate unique order code e.g. MOHO-94827
    code_suffix = ''.join(random.choices(string.digits, k=5))
    order_code = f"MOHO-{code_suffix}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO orders (
            user_id, order_code, customer_name, customer_phone, customer_email,
            customer_address, payment_method, note, items, total_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    ''', (
        user_id, order_code, customer_name, customer_phone, customer_email,
        customer_address, payment_method, note, json.dumps(items), total_amount
    ))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'order_code': order_code,
        'message': 'Đặt hàng thành công! Đội ngũ MOHO sẽ liên hệ xác nhận đơn hàng trong 15 phút.'
    }), 201

@app.route('/api/user/<int:user_id>/orders', methods=['GET'])
def get_user_orders(user_id):
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', (user_id,)).fetchall()
    conn.close()
    return jsonify([dict_from_row(row) for row in rows])

@app.route('/api/orders', methods=['GET'])
def get_orders():
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM orders ORDER BY created_at DESC').fetchall()
    conn.close()
    orders = [dict_from_row(row) for row in rows]
    return jsonify(orders)

@app.route('/api/orders/<string:order_code>/status', methods=['PATCH'])
def update_order_status(order_code):
    data = request.get_json() or {}
    new_status = data.get('status')
    if not new_status:
        return jsonify({'error': 'Thiếu trạng thái mới'}), 400

    conn = get_db_connection()
    conn.execute('UPDATE orders SET status = ? WHERE order_code = ?', (new_status, order_code))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Cập nhật trạng thái thành công'})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    total_products = conn.execute('SELECT COUNT(*) FROM products').fetchone()[0]
    total_orders = conn.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
    total_revenue = conn.execute('SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status != "cancelled"').fetchone()[0]
    conn.close()
    return jsonify({
        'total_products': total_products,
        'total_orders': total_orders,
        'total_revenue': total_revenue
    })

# --- AUTH ENDPOINTS ---
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    fullname = data.get('fullname')
    email = data.get('email')
    phone = data.get('phone', '')
    password = data.get('password')

    if not fullname or not email or not password:
        return jsonify({'error': 'Vui lòng điền đầy đủ họ tên, email và mật khẩu'}), 400

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
        return jsonify({
            'success': True,
            'user': {'id': user_id, 'fullname': fullname, 'email': email, 'phone': phone, 'role': 'customer'},
            'message': 'Đăng ký tài khoản thành công!'
        })
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Email này đã được sử dụng. Vui lòng đăng nhập'}), 400

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Vui lòng nhập email và mật khẩu'}), 400

    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE email = ? AND password = ?', (email, password)).fetchone()
    conn.close()

    if user:
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'fullname': user['fullname'],
                'email': user['email'],
                'phone': user['phone'],
                'role': user['role']
            },
            'message': f'Xin chào, {user["fullname"]}!'
        })
    else:
        return jsonify({'error': 'Email hoặc mật khẩu không chính xác'}), 401

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '1') == '1'
    app.run(host='0.0.0.0', port=port, debug=debug)
