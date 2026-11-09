# Server Giáng Ma Sư Online

Server nhỏ chạy trên **Cloudflare Workers** (gói miễn phí đủ cho vài trăm người cùng online).
Một địa chỉ phục vụ cả trang game và kết nối chơi:

- `https://game.giangmaluc.workers.dev/` : vào chơi bằng trình duyệt
- `wss://game.giangmaluc.workers.dev/ws` : kết nối của game (app Android dùng địa chỉ này)
- `/top` : bảng xếp hạng PvP (JSON), `/` : số người đang online
- `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/save` : tài khoản và bản lưu theo tài khoản
- `/auth/google`, `/auth/config` : đăng nhập bằng tài khoản Google (bật khi Worker có biến `GOOGLE_CLIENT_ID`). Lần đầu người chơi chọn tên tài khoản hoặc liên kết với tài khoản cũ bằng mật khẩu; server kiểm chữ ký ID token bằng khóa công khai của Google.

## Tài khoản người chơi
Muốn vào chơi online thì phải đăng ký (tên đăng nhập 3-16 ký tự + mật khẩu từ 6 ký tự) hoặc đăng nhập.
Mật khẩu không lưu dạng chữ thường: server giữ muối ngẫu nhiên và băm PBKDF2-SHA256 100.000 vòng.
Đăng nhập xong máy giữ một phiên (token, hạn 120 ngày) và tiến trình chơi được gửi lên server mỗi 20 giây,
nên đổi máy hay cài lại app, đăng nhập vào là chơi tiếp. Một tài khoản chỉ chơi ở một nơi một lúc:
máy vào sau đẩy máy trước ra để hai máy không ghi đè bản lưu của nhau. Mất mật khẩu thì chưa lấy lại được.

## Bật server lần đầu (làm một lần)
1. Tạo tài khoản miễn phí ở https://dash.cloudflare.com/sign-up
2. Vào **Workers & Pages** một lần để Cloudflare tạo tên miền `<tên>.workers.dev` cho tài khoản.
3. Cách A (tự động bằng GitHub): vào **My Profile → API Tokens → Create Token**, chọn mẫu
   **Edit Cloudflare Workers**, tạo xong chép token. Lấy **Account ID** ở trang Workers & Pages (cột bên phải).
   Trong repo GitHub chứa thư mục game: **Settings → Secrets and variables → Actions → New repository secret**,
   thêm `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID`. Từ đó mỗi lần đẩy code lên nhánh `main`,
   workflow "Deploy online server" tự đưa server lên và in địa chỉ trong phần Summary.
3b. Cách nhanh nhất (Cloudflare tự lấy code từ GitHub): trong **Workers & Pages** tạo Worker tên `game`,
   vào **Settings → Builds → Connect** chọn repo này, để nguyên thư mục gốc `/` và lệnh deploy `npx wrangler deploy`.
   File `wrangler.toml` ở gốc repo tự tạo bản web online rồi đưa server lên mỗi lần đẩy code. Dùng cách này thì không cần 2 secret ở bước 3.
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
- `src/accounts.js`: tài khoản, phiên đăng nhập và bản lưu theo tài khoản
- `src/trade.js`: giao dịch giữa người chơi (Chợ, giao dịch trực tiếp, Hòm thư)
- `src/worker.js`: bản Cloudflare (một Durable Object "World" giữ cả thế giới)
- `src/node-server.js`: bản Node (tự host trên VPS nếu muốn)
- Phía game: `online/onl.js` (hàm `onlWsRoom`), tạo bản game bằng `online/build_online.py --server ...`

Lưu ý: server giữ tài khoản, bản lưu của từng tài khoản và bảng xếp hạng; phần còn lại chỉ là chuyển tiếp vị trí, chat và trận PvP.

## Người chơi máy (bot)

Server có sẵn 6 bot (`src/bots.js`): mỗi bot có tài khoản thật (mật khẩu ngẫu nhiên, không ai đăng nhập được), đi lại quanh Làng Hương Khói và các làng gần đó, chào người mới vào, trả lời khi được gọi tên và có tên trên bảng xếp hạng. Bot chỉ chạy khi có người chơi thật đang online.

- Thách đấu bot: bot nhận lời sau 1-3 giây (trừ khi đang đấu với người khác). Trận chạy trên máy người chơi bằng AI đấu trường; kết quả cộng/trừ điểm PvP của người chơi và của bot.
- Đổi tên, cấp, điểm của bot: sửa `BOT_DEFS` trong `src/bots.js`. Bot có `lvp` (Lâm Phong: 2) luôn cao hơn người chơi bấy nhiêu cấp; khi đấu, đội của bot cao hơn đồng hành mạnh nhất của người chơi bấy nhiêu cấp. Câu nói của bot: các mảng `IDLE`, `GREET`, `REPLY`.
- Đường đi của bot lấy từ bản đồ thật (`src/botpaths.js`). Khi bản đồ game đổi, chạy lại `node online/tools/botpaths.js` ở thư mục gốc (cần Python 3 và Playwright).
- Tắt bot: `new Hub({ ..., bots: false })` trong `worker.js` / `node-server.js`.

## Giao dịch giữa người chơi (`src/trade.js`)

Trong game: nút **GIAO DỊCH** riêng cạnh nút CHAT (dưới AUTO) mở khung Giao dịch, gồm 5 phần:

- **Chợ**: xem các món người khác treo bán (lọc Trang bị / Đồng hành, tìm theo tên), bấm giá hai lần để mua.
- **Bán**: chọn trang bị trong túi (đồ đang mặc không bán được) hoặc đồng hành trong đội / Tháp Trấn Hồn (trừ nhân vật chính), nhập giá bạc. Mỗi người treo tối đa 8 món, mỗi món treo 3 ngày; hết hạn thì đồ về Hòm thư. Người bán chịu 5% phí chợ.
- **Đang bán**: các món mình đang treo, bấm Gỡ để lấy lại (về Hòm thư).
- **Giao dịch**: giao dịch trực tiếp 1-1 khi cả hai cùng online (chạm tên người chơi trong chat → Giao dịch, hoặc nhập tên). Mỗi bên đưa tối đa 6 món + bạc, cả hai bấm Khóa rồi Xác nhận. Đổi đồ thì cả hai phải khóa lại. Một bên hủy hoặc thoát game thì đồ đã xác nhận được trả lại.
- **Hòm thư**: đồ mua được, đồ nhận khi giao dịch, đồ gỡ khỏi chợ và bạc bán được. Đồ tự vào túi (12 món) / đội (6) / tháp khi người chơi đang rảnh trên bản đồ và còn chỗ.

Cách giữ an toàn khi rớt mạng: đồ đem bán / đem đổi được bỏ khỏi bản lưu và ghi vào `G.esc` (ký gửi, có mã) trước khi gửi lên.
Server trả lời `xr` (giữ đồ / trả lại) và ghi kết quả vào kho (`xn:<tài khoản>`); máy nào chưa nhận được trả lời thì hỏi lại bằng `xchk` khi nối lại.
Thư đã nhận ghi trong `G.mailDone` để không nhận hai lần. Kho: `ml:<mã>` món đang bán, `mli` danh sách chợ, `mb:<tài khoản>` hòm thư.

Lưu ý: bản lưu vẫn do máy người chơi giữ (server chỉ lưu hộ), nên server không kiểm tra được người chơi có thật sự có món đồ / số bạc đó. Muốn chống gian lận hoàn toàn thì phải chuyển túi đồ và bạc sang server quản lý.
