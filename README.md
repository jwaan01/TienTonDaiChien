# Tiên Tôn Đại Chiến

Fan game đối kháng 2D kiểu *Bleach vs Naruto*, lấy cảm hứng từ tiểu thuyết **Cổ Chân Nhân** (Reverend Insanity).
11 tôn giả, 1P đấu máy hoặc 2P chung bàn phím, chạy ngay trên trình duyệt.

**Chơi:** https://jwaan01.github.io/TienTonDaiChien/ *(sau khi bật GitHub Pages, xem bên dưới)*

## Tôn giả

Phương Nguyên · Hồng Liên Ma Tôn · Nguyên Liên Tiên Tôn · Tinh Tú Tiên Tôn · Lạc Thổ Tiên Tôn · Cự Dương Tiên Tôn ·
Đạo Thiên Ma Tôn · U Hồn Ma Tôn (tuyệt chiêu **Hóa Hồn Thú** biến thành hồn thể 15 giây) · Cuồng Man Ma Tôn · Vô Cực Ma Tôn · Nguyên Thủy Tiên Tôn

## Điều khiển

| | 1P | 2P |
|---|---|---|
| Di chuyển | A · D | ← · → |
| Nhảy | W hoặc K | ↑ hoặc 2 |
| Đỡ đòn | giữ S | giữ ↓ |
| Đánh (bấm liên tiếp = combo 3 đòn) | J | 1 |
| Lướt | L | 3 |
| Chiêu đặc biệt (1 vạch khí) | U | 4 |
| Tuyệt chiêu (3 vạch khí, có cut-in) | I | 5 |
| Tạm dừng | Esc / P | |

Phím 1–5 dùng được ở hàng số hoặc bàn phím số. Thắng 2 hiệp để thắng trận. Chế độ 1P có 3 mức máy: Dễ / Thường / Khó (Q/E ở màn chọn).

## Bật GitHub Pages (một lần)

Settings → Pages → **Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, thư mục = `/docs` → Save.

## Cấu trúc

- `docs/` — game (HTML/CSS/JS thuần, không cần build): `js/engine.js` (chiến đấu, AI, HUD), `js/main.js` (menu), `js/data.js` (chỉ số, tên chiêu).
- `docs/assets/` — sprite đã tách nền và đóng gói (sinh bởi `tools/process_assets.py`).
- `raw/` — ảnh gốc tạo bằng ChatGPT (sprite sheet 7 hàng, cut-in, sàn đấu, hiệu ứng).
- `PROMPTS.md`, `BAO-CAO-KIEM-TRA.md`, `MANIFEST.csv` — prompt tạo ảnh và báo cáo kiểm tra ảnh.

Tạo lại tài nguyên sau khi thay ảnh trong `raw/`: `python3 tools/process_assets.py` (cần `numpy`, `Pillow`).
Thử máy đấu máy: mở `index.html?demo` hoặc `?demo=phuong-nguyen,hong-lien-ma-ton`.

## Ghi chú

Fan game phi thương mại. Nhân vật và tên chiêu thuộc tiểu thuyết *Cổ Chân Nhân* của Cổ Chân Nhân (蛊真人); hình ảnh nhân vật là thiết kế riêng tạo bằng AI.
