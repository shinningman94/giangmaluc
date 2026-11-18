# Bản đặc tả: Độ Kiếp

Game né sét một màn, chủ đề tu tiên, nhân vật pixel chibi. Người đọc là coding agent không có ngữ cảnh nào khác.
Thư mục làm việc: `dokiep/` trong repo này. Không sửa `tutien/`, `vua-phap-su.html`, `server/`, `online/`.

## 1. Mục tiêu và giả thuyết
Chúng tôi tin rằng "kéo nhân vật né thiên kiếp, sống sót thì lột xác sang cảnh giới mới" đủ hấp dẫn để người chơi chơi lại nhiều lượt và quay lại ngày hôm sau. Bản này tồn tại để kiểm tra điều đó với chi phí khoảng 1 tuần, và để tập dượt khâu phát hành web + Android.
Ngưỡng số liệu (giữ chân ngày 1, số lượt mỗi phiên) chưa được tra; phải lấy số hiện hành trước khi phát hành (xem mục 12).

## 2. Không làm trong bản này
Tài khoản, server, nhiều người chơi, bảng xếp hạng online, cửa hàng, tiền tệ trong game, trang bị, kỹ năng, quái vật, bản đồ, cốt truyện, hướng dẫn nhiều bước, đa ngôn ngữ (chỉ tiếng Việt), SDK quảng cáo và SDK phân tích thật, thông báo đẩy, cài đặt ngoài nút tắt tiếng.

## 3. Vòng lặp chính (luật và con số)
Đơn vị là điểm ảnh gốc (px) trên khung 180×320, đứng dọc.

- **Sân:** hình chữ nhật x 10..170, y 70..300. Nhân vật không ra khỏi sân.
- **Nhân vật:** vùng trúng đòn là hình tròn bán kính 4 px đặt ở ngực. Tốc độ tối đa 150 px/giây. Bắt đầu giữa sân với 3 mạng.
- **Một kiếp** gồm 9 đợt, mỗi đợt 5 giây, tổng 45 giây. Trụ hết 45 giây là đột phá.
- **Cường độ** `I = (k-1)*9 + w`, với `k` là số thứ tự kiếp (1..) và `w` là đợt (1..9).
- **Bốn loại sét:**

| Loại | Mở từ I | Báo trước | Gây hại | Hình dạng |
|---|---|---|---|---|
| Sét cột | 1 | 0,7 giây | 0,25 giây | cột dọc rộng 14 px, cao hết sân, x ngẫu nhiên |
| Sét truy | 4 | 0,6 giây | 0,2 giây | hình tròn bán kính 14 px tại vị trí nhân vật lúc bắt đầu báo |
| Cầu lôi | 10 | không | khi chạm | tròn bán kính 5 px, bay thẳng 60 px/giây từ mép sân, nảy mép, sống 6 giây |
| Lôi quét | 19 | 1,0 giây | khi chạm | thanh ngang dày 6 px quét từ trên xuống 50 px/giây, có một khe hở rộng 36 px |

- **Nhịp sinh sét:** khoảng cách giữa hai lần sinh = `max(0,28, 1,1 − 0,018·I)` giây; mỗi lần chọn ngẫu nhiên một loại đã mở. Tối đa cùng lúc 3 cầu lôi và 1 lôi quét.
- **Trúng đòn:** mất 1 mạng, bất tử 1,0 giây (nhân vật nhấp nháy).
- **Linh khí:** mỗi 3 giây sinh một viên (bán kính nhặt 8 px, tồn tại 4 giây) ở vị trí ngẫu nhiên trong sân.
- **Điểm:** 10 điểm mỗi giây sống sót + 25 điểm mỗi viên linh khí + 500 điểm mỗi lần đột phá.
- **Thắng một kiếp:** dừng sét, diễn cảnh đột phá 2,5 giây, trang phục đổi sang cảnh giới kế, hồi 1 mạng (tối đa 3), rồi vào kiếp kế.
- **Cảnh giới:** bắt đầu Luyện Khí; kiếp 1→Trúc Cơ, 2→Kết Đan, 3→Nguyên Anh, 4→Hóa Thần. Từ kiếp 5 trở đi là "Phi Thăng kiếp" lặp vô hạn, giữ trang phục Hóa Thần, `I` tiếp tục tăng.
- **Thua:** hết mạng. Hiện thẻ kết quả: cảnh giới đạt được, tổng giây, điểm, kỷ lục; nút "Độ kiếp lại", nút "Chia sẻ" và nút "Hồi sinh" (một lần mỗi lượt, qua quảng cáo thưởng, hồi 1 mạng tại chỗ).
- **Thử thách mỗi ngày:** cùng luật, hạt giống ngẫu nhiên lấy từ ngày (`YYYYMMDD`) nên mọi người gặp cùng một chuỗi sét; kỷ lục lưu riêng.

