"""
AI Interior Advisor & Customer Consultation Engine for moccnha
Powered by Google Gemini AI with intelligent fallbacks.
Provides human-like, friendly, professional consultation grounded in
real-time store products, combo pricing, materials, shipping, warranty,
showroom addresses, and real-time order tracking.
"""

import os
import re
import json
import logging
import urllib.request
import db_adapter

logger = logging.getLogger('moho.chat_advisor')

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

GEMINI_API_KEY = (os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY') or '').strip()

def get_gemini_api_key():
    global GEMINI_API_KEY
    if not GEMINI_API_KEY:
        try:
            cfg = db_adapter.load_stored_config()
            GEMINI_API_KEY = (os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY') or cfg.get('gemini_api_key') or '').strip()
        except Exception:
            GEMINI_API_KEY = (os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY') or '').strip()
    return GEMINI_API_KEY

def configure_gemini(api_key):
    global GEMINI_API_KEY
    GEMINI_API_KEY = (api_key or '').strip()
    os.environ['GEMINI_API_KEY'] = GEMINI_API_KEY
    return bool(GEMINI_API_KEY)

def is_gemini_active():
    return bool(get_gemini_api_key())

def get_ai_info():
    key = get_gemini_api_key()
    has_key = bool(key)
    masked = key[:6] + '...' + key[-4:] if len(key) > 10 else '***'
    return {
        'enabled': has_key,
        'provider': 'Google Gemini AI',
        'model': 'gemini-2.5-flash / gemini-3.8-flash',
        'status': 'connected' if has_key else 'rule_fallback',
        'key_preview': masked if has_key else None,
        'description': 'Google Gemini AI đang hoạt động (Tư vấn viên thông minh)' if has_key else 'Đang dùng bộ tư vấn quy tắc mẫu (chưa cấu hình GEMINI_API_KEY)'
    }

def format_vnd(amount):
    try:
        return f"{int(amount):,}₫".replace(",", ".")
    except Exception:
        return f"{amount}₫"

def build_catalog_context():
    """Build a clean text summary of store products for Gemini grounding"""
    try:
        products = db_adapter.get_products()
        if not products:
            return "Hiện tại cửa hàng đang cập nhật thêm sản phẩm mới."
        lines = []
        for p in products:
            title = p.get('title', '')
            cat = p.get('category', '')
            price = format_vnd(p.get('price', 0))
            orig_price = format_vnd(p.get('original_price', 0))
            disc = p.get('discount_percent', 0)
            mat = p.get('material', 'Gỗ tự nhiên cao cấp')
            dim = p.get('dimensions', 'Tiêu chuẩn')
            sold = p.get('sold_count', 0)
            lines.append(f"- [{cat}] {title}: Giá bán {price} (Gốc {orig_price}, giảm {disc}%, đã bán {sold}). Chất liệu: {mat}. Kích thước: {dim}.")
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"Could not build catalog context: {e}")
        return ""

def test_gemini_key(api_key):
    """Test if a Gemini API key is valid and working"""
    key = (api_key or '').strip()
    if not key:
        return False, "API Key không được để trống"

    # Try test call via urllib
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": "Xin chào"}]}],
            "generationConfig": {"maxOutputTokens": 10}
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get('candidates'):
                return True, "API Key hợp lệ và hoạt động tốt!"
    except Exception as e:
        # Fallback test with google.genai SDK
        try:
            from google import genai
            client = genai.Client(api_key=key)
            res = client.models.generate_content(
                model='gemini-2.5-flash',
                contents='Xin chào',
            )
            if res and res.text:
                return True, "API Key hợp lệ và hoạt động tốt!"
        except Exception as e2:
            return False, f"Lỗi kiểm tra key: {str(e2 or e)}"

    return False, "Không nhận được phản hồi hợp lệ từ Gemini API"

def get_gemini_reply(message, session_id=None):
    """Generate reply using Google Gemini AI grounded in store data"""
    api_key = get_gemini_api_key()
    if not api_key:
        return None

    catalog_context = build_catalog_context()

    # Retrieve past conversation history
    past_convo = ""
    if session_id:
        try:
            history = db_adapter.get_chat_history(session_id)
            if history:
                recent = history[-6:]
                formatted = []
                for m in recent:
                    sender = "Khách hàng" if m.get('sender') == 'customer' else "Tư vấn viên moccnha"
                    formatted.append(f"{sender}: {m.get('message', '')}")
                past_convo = "\n".join(formatted)
        except Exception:
            pass

    system_prompt = f"""Bạn là Chuyên Viên Tư Vấn Nội Thất & Trợ Lý Bán Hàng thông minh của thương hiệu nội thất "moccnha" (phong cách Bắc Âu tối giản, tinh tế, hiện đại).

THÔNG TIN SẢN PHẨM HIỆN CÓ CỦA CỬA HÀNG:
{catalog_context}

CHÍNH SÁCH BÁN HÀNG & DỊCH VỤ CỦA MOCCNHA:
1. Giao hàng & Lắp đặt: MIỄN PHÍ 100% tận nhà và lắp ráp hoàn chỉnh tại nội thành TP.HCM và Hà Nội cho đơn hàng từ 2.000.000₫. Đơn dưới 2 triệu phí ship đồng giá 50.000₫. Thời gian giao nhanh 1-2 ngày.
2. Bảo hành & Bảo trì: Bảo hành chính hãng 24 tháng (2 năm) cho kết cấu và mối mọt gỗ; hỗ trợ bảo trì trọn đời. Đổi mới 1-đổi-1 trong 3 ngày nếu có lỗi từ nhà sản xuất.
3. Chất liệu & An toàn: 100% gỗ tự nhiên (tràm, cao su, sồi) đạt chuẩn xuất khẩu quốc tế CARB-P2 và EPA (hàm lượng Formaldehyde gần như bằng 0, an toàn cho trẻ nhỏ và phụ nữ có thai). Sơn gốc nước không mùi độc hại.
4. Hệ thống Showroom:
   - Showroom 1: Số 162 HT17, P. Hiệp Thành, Quận 12, TP.HCM
   - Showroom 2: S05.03-S2.05 Vinhome Grand Park, TP. Thủ Đức, TP.HCM
   - Showroom 3: 28 Trần Đăng Ninh, Dịch Vọng, Cầu Giấy, Hà Nội
   - Hotline: 097 114 1140 (tư vấn 24/7)
5. Phương thức thanh toán: Nhận hàng kiểm tra rồi thanh toán (COD) hoặc Chuyển khoản VietQR qua ngân hàng.

QUY TẮC TRẢ LỜI CỦA BẠN:
- Xưng hô lịch sự, lễ phép, ấm áp: xưng "em", gọi khách là "Quý khách" (hoặc "anh/chị").
- Trả lời bằng tiếng Việt tự nhiên, ngắt dòng rõ ràng, dùng bullet points ngắn gọn để khách đọc trên điện thoại không bị mỏi mắt.
- Luôn in đậm **Tên sản phẩm** và **Giá bán**.
- Khi khách hỏi tổng quát (ví dụ: "ở đây gồm những bàn ghế nào", "bên mình có những gì"), hãy điểm danh các sản phẩm tương ứng trong danh mục với mức giá ưu đãi và tính năng nổi bật, sau đó hỏi thăm nhu cầu không gian của khách.
- Chỉ tư vấn các sản phẩm có trong danh mục sản phẩm của moccnha ở trên. Không bịa ra các mặt hàng không có.
"""

    prompt_content = f"Lịch sử hội thoại trước đó:\n{past_convo}\n\nTin nhắn mới từ Khách hàng: {message}"

    # 1. Try with google-genai official SDK
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)

        for model_name in ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.8-flash']:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt_content,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.7,
                        max_output_tokens=850
                    )
                )
                if response and response.text:
                    return response.text.strip()
            except Exception:
                continue
    except Exception as sdk_err:
        logger.warning(f"google-genai SDK call error: {sdk_err}")

    # 2. Try with direct REST API (urllib.request)
    try:
        for model_name in ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt_content}]}],
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "generationConfig": {"temperature": 0.7, "maxOutputTokens": 850}
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    candidates = data.get('candidates', [])
                    if candidates:
                        parts = candidates[0].get('content', {}).get('parts', [])
                        if parts and 'text' in parts[0]:
                            return parts[0]['text'].strip()
            except Exception:
                continue
    except Exception as rest_err:
        logger.warning(f"Direct Gemini REST API error: {rest_err}")

    return None

