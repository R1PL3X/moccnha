import sqlite3
import os
import json

is_vercel = os.environ.get('VERCEL') == '1' or 'VERCEL' in os.environ
if is_vercel:
    DB_FILE = '/tmp/moho_store.db'
else:
    DB_FILE = os.path.join(os.path.dirname(__file__), 'moho_store.db')

def get_db_connection():
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception:
        conn = sqlite3.connect(':memory:')
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    try:
        _init_db_internal()
    except Exception as e:
        print(f"[DB INIT WARNING] {e}")

def _init_db_internal():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create Products table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            collection TEXT,
            price INTEGER NOT NULL,
            original_price INTEGER NOT NULL,
            discount_percent INTEGER NOT NULL,
            rating REAL DEFAULT 5.0,
            review_count INTEGER DEFAULT 0,
            sold_count INTEGER DEFAULT 0,
            image TEXT NOT NULL,
            gallery TEXT, -- JSON array of image URLs
            colors TEXT,  -- JSON array of color options
            is_bestseller INTEGER DEFAULT 0,
            is_promo INTEGER DEFAULT 0,
            description TEXT,
            material TEXT,
            dimensions TEXT,
            full_title TEXT,
            highlights TEXT, -- JSON array of {title, content}
            detail_image TEXT
        )
    ''')

    # Migration: Add new columns if missing
    for col in [
        ('highlights', 'TEXT'),
        ('detail_image', 'TEXT'),
        ('full_title', 'TEXT')
    ]:
        try:
            cursor.execute(f'ALTER TABLE products ADD COLUMN {col[0]} {col[1]}')
        except Exception:
            pass

    # Create Categories table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            slug TEXT NOT NULL UNIQUE,
            icon TEXT
        )
    ''')

    # Create Orders table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            order_code TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_email TEXT,
            customer_address TEXT NOT NULL,
            payment_method TEXT DEFAULT 'COD',
            note TEXT,
            items TEXT NOT NULL, -- JSON
            total_amount INTEGER NOT NULL,
            status TEXT DEFAULT 'pending', -- pending, confirmed, shipping, completed
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Migration: Add user_id column if it doesn't exist
    try:
        cursor.execute('ALTER TABLE orders ADD COLUMN user_id INTEGER')
    except Exception:
        pass

    # Create Users table (for simple authentication)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullname TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'customer',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create Quotes table (Yêu cầu báo giá dự án B2B)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullname TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            project_type TEXT,
            note TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()

    # Check if we need to seed initial data
    cursor.execute('SELECT COUNT(*) FROM products')
    count = cursor.fetchone()[0]

    if count == 0:
        seed_data(conn)
    else:
        update_product_highlights(conn)

    # Automatically sync sold_count for any products with placed orders
    try:
        rows = cursor.execute("SELECT items FROM orders WHERE status != 'cancelled'").fetchall()
        item_counts = {}
        for r in rows:
            try:
                raw_items = r[0] if isinstance(r, (list, tuple)) else r['items']
                items = json.loads(raw_items) if isinstance(raw_items, str) else (raw_items or [])
                for item in items:
                    pid = item.get('id') or item.get('product_id')
                    qty = int(item.get('quantity') or 1)
                    if pid and qty > 0:
                        item_counts[pid] = item_counts.get(pid, 0) + qty
            except Exception:
                pass
        for pid, s_count in item_counts.items():
            cursor.execute('''
                UPDATE products 
                SET sold_count = CASE 
                    WHEN sold_count IS NULL OR sold_count < ? THEN ? 
                    ELSE sold_count 
                END 
                WHERE id = ?
            ''', (s_count, s_count, pid))
        conn.commit()
    except Exception:
        pass

    conn.close()

