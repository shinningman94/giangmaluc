# Giáng Ma Sư: Hàng Ma Ký

- `vua-phap-su.html`: mã nguồn game (một file duy nhất).
- `build.py`: tạo bản web trong `web/` và chép vào app Android.
- `web/`: bản web cài được như ứng dụng (PWA), chạy offline.
- `android/`: app Android (WebView) chạy bản web toàn màn hình, cầm dọc (màn hình đứng).
- `.github/workflows/build.yml`: GitHub tự build file APK và đăng bản web lên GitHub Pages.

## Tạo file APK
Đưa cả thư mục này lên một repo GitHub (nhánh `main`). Vào tab Actions, mở lần chạy "Build APK and web" và tải `VuaPhapSu-apk`.
Muốn có link web, bật Settings → Pages → Source: GitHub Actions.

Hoặc mở thư mục `android/` bằng Android Studio sau khi chạy `python3 build.py`, rồi Build → Build APK.

## Bản online (nhiều người chơi)
- `online/onl.js` + `online/build_online.py`: tạo bản online từ `vua-phap-su.html` (chạy `python3 online/build_online.py <thư_mục_ra>`).
- Mọi người chung một bản đồ, thấy nhau, chat, thách đấu PvP.
- Bản artifact claude.ai chạy bằng kênh `room` của claude.ai, lấy tên từ tài khoản claude.ai, không cần đăng nhập riêng.
- Bản chạy bằng server riêng (`--server`, xem `server/README.md`) bắt đăng ký hoặc đăng nhập trước khi vào, và lưu tiến trình lên server theo tài khoản.
- App Android và bản web giữ chế độ một người; nút "Chơi online" ở màn hình đầu chỉ hiện khi đã đặt địa chỉ server (`online/server.txt` hoặc biến `ONLINE_SERVER`).