def get_rule_based_reply(message, session_id=None):
    """Fallback rule-based engine with extensive furniture domain responses"""
    text = (message or '').strip()
    lower = text.lower()

    if not lower:
        return "Dạ moccnha xin chào Quý khách! Bạn cần tư vấn mẫu nội thất nào hay hỗ trợ thông tin gì ạ?"

    # Order inquiry without code
    if any(k in lower for k in ['tra cứu đơn', 'kiểm tra đơn', 'tình trạng đơn', 'mã đơn', 'đơn hàng của tôi', 'đơn đã đặt']):
        return (
            "Dạ để kiểm tra tiến độ đơn hàng, Quý khách vui lòng gửi giúp em **Mã đơn hàng** (dạng `MOC-xxxxx`) "
            "hoặc **Số điện thoại** lúc đặt hàng, em sẽ kiểm tra trạng thái và báo ngay ạ!"
        )

    # Tables & Chairs (Bàn ghế ăn, bàn làm việc, ghế sofa...) - Direct answer for "ở đây gồm những bàn ghế nào"
    if any(k in lower for k in ['bàn ghế', 'những bàn ghế nào', 'có bàn ghế', 'bàn ăn', 'ghế ăn', 'bàn làm việc', 'bàn học', 'ghế gỗ', 'bàn trà', 'bàn cafe']):
        try:
            prods = db_adapter.get_products()
            tables_and_chairs = [p for p in prods if any(w in p.get('title', '').lower() for w in ['bàn', 'ghế', 'sofa', 'chair', 'table'])]
            if tables_and_chairs:
                items_text = []
                for p in tables_and_chairs:
                    price = format_vnd(p.get('price', 0))
                    orig = format_vnd(p.get('original_price', 0))
                    items_text.append(f"• **{p.get('title')}**: **{price}** (Giá gốc: {orig}) - {p.get('material', 'Gỗ tự nhiên chuẩn xuất khẩu')}")
                catalog_list = "\n".join(items_text)
                return (
                    f"Dạ moccnha có đầy đủ các mẫu **Bàn & Ghế** cao cấp phục vụ phòng ăn, phòng làm việc và phòng khách:\n\n"
                    f"{catalog_list}\n\n"
                    "Quý khách đang tìm mẫu bàn ghế cho phòng ăn gia đình, bàn làm việc hay sofa phòng khách ạ? Em sẽ tư vấn kích thước và mức ưu đãi tốt nhất cho mình nhé!"
                )
        except Exception:
            pass

        return (
            "Dạ hiện tại moccnha có các dòng **Bàn & Ghế** tiêu biểu:\n\n"
            "• **Bộ Bàn Ăn Gỗ Tự Nhiên Kèm 4 Ghế VLINE**: Gỗ cao su nguyên khối chống trầy xước, đệm ghế bọc da êm ái, giá ưu đãi **6.990.000₫** (giá gốc 9.990.000₫).\n"
            "• **Bàn Làm Việc Tối Giản MOHO WORK 01**: Mặt bàn rộng 1m2 phủ Melamine vân sồi, chân sắt tĩnh điện, giá chỉ **2.290.000₫**.\n"
            "• **Sofa Băng & Sofa Giường VLINE**: Đệm mút D40 chống xẹp lún, vải bố dệt cao cấp, giá từ **4.290.000₫ - 5.990.000₫**.\n\n"
            "Quý khách đang quan tâm bàn ghế cho không gian phòng ăn, phòng làm việc hay phòng khách ạ?"
        )

    # General catalog inquiry ("có những gì", "bán gì", "danh sách sản phẩm")
    if any(k in lower for k in ['có những gì', 'bán gì', 'gồm những gì', 'sản phẩm nào', 'danh mục', 'menu sản phẩm']):
        return (
            "Dạ moccnha chuyên cung cấp nội thất gỗ xuất khẩu cao cấp chuẩn quốc tế:\n\n"
            "🪑 **Phòng Ăn & Bếp**: Bộ bàn ăn 4 ghế, 6 ghế VLINE, ghế ăn gỗ tự nhiên bọc đệm.\n"
            "🛋️ **Phòng Khách**: Sofa băng, sofa giường thông minh, sofa góc L MOHO VERONA, tủ kệ tivi cánh đan mây.\n"
            "🛏️ **Phòng Ngủ**: Combo giường ngủ & táp đầu giường HOBRO 1m6 vân xương cá, giường VLINE, tủ quần áo 3 cánh.\n"
            "💻 **Phòng Làm Việc**: Bàn làm việc MOHO WORK, ghế làm việc công thái học.\n\n"
            "Quý khách đang muốn bài trí cho phòng nào trước ạ?"
        )

    # Bedroom Combos (HOBRO, VLINE)
    if any(k in lower for k in ['hobro', 'combo hobro', 'giường hobro']):
        return (
            "Dạ **Combo Giường Ngủ 1m6 & Tủ Đầu Giường MOHO HOBRO** hiện đang là dòng sản phẩm cao cấp bán chạy nhất:\n\n"
            "• **Điểm nhấn độc quyền**: Mặt gỗ tràm ghép vân veneer xương cá đan chéo hiệu ứng thị giác 3D tinh xảo.\n"
            "• **Kết cấu chịu lực**: Khung gỗ tự nhiên vững chãi chuẩn quốc tế, vạt phản gỗ nguyên tấm chịu lực lên đến 350kg.\n"
            "• **Giá ưu đãi**: **8.990.000₫** (Giá gốc niêm yết: 13.180.000₫, tiết kiệm 32%).\n\n"
            "Sản phẩm có sẵn tone Màu Nâu Hạnh Nhân và Màu Gỗ Sồi. Quý khách muốn đặt combo này giao trong tuần này không ạ?"
        )

    if any(k in lower for k in ['vline', 'combo vline', 'giường vline']):
        return (
            "Dạ **Bộ sưu tập VLINE** mang đậm phong cách truyền thống giao thoa đương đại:\n\n"
            "• **Combo Giường & Táp VLINE 1m6**: 100% gỗ tràm tự nhiên đạt chuẩn CARB-P2 an toàn tuyệt đối, giá ưu đãi **8.990.000₫** (giảm 26%).\n"
            "• **Tủ Kệ Tivi VLINE**: Cánh đan mây mắt cáo tự nhiên tinh tế, giá chỉ **3.490.000₫**.\n"
            "• **Bàn Ăn 4 Ghế VLINE**: Gỗ cao su nguyên khối chống trầy xước, giá chỉ **6.990.000₫**.\n\n"
            "Quý khách đang quan tâm mẫu giường ngủ, bàn ăn hay tủ kệ VLINE ạ?"
        )

    # Sofas & Living Room
    if any(k in lower for k in ['sofa', 'ghế sofa', 'phòng khách', 'sofa góc', 'sofa băng', 'sofa giường']):
        return (
            "Dạ moccnha có đầy đủ các dòng Sofa phù hợp cho căn hộ và nhà phố:\n\n"
            "• **Sofa Băng VLINE**: Đệm mút D40 chống xẹp lún, bọc vải bố dệt cao cấp, giá **5.990.000₫**.\n"
            "• **Sofa Giường Đa Năng Thông Minh**: Dễ dàng ngả thành giường ngủ êm ái cho khách tới nhà, giá **4.290.000₫**.\n"
            "• **Sofa Góc L Lớn MOHO VERONA**: Vải công nghệ chống thấm nước Nano Water-Repellent, giá **12.754.000₫**.\n\n"
            "Quý khách muốn tìm sofa kích thước khoảng bao nhiêu mét cho phòng khách nhà mình ạ?"
        )

    # Wardrobes & Cabinets
    if any(k in lower for k in ['tủ quần áo', 'tủ áo', 'tủ giày', 'tủ kệ', 'tủ gỗ ikea']):
        return (
            "Dạ các mẫu tủ quần áo & tủ kệ tại moccnha đều được thiết kế chia khoang thông minh:\n\n"
            "• **Tủ Quần Áo 3 Cánh MOHO VIENNA**: Có khoang treo đầm dài, ngăn gấp đồ và hộc kéo có khóa cá nhân, giá **7.990.000₫** (giảm 24%).\n"
            "• **Tủ Gỗ IKEA / Tủ Đa Năng**: Giá hạt dẻ từ **500.000₫ - 5.760.000₫**.\n"
            "• Phụ kiện ray trượt và bản lề giảm chấn đóng êm ái, không gây tiếng ồn.\n\n"
            "Phòng ngủ của bạn có chiều ngang tầm bao nhiêu mét để em tư vấn kích thước vừa vặn nhất ạ?"
        )

    # Shipping & Assembly
    if any(k in lower for k in ['giao hàng', 'vận chuyển', 'lắp đặt', 'phí ship', 'ship', 'bao lâu', 'lắp ráp']):
        return (
            "Dạ chính sách giao nhận & lắp đặt của moccnha:\n\n"
            "🚚 **Miễn phí 100% Giao hàng & Lắp đặt tận phòng** tại nội thành TP.HCM và Hà Nội đối với mọi đơn hàng từ 2.000.000₫!\n"
            "📦 Đơn dưới 2 triệu phí vận chuyển đồng giá chỉ **50.000₫**.\n"
            "⏰ Thời gian giao: 1 - 2 ngày làm việc. Nhân viên kỹ thuật moccnha sẽ mang hàng tận phòng, lắp ráp hoàn chỉnh và dọn dẹp sạch sẽ trước khi bàn giao ạ!"
        )

    # Warranty & Lifetime Maintenance
    if any(k in lower for k in ['bảo hành', 'bảo trì', 'đổi trả', 'bị hỏng', 'mối mọt', 'cong vênh']):
        return (
            "Dạ Quý khách hoàn toàn an tâm khi mua sắm tại moccnha:\n\n"
            "🛡️ **Bảo hành chính hãng 24 tháng (2 năm)** cho tất cả lỗi kết cấu, kỹ thuật và mối mọt gỗ.\n"
            "🔧 **Hỗ trợ bảo trì trọn đời** sản phẩm (sửa chữa, thay thế phụ kiện bản lề/ray trượt với chi phí gốc).\n"
            "🔄 **Đổi mới 1-1 trong 3 ngày** nếu có lỗi từ nhà sản xuất.\n\n"
            "Mỗi đơn hàng đều có mã phiếu bảo hành điện tử theo số điện thoại đặt hàng của Quý khách ạ!"
        )

    # Showrooms & Visiting
    if any(k in lower for k in ['địa chỉ', 'showroom', 'cửa hàng', 'ở đâu', 'xem mẫu', 'trải nghiệm', 'qua xem']):
        return (
            "Dạ kính mời Quý khách ghé trải nghiệm trực tiếp tại hệ thống Showroom moccnha:\n\n"
            "📍 **Showroom 1**: Số 162 HT17, P. Hiệp Thành, Quận 12, TP.HCM\n"
            "📍 **Showroom 2**: S05.03-S2.05 Vinhome Grand Park, TP. Thủ Đức, TP.HCM\n"
            "📍 **Showroom 3**: 28 Trần Đăng Ninh, Dịch Vọng, Cầu Giấy, Hà Nội\n"
            "⏰ **Giờ mở cửa**: 08:30 - 21:00 (Mở cửa tất cả các ngày trong tuần, có bãi đỗ xe ô tô miễn phí).\n"
            "📞 Hotline hỗ trợ: **097 114 1140**.\n\n"
            "Bạn có dự định ghé showroom nào để em báo bạn chuyên viên chuẩn bị tiếp đón chu đáo ạ?"
        )

    # Materials & Safety (CARB-P2)
    if any(k in lower for k in ['chất liệu', 'gỗ gì', 'loại gỗ', 'an toàn', 'carb', 'sơn']):
        return (
            "Dạ nội thất moccnha cam kết tiêu chuẩn xuất khẩu an toàn sức khỏe hàng đầu:\n\n"
            "🌿 **Nguồn gốc gỗ**: 100% gỗ rừng trồng tự nhiên (gỗ tràm, gỗ cao su, veneer sồi) đạt chứng nhận FSC bảo vệ môi trường.\n"
            "🔬 **Chuẩn CARB-P2 & EPA**: Hàm lượng Formaldehyde gần như bằng 0, tuyệt đối an toàn cho trẻ sơ sinh, trẻ nhỏ và phụ nữ mang thai.\n"
            "💧 **Sơn gốc nước cao cấp**: Không mùi cay hắc, chống trầy xước và kháng ẩm mốc bền bỉ theo thời gian ạ!"
        )

    # B2B / Wholesale / Contract
    if any(k in lower for k in ['b2b', 'dự án', 'sỉ', 'số lượng lớn', 'chiết khấu', 'khách sạn', 'homestay', 'báo giá']):
        return (
            "Dạ moccnha có chính sách cung ứng nội thất dự án B2B cực kỳ ưu đãi:\n\n"
            "🏢 Chiết khấu lên đến **35%** cho các dự án căn hộ cho thuê, homestay, khách sạn, resort và văn phòng.\n"
            "📐 Hỗ trợ dựng phối cảnh 3D và bóc tách khối lượng miễn phí.\n\n"
            "Quý khách vui lòng để lại **Số điện thoại** hoặc gửi yêu cầu tại mục Dự Án B2B trên thanh menu, quản lý dự án moccnha sẽ gửi bảng chào giá chi tiết trong vòng 2 giờ ạ!"
        )

    # Promotions & Discounts
    if any(k in lower for k in ['khuyến mãi', 'ưu đãi', 'giảm giá', 'sale', 'mã giảm', 'voucher']):
        return (
            "Dạ hiện moccnha đang có chương trình khuyến mãi tháng này:\n\n"
            "🎁 Giảm trực tiếp từ **20% - 35%** cho tất cả bộ sưu tập nội thất chủ lực.\n"
            "🚚 Miễn phí vận chuyển & lắp ráp nội thành TP.HCM & Hà Nội (đơn từ 2tr).\n"
            "💵 Hỗ trợ thanh toán linh hoạt: Tiền mặt khi nhận hàng (COD) hoặc Chuyển khoản ngân hàng.\n\n"
            "Bạn muốn tìm sản phẩm nào để em áp dụng mức giá sale tốt nhất cho mình ạ?"
        )

    # Dynamic Product Search by Name
    try:
        all_prods = db_adapter.get_products()
        for p in all_prods:
            title_lower = p.get('title', '').lower()
            p_words = [w for w in title_lower.split() if len(w) > 3]
            match_count = sum(1 for w in p_words if w in lower)
            if match_count >= 2 or (len(p_words) == 1 and p_words[0] in lower):
                price = format_vnd(p.get('price', 0))
                orig_price = format_vnd(p.get('original_price', 0))
                disc = p.get('discount_percent', 0)
                mat = p.get('material', 'Gỗ tự nhiên cao cấp')
                dim = p.get('dimensions', 'Tiêu chuẩn')
                return (
                    f"Dạ về sản phẩm **{p.get('title')}**:\n\n"
                    f"• **Giá bán ưu đãi**: **{price}** (Giá gốc: {orig_price}, giảm {disc}%)\n"
                    f"• **Chất liệu**: {mat}\n"
                    f"• **Kích thước**: {dim}\n"
                    f"• **Bảo hành**: 2 năm & Bảo trì trọn đời\n\n"
                    "Quý khách có muốn em hỗ trợ đặt hàng giữ giá khuyến mãi cho mình luôn không ạ?"
                )
    except Exception:
        pass

    # Friendly General Greeting
    if any(k in lower for k in ['chào', 'hello', 'hi', 'alo', 'shop ơi', 'ad ơi', 'tư vấn', 'có ai không']):
        return (
            "Dạ moccnha xin chào Quý khách! Rất vui được đón tiếp bạn ghé thăm cửa hàng trực tuyến moccnha.\n\n"
            "Em có thể hỗ trợ tư vấn cho bạn về:\n"
            "• Combo giường tủ phòng ngủ (VLINE, HOBRO...)\n"
            "• Bàn ghế ăn, Sofa phòng khách, Bàn làm việc\n"
            "• Chính sách giao hàng, lắp đặt miễn phí & bảo hành\n"
            "• Tra cứu tình trạng đơn hàng đã đặt\n\n"
            "Bạn đang tìm nội thất cho không gian nào ạ?"
        )

    # Fallback
    return (
        "Dạ cảm ơn Quý khách đã nhắn tin cho moccnha! Để nhận tư vấn chi tiết nhất hoặc xem hình ảnh thực tế sản phẩm, "
        "Quý khách có thể để lại **Số điện thoại** hoặc câu hỏi cụ thể, chuyên viên tư vấn moccnha sẽ hỗ trợ bạn ngay trong ít phút ạ!\n\n"
        "💡 *Gợi ý nhanh: Bạn có thể gõ 'HOBRO', 'VLINE', 'Sofa', 'Bàn ghế', 'Giao hàng', 'Bảo hành' hoặc nhập mã đơn 'MOC-xxxxx' để em kiểm tra ngay nhé!*"
    )

