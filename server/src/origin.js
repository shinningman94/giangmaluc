// Chỉ cho trang game chính thức dùng server này. Một trang web sao chép đặt ở tên miền khác
// sẽ bị trình duyệt gắn Origin thật của nó (không giả được), nên các yêu cầu đăng nhập / lưu game /
// vào thế giới chung từ đó đều bị từ chối. App Android (WebView chạy file://) và trình chơi gốc
// không gửi Origin -> vẫn cho qua, vì đó không phải trang web nhái.
//
// Thêm tên miền của bạn bằng biến môi trường ALLOW_ORIGINS, ví dụ:
//   "https://mygame.vn,https://www.mygame.vn"

const BUILTIN = [
  'https://game.giangmaluc.workers.dev',
  'https://shinningman94.github.io',
];
const SUFFIX = ['.giangmaluc.workers.dev']; // bản xem trước của các nhánh trên Cloudflare

export function allowOrigin(origin, extra) {
  // không có Origin (app gốc, WebView file://, công cụ dòng lệnh) -> cho qua
  if (!origin || origin === 'null') return true;
  const o = String(origin).toLowerCase();
  const list = BUILTIN.concat(
    String(extra || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  );
  if (list.indexOf(o) >= 0) return true;
  try {
    const h = new URL(o).hostname;
    if (h === 'localhost' || h === '127.0.0.1') return true;
    for (const s of SUFFIX) if (h.length > s.length && h.slice(-s.length) === s) return true;
  } catch (_) {}
  return false;
}