## 4. Điều khiển và cảm giác
- Chạm và kéo ở bất kỳ đâu: nhân vật đi theo độ lệch của ngón tay (kéo tương đối, không nhảy tới ngón). Bàn phím: WASD hoặc phím mũi tên.
- Nhân vật dùng hoạt ảnh `walk` khi di chuyển, `idle` khi đứng, quay mặt theo hướng đi.
- Khoảnh khắc phải "đã" (clip tắt tiếng 3 giây dựa vào đây):
  - Sét đánh: lóe trắng toàn cột 1 khung hình, rung màn hình 3 px trong 0,15 giây, tia lửa bắn ở chân sét.
  - Né sát (sét sượt qua trong vòng 10 px): chữ "Né!" nhỏ bay lên.
  - Đột phá: cột sáng màu hào quang của cảnh giới mới, vòng sáng lan ra, trang phục đổi ngay giữa cột sáng, tên cảnh giới hiện to.
  - Trúng đòn: màn hình nháy đỏ, rung máy 60 ms (`navigator.vibrate` nếu có).
- Âm thanh tổng hợp bằng WebAudio (không dùng file): tiếng sét, tiếng nhặt linh khí, tiếng đột phá. Có nút tắt tiếng, lưu lựa chọn.

## 5. Dây chuyền nội dung (làm trước tiên, là công cụ riêng)
Tệp `dokiep/gen.js`, chạy được cả trong Node và trình duyệt, không phụ thuộc DOM.

- `generate(seed, k)` trả về danh sách sự kiện đã sắp theo thời gian cho kiếp `k`: `{t, type, x, y, vx, vy, gapX}`. Cùng `seed` và `k` luôn cho cùng kết quả (tự viết bộ sinh số ngẫu nhiên có hạt giống, không dùng `Math.random`).
- `simulate(events, bot)` chạy kiếp với bước 1/60 giây và trả về số lần trúng đòn.
- **Bộ kiểm chứng:** một bot né (mỗi bước xét 9 hướng đi, chọn hướng xa vùng nguy hiểm sắp tới nhất trong 0,8 giây) phải qua kiếp với 0 lần trúng. Kiếp nào bot không qua được thì sinh lại với hạt giống kế.
- **Chỉ số độ khó:** quãng đường trung bình mỗi giây bot phải đi để sống sót.
- **Xuất:** `node dokiep/gen.js --seeds 50 --kiep 8` in bảng: hạt giống, kiếp, hợp lệ hay không, độ khó.
- **Đạt khi:** 50 hạt giống × 8 kiếp đều hợp lệ, và độ khó trung bình tăng dần từ kiếp 1 đến kiếp 8.

## 6. Hệ thống, theo thứ tự làm
1. `gen.js`: sinh và kiểm chứng chuỗi sét (mục 5).
2. Vòng lặp game và va chạm: chạy sự kiện từ `gen.js`, mạng, bất tử, điểm.
3. Vẽ: sân, nhân vật, sét, báo trước, linh khí; khung 180×320 phóng to theo hệ số nguyên, `image-rendering: pixelated`.
4. Chuỗi kiếp và đột phá: đổi cảnh giới, hồi mạng, Phi Thăng kiếp.
5. Màn hình: bắt đầu (chọn nam/nữ, nút chơi, nút thử thách mỗi ngày), thẻ kết quả, hồi sinh.
6. Lưu máy (`localStorage`): kỷ lục, kỷ lục thử thách theo ngày, giới tính, tắt tiếng.
7. Hiệu ứng và âm thanh (mục 4).
8. Chia sẻ: vẽ thẻ kết quả ra ảnh PNG và gọi `navigator.share` nếu có, không thì tải ảnh xuống.
9. Giao diện quảng cáo và phân tích dạng giả (mục 7, 8).