def generate_advisor_reply(message, session_id=None):
    """Main consultation router: checks instant order tracking, then Gemini AI, then rule engine"""
    text = (message or '').strip()

    # 1. Instant order tracking detection (MOC-12345 or MOHO-12345)
    order_code_match = re.search(r'\b(MOC|MOHO)-?\d{4,6}\b', text, re.IGNORECASE)
    if order_code_match:
        raw_code = order_code_match.group(0).upper()
        norm_code = raw_code if '-' in raw_code else f"{raw_code[:3]}-{raw_code[3:]}"
        try:
            orders = db_adapter.get_orders()
            matched_order = next((o for o in orders if norm_code in o.get('order_code', '').upper()), None)
            if matched_order:
                status_map = {
                    'pending': '⏳ Đang chờ xác nhận',
                    'confirmed': '✅ Đã xác nhận - Đang đóng gói xuất kho',
                    'shipping': '🚚 Đang trên đường vận chuyển tới bạn',
                    'completed': '🎉 Đã hoàn thành (Giao thành công)',
                    'cancelled': '❌ Đã hủy đơn'
                }
                status_text = status_map.get(matched_order.get('status'), matched_order.get('status'))
                cust_name = matched_order.get('customer_name') or 'Quý khách'
                total = format_vnd(matched_order.get('total_amount', 0))
                address = matched_order.get('customer_address') or 'Theo thông tin đơn'
                payment = 'Tiền mặt khi nhận (COD)' if matched_order.get('payment_method') == 'COD' else 'Chuyển khoản'

                return (
                    f"Dạ moccnha đã tìm thấy đơn hàng **#{matched_order.get('order_code')}**:\n\n"
                    f"• Khách hàng: **{cust_name}**\n"
                    f"• Trạng thái: **{status_text}**\n"
                    f"• Tổng thanh toán: **{total}** ({payment})\n"
                    f"• Nơi nhận: {address}\n\n"
                    "Bộ phận giao hàng & lắp đặt moccnha sẽ chủ động liên hệ trước 30-45 phút khi hàng đến nơi. Nếu cần hỗ trợ đổi giờ giao, Quý khách nhắn em nhé!"
                )
            else:
                return (
                    f"Dạ moccnha chưa tìm thấy đơn hàng mã **#{norm_code}** trên hệ thống. "
                    "Quý khách vui lòng kiểm tra lại chính xác 5 chữ số mã đơn hoặc nhắn Số điện thoại đặt hàng để em tra cứu nhanh nhất ạ!"
                )
        except Exception:
            pass

    # 2. Try Gemini AI
    if is_gemini_active():
        try:
            ai_reply = get_gemini_reply(message, session_id)
            if ai_reply and len(ai_reply.strip()) > 10:
                return ai_reply.strip()
        except Exception as e:
            logger.warning(f"Failed to generate Gemini response: {e}")

    # 3. Fallback to expert rule-based engine
    return get_rule_based_reply(message, session_id)
