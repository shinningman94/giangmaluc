# Server Giáng Ma Sư Online

Server nhỏ chạy trên **Cloudflare Workers** (gói miễn phí đủ cho vài trăm người cùng online).
Một địa chỉ phục vụ cả trang game và kết nối chơi:

- `https://giang-ma-su-online.<tên-tài-khoản>.workers.dev/` : vào chơi bằng trình duyệt
- `wss://giang-ma-su-online.<tên-tài-khoản>.workers.dev/ws` : kết nối của game (app Android dùng địa chỉ này)
- `/top` : bảng xếp hạng PvP (JSON), `/status` : số người đang online

## Bật server lần đầu (làm một lần)
1. Tạo tài khoản miễn phí ở https://dash.cloudflare.com/sign-up
2. Vào **Workers & Pages** một lần để Cloudflare tạo tên miền `<tên>.workers.dev` cho tài khoản.
3. Cách A (tự động bằng GitHub): vào **My Profile → API Tokens → Create Token**, chọn mẫu
   **Edit Cloudflare Workers**, tạo xong chép token. Lấy **Account ID** ở trang Workers & Pages (cột bên phải).
   Trong repo GitHub chứa thư mục game: **Settings → Secrets and variables → Actions → New repository secret**,
   thêm `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID`. Từ đó mỗi lần đẩy code lên nhánh `main`,
   workflow "Deploy online server" tự đưa server lên và in địa chỉ trong phần Summary.
4. Cách B (trên máy tính có Node.js 20+): trong thư mục game chạy
   ```
   python3 online/build_online.py server/public --server same
   cp -r img server/public/
   cd server && npm install && npx wrangler login && npx wrangler deploy
   ```

## Chạy thử trên máy (không cần Cloudflare)
```
cd server && npm install && npx wrangler dev
```
rồi mở http://localhost:8787 (cần tạo `server/public` như bước 4). Hoặc chạy bằng Node thường:
`node src/node-server.js 8787` (chỉ có kết nối chơi, không phục vụ trang game).

## Cấu trúc
- `src/hub.js`: lõi server (sảnh, phòng đấu, chuyển tiếp trạng thái, giới hạn tốc độ, bảng xếp hạng)
- `src/worker.js`: bản Cloudflare (một Durable Object "World" giữ cả thế giới)
- `src/node-server.js`: bản Node (tự host trên VPS nếu muốn)
- Phía game: `online/onl.js` (hàm `onlWsRoom`), tạo bản game bằng `online/build_online.py --server ...`

Lưu ý: tiến trình chơi vẫn lưu trên máy người chơi; server chỉ chuyển vị trí, chat, trận PvP và giữ bảng xếp hạng.