## 7. Điểm gắn quảng cáo (bản giả)
Một tệp `ads.js` với hai hàm, bản này chỉ ghi log và gọi lại ngay:
- `Ads.showRewarded(placement, onReward)`: `placement = 'revive'` ở nút Hồi sinh.
- `Ads.showInterstitial(placement, onClose)`: `placement = 'run_end'`, gọi sau mỗi lượt thua thứ 3, trước khi hiện thẻ kết quả.
Không đưa SDK thật vào bản này.

## 8. Sự kiện phân tích (bản giả)
Một hàm `Track(name, params)` trong `track.js`, bản này ghi vào `console` và một mảng trong bộ nhớ:
`session_start`, `session_end`, `level_start {kiep, daily}`, `level_complete {kiep, time, hearts}`, `level_fail {kiep, wave, time, score}`, `booster_used {type:'revive'}`, `ad_rewarded_shown {placement}`, `ad_interstitial_shown {placement}`, `share_clicked`.

## 9. Ràng buộc kỹ thuật
- HTML + JavaScript thuần, không thư viện, không bước build, không tải gì từ mạng. Tệp: `dokiep/index.html`, `game.js`, `gen.js`, `ads.js`, `track.js`, `sprites.js`.
- Nhân vật: chép `tutien/sprites.js` vào `dokiep/sprites.js` và dùng nguyên. Giao diện: `Sprites.frame({g, realm, dir, anim, f})` trả về canvas 40×56; `g` 0 nam, 1 nữ; `realm` 1..5; `dir` 0 xuống, 1 lên, 2 trái, 3 phải; `anim` là `idle`, `walk`, `atk`, `sit`. `Sprites.REALMS[i]` có `name` và màu `aura`. Chân nhân vật ở hàng y = 52 của khung.
- Màn hình đứng dọc; trên màn hình ngang thì canh giữa với viền tối.
- Mục tiêu tự đặt: 60 khung hình/giây trên Android cấu hình thấp, tổng dung lượng dưới 300 KB, chạy offline, mở bằng `file://` cũng chơi được.
- Chữ giao diện bằng DOM tiếng Việt có dấu; không vẽ chữ có dấu trên canvas độ phân giải thấp.

## 10. Mốc và tiêu chí nghiệm thu
- **M0 công cụ nội dung:** lệnh ở mục 5 báo 400/400 kiếp hợp lệ, độ khó tăng dần theo kiếp.
- **M1 khung chơi được:** từ màn bắt đầu chơi được trọn một lượt đến thua hoặc đến đột phá; hình khối đơn giản cũng được.
- **M2 hiệu ứng + bản giả:** đủ mục 4, 7, 8; thử thách mỗi ngày cho cùng chuỗi sét ở hai lần mở; một đoạn quay 10 giây tắt tiếng nhìn vào hiểu ngay luật chơi.
- **M3 bản chạy:** chơi được trên Chrome Android ở kích thước 360×640 và trên máy tính; không lỗi trong console; tổng dung lượng dưới 300 KB.

## 11. Cách chứng minh
- `node --test dokiep/` cho `gen.js`: tính tất định theo hạt giống, bot qua kiếp với 0 lần trúng, độ khó tăng dần, một bot đứng yên phải thua.
- Kiểm thử trên trình duyệt (Playwright nếu có): vào game, đứng yên cho tới khi thua và thấy thẻ kết quả; chạy với cờ `?bot=1` (bot tự chơi) và thấy đột phá sang Trúc Cơ.
- Ảnh chụp ở 360×640: màn bắt đầu, đang chơi lúc sét đánh, khoảnh khắc đột phá, thẻ kết quả.
- Báo cáo dung lượng từng tệp.

## 12. Câu hỏi còn mở (kèm mặc định nếu không ai trả lời)
- Ngưỡng dừng / sửa / mở rộng: chưa có. Mặc định: tra số liệu giữ chân hiện hành cho game arcade nhẹ trước khi phát hành, chưa quyết gì từ bản này.
- Tên game: mặc định "Độ Kiếp".
- Đưa vào app Android nào: mặc định chỉ làm bản web, chưa đụng thư mục `android/`.
- Có nối với "Bế Quan" sau này không: mặc định giữ `gen.js` độc lập để dùng lại làm minigame đột phá.