def update_product_highlights(conn):
    cursor = conn.cursor()
    
    # 1. Combo HOBRO (Faithful replication of the user's uploaded screenshot)
    hobro_highlights = json.dumps([
        {
            "title": "Hiệu ứng thị giác 3D độc quyền",
            "content": "Điểm nhấn nổi bật nhất nằm ở các mảng veneer gỗ tràm được thợ thủ công ghép đan chéo đối xứng tỉ mỉ trên thân giường, đầu giường và mặt tủ. Nghệ thuật hình học này mang đến hiệu ứng 3D ấn tượng, tạo ra sự chuyển biến màu sắc tinh tế và khác biệt từ mọi góc nhìn."
        },
        {
            "title": "Thẩm mỹ tối giản và chuyên nghiệp",
            "content": "Lấy cảm hứng từ những ngôi nhà Viking Bắc Âu, bộ combo HOBRO là sự giao thoa hoàn hảo giữa nét cổ điển Mid-Century Modern và phong cách hiện đại. Tone màu nâu trung tính, mộc mạc dễ dàng làm nền tảng cho một không gian phòng ngủ mang tính thẩm mỹ cao, tinh gọn và sang trọng."
        },
        {
            "title": "Kết cấu vững chãi chuẩn quốc tế",
            "content": "Khung gỗ tràm tự nhiên kết hợp gỗ cao su cao cấp đã qua quy trình tẩm sấy công nghệ cao chống co ngót, cong vênh và kháng mối mọt vĩnh viễn. Vạt phản gỗ nguyên tấm chịu lực lên đến 350kg."
        }
    ], ensure_ascii=False)

    cursor.execute('''
        UPDATE products 
        SET full_title = ?, highlights = ?, detail_image = ?
        WHERE collection = 'HOBRO' OR title LIKE '%HOBRO%'
    ''', (
        "Combo Giường Ngủ 1m6 Và Tủ Đầu Giường MOHO HOBRO",
        hobro_highlights,
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=1200&auto=format&fit=crop"
    ))

    # 2. VLINE products
    vline_highlights = json.dumps([
        {
            "title": "Giao thoa giữa truyền thống và đương đại",
            "content": "Bộ sưu tập VLINE lấy cảm hứng từ những đường nét truyền thống mộc mạc Việt Nam kết hợp chuẩn mực đương đại, tạo nên tổng thể thanh thoát, ấm cúng và gần gũi với mọi không gian gia đình."
        },
        {
            "title": "Chất liệu gỗ tự nhiên chuẩn xuất khẩu",
            "content": "Được chế tác từ 100% gỗ tràm tự nhiên tuyển chọn, bề mặt hoàn thiện sơn gốc nước thân thiện với môi trường, đạt chuẩn CARB-P2 an toàn tuyệt đối cho trẻ nhỏ và người lớn tuổi."
        },
        {
            "title": "Thiết kế thông minh, tối ưu diện tích",
            "content": "Khoảng sáng gầm giường cao 15cm thuận tiện cho việc vệ sinh và robot hút bụi di chuyển dễ dàng. Táp đầu giường có ngăn kéo trượt êm ái tích hợp ray giảm chấn cao cấp."
        }
    ], ensure_ascii=False)

    cursor.execute('''
        UPDATE products 
        SET full_title = title, highlights = ?, detail_image = ?
        WHERE (collection = 'VLINE' OR title LIKE '%VLINE%')
    ''', (
        vline_highlights,
        "https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?q=80&w=1200&auto=format&fit=crop"
    ))

    # 3. Default fallback highlights for any remaining products
    default_highlights = json.dumps([
        {
            "title": "Thiết kế tối giản phong cách Scandinavian",
            "content": "Kiểu dáng thanh lịch mang chuẩn mực Bắc Âu hiện đại, đường nét bo tròn an toàn, dễ dàng phối hợp hài hòa với mọi phong cách nội thất căn hộ và nhà phố."
        },
        {
            "title": "Gỗ tự nhiên bền bỉ theo thời gian",
            "content": "Sản xuất từ nguồn gỗ rừng trồng tự nhiên đạt chứng chỉ bảo vệ rừng, xử lý sấy khô đạt độ ẩm tiêu chuẩn 10-12% chống cong vênh và mối mọt trọn đời."
        },
        {
            "title": "Tiêu chuẩn an toàn CARB-P2 và EPA",
            "content": "Không chứa hóa chất độc hại, lớp sơn phủ gốc nước chống trầy xước và ố nước, bảo vệ tối đa sức khỏe cho cả gia đình bạn."
        }
    ], ensure_ascii=False)

    cursor.execute('''
        UPDATE products 
        SET full_title = title, highlights = ?, detail_image = image
        WHERE highlights IS NULL OR highlights = ''
    ''', (default_highlights,))

    conn.commit()

