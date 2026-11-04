# Giữ lại Activity (được gọi từ AndroidManifest) và các hàm @JavascriptInterface mà trang web gọi
# (pkg, setLandscape). R8 nếu xóa hoặc đổi tên sẽ làm khóa bản sao và nút xoay màn hình hỏng.
-keep class vn.vuaphapsu.game.MainActivity { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