def seed_data(conn):
    cursor = conn.cursor()

    # Seed categories
    categories = [
        ("Phòng Khách", "phong-khach", "sofa"),
        ("Phòng Ngủ", "phong-ngu", "bed"),
        ("Phòng Ăn", "phong-an", "utensils"),
        ("Phòng Làm Việc", "phong-lam-viec", "briefcase"),
        ("Tủ & Kệ", "tu-ke", "archive"),
        ("Đồ Trang Trí", "do-trang-tri", "lamp")
    ]
    cursor.executemany(
        'INSERT OR IGNORE INTO categories (name, slug, icon) VALUES (?, ?, ?)',
        categories
    )

    # Initial products matching the screenshot and MOHO aesthetics
    products = [
        (
            "Combo Giường - Tủ Đầu Giường VLINE 1m6 | Màu Tự Nhiên",
            "Phòng Ngủ",
            "VLINE",
            8990000,
            12080000,
            26,
            5.0,
            18,
            27,
            "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?q=80&w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Màu Tự Nhiên", "hex": "#e3c299"}, {"name": "Màu Nâu", "hex": "#6f4e37"}]),
            1,
            1,
            "Combo bao gồm 01 Giường ngủ VLINE 1m6 và 01 Tủ đầu giường đồng bộ tinh tế. Thiết kế lấy cảm hứng từ nét đẹp truyền thống kết hợp chuẩn mực đương đại, mang lại sự mộc mạc và sang trọng.",
            "Gỗ tràm tự nhiên kết hợp veneer sồi, chuẩn xuất khẩu CARB P2",
            "Giường: D208 x R168 x C90 cm | Tủ: D45 x R40 x C50 cm"
        ),
        (
            "Combo Giường - Tủ Đầu Giường VLINE 1m6 | Màu Nâu",
            "Phòng Ngủ",
            "VLINE",
            8990000,
            12080000,
            26,
            4.9,
            22,
            24,
            "https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?q=80&w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Màu Nâu Hạt Dẻ", "hex": "#5c4033"}, {"name": "Màu Tự Nhiên", "hex": "#e3c299"}]),
            1,
            1,
            "Tông màu nâu trầm ấm cúng đem lại cảm giác bình yên và thư giãn cho không gian phòng ngủ của bạn. Gỗ tự nhiên đã qua tẩm sấy chống cong vênh, mối mọt.",
            "Gỗ cao su / gỗ tràm tự nhiên, hoàn thiện sơn phủ gốc nước an toàn",
            "Giường: D208 x R168 x C90 cm | Tủ: D45 x R40 x C50 cm"
        ),
        (
            "Combo Giường - Tủ Đầu Giường HOBRO 1m6",
            "Phòng Ngủ",
            "HOBRO",
            8990000,
            13180000,
            32,
            5.0,
            15,
            24,
            "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?q=80&w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Màu Nâu Walnut", "hex": "#4a3525"}, {"name": "Màu Gỗ Sồi", "hex": "#d4b996"}]),
            1,
            1,
            "Bộ giường và táp đầu giường HOBRO phong cách Bắc Âu tối giản, cạnh bo tròn an toàn tối đa cho gia đình có trẻ nhỏ. Độ bền kết cấu vững chãi.",
            "Khung gỗ cao su tự nhiên cao cấp, vạt giường phản tấm trợ lực",
            "Giường: D205 x R166 x C85 cm | Táp: D48 x R40 x C48 cm"
        ),
        (
            "Giường Ngủ Gỗ Tràm MOHO DALUMD 301 Ver 2 Màu Nâu Hạnh Nhân",
            "Phòng Ngủ",
            "DALUMD",
            8990000,
            9990000,
            10,
            5.0,
            34,
            241,
            "https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Màu Nâu Hạnh Nhân", "hex": "#6b4423"}, {"name": "Màu Gỗ Mộc", "hex": "#deb887"}]),
            1,
            1,
            "Sản phẩm best-seller với hơn 240+ khách hàng tin dùng. Đầu giường đệm êm ái, chân giường thanh thoát hỗ trợ robot hút bụi dễ dàng làm sạch gầm.",
            "Gỗ tràm tự nhiên 100%, nệm bọc vải nỉ cản bụi kháng khuẩn",
            "D210 x R165 x C95 cm"
        ),
        (
            "Sofa Băng Phòng Khách VLINE Bọc Vải Cao Cấp",
            "Phòng Khách",
            "VLINE",
            6490000,
            11190000,
            42,
            4.9,
            46,
            132,
            "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Xám Khói", "hex": "#9e9e9e"}, {"name": "Be Sữa", "hex": "#f5f0eb"}, {"name": "Xanh Rêu", "hex": "#355e3b"}]),
            1,
            1,
            "Sofa băng 3 chỗ ngồi êm ái tuyệt đỉnh với đệm mút D40 chống xẹp lún. Túi đựng tạp chí tiện lợi bên tay vịn cùng khung gỗ sồi chắc chắn.",
            "Khung gỗ dầu tự nhiên, nệm D40 bọc vải bố canvas cao cấp thoáng khí",
            "D200 x R82 x C80 cm"
        ),
        (
            "Sofa Giường Thông Minh Gấp Gọn Đa Năng MOHO",
            "Phòng Khách",
            "SMART",
            4890000,
            5620000,
            13,
            4.8,
            29,
            89,
            "https://images.unsplash.com/photo-1540574163026-643ea20ade25?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1540574163026-643ea20ade25?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Màu Kem Be", "hex": "#e7dece"}, {"name": "Xám Ghi", "hex": "#757575"}]),
            1,
            0,
            "Thiết kế 2 trong 1 vừa là sofa tiếp khách vừa là giường ngủ chỉ với 1 thao tác gập đơn giản. Giải pháp tối ưu diện tích cho căn hộ chung cư.",
            "Khung thép sơn tĩnh điện chống rỉ kết hợp gỗ thông và đệm mút êm ái",
            "D180 x R90 x C78 cm (Mở rộng thành giường 1m8 x 1m2)"
        ),
        (
            "Sofa 3 Chỗ Bọc Nỉ Sang Trọng MOHO MILAN",
            "Phòng Khách",
            "MILAN",
            7290000,
            8990000,
            19,
            4.9,
            38,
            64,
            "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Nâu Cà Phê", "hex": "#4e3629"}, {"name": "Xám Tiêu", "hex": "#616161"}]),
            1,
            0,
            "Kiểu dáng thanh lịch mang phong cách Ý, lưng tựa thiết kế công thái học nâng đỡ cột sống thoải mái khi ngồi đọc sách hay xem phim.",
            "Khung gỗ thông nhập khẩu Chile, vải nỉ nhung mềm mại cao cấp",
            "D210 x R85 x C82 cm"
        ),
        (
            "Sofa Góc Chữ L Phòng Khách Lớn MOHO VERONA",
            "Phòng Khách",
            "VERONA",
            10990000,
            14270000,
            23,
            5.0,
            52,
            115,
            "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Xám Trung Tính", "hex": "#8a8a8a"}, {"name": "Xanh Navy", "hex": "#1b2a47"}]),
            1,
            1,
            "Sofa góc L rộng rãi phù hợp gia đình từ 4-6 người. Góc L có thể linh hoạt đảo chiều trái hoặc phải tùy theo hướng nhà của bạn.",
            "Vải bọc công nghệ chống thấm nước Nano Water-Repellent",
            "D260 x R160 x C82 cm"
        ),
        (
            "Bàn Ăn Gỗ Tự Nhiên Kèm 4 Ghế VLINE",
            "Phòng Ăn",
            "VLINE",
            6990000,
            9990000,
            30,
            5.0,
            41,
            78,
            "https://images.unsplash.com/photo-1617806118233-18e1de247200?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1617806118233-18e1de247200?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Gỗ Tự Nhiên", "hex": "#e3c299"}, {"name": "Gỗ Nâu Óc Chó", "hex": "#503828"}]),
            1,
            1,
            "Bộ bàn ăn 4 ghế phong cách mộc mạc đương đại. Ghế ngồi được uốn cong nhẹ nâng đỡ lưng, đệm bọc da simili cao cấp dễ lau chùi sau bữa ăn.",
            "Gỗ cao su tự nhiên nguyên khối, phủ sơn UV chống trầy và chống ố nước",
            "Bàn: D140 x R80 x C75 cm | Ghế: D45 x R48 x C82 cm"
        ),
        (
            "Tủ Kệ Tivi Gỗ Phòng Khách VLINE",
            "Phòng Khách",
            "VLINE",
            3490000,
            4990000,
            30,
            4.9,
            19,
            56,
            "https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Màu Tự Nhiên", "hex": "#e3c299"}, {"name": "Màu Nâu", "hex": "#5c4033"}]),
            0,
            1,
            "Kệ tivi thiết kế thông minh với cánh mây đan mắt cáo trang nhã, hộc kéo trượt nhẹ nhàng và khoang đi dây điện gọn gàng giấu sau tủ.",
            "Gỗ tràm tự nhiên kết hợp mắt cáo mây đan tự nhiên",
            "D160 x R40 x C50 cm"
        ),
        (
            "Bàn Làm Việc Tối Giản MOHO WORK 01",
            "Phòng Làm Việc",
            "WORK",
            2290000,
            2990000,
            23,
            4.8,
            33,
            142,
            "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Gỗ Tự Nhiên Chân Đen", "hex": "#d2b48c"}, {"name": "Gỗ Trắng Tinh Tế", "hex": "#f0f0f0"}]),
            0,
            0,
            "Bàn làm việc tại nhà thanh lịch, mặt bàn rộng rãi có tích hợp khay kẹp dây nguồn và móc treo tai nghe tiện lợi.",
            "Gỗ MFC chống ẩm phủ Melamine cao cấp, chân sắt sơn tĩnh điện",
            "D120 x R60 x C75 cm"
        ),
        (
            "Tủ Quần Áo 3 Cánh MOHO VIENNA",
            "Phòng Ngủ",
            "VIENNA",
            7990000,
            10500000,
            24,
            4.9,
            27,
            48,
            "https://images.unsplash.com/photo-1558997519-83ea9252edf8?q=80&w=800&auto=format&fit=crop",
            json.dumps([
                "https://images.unsplash.com/photo-1558997519-83ea9252edf8?q=80&w=800&auto=format&fit=crop"
            ]),
            json.dumps([{"name": "Màu Sồi Trắng", "hex": "#e0d3be"}]),
            0,
            1,
            "Tủ quần áo 3 cánh chia ngăn khoa học: khoang treo váy dài, khoang gấp đồ và ngăn kéo có khóa bảo mật cá nhân.",
            "Gỗ công nghiệp MDF chống ẩm lõi xanh phủ Melamine vân sồi",
            "D140 x R58 x C200 cm"
        )
    ]

    cursor.executemany('''
        INSERT INTO products (
            title, category, collection, price, original_price, discount_percent,
            rating, review_count, sold_count, image, gallery, colors,
            is_bestseller, is_promo, description, material, dimensions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', products)

    # Seed default admin user (password: admin123)
    cursor.execute('''
        INSERT OR IGNORE INTO users (fullname, email, phone, password, role)
        VALUES ('Quản Trị Viên MOHO', 'admin@moho.vn', '0971141140', 'admin123', 'admin')
    ''')

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized and seeded successfully!")
