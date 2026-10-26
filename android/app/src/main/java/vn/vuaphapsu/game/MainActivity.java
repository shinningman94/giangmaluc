package vn.vuaphapsu.game;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.webkit.JavascriptInterface;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Chạy bản web của game (assets/index.html) toàn màn hình trong WebView. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = makeWeb();
        setContentView(web);
        hideSystemBars();
        web.loadUrl("file:///android_asset/index.html");
    }

    /** Tạo WebView; nếu tiến trình hiển thị bị hệ thống giết (thiếu RAM/GPU) thì dựng lại thay vì văng app. */
    private WebView makeWeb() {
        WebView web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // lưu game bằng localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true); // ảnh trong assets/img đọc được pixel (không làm bẩn canvas)
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
                if (v != MainActivity.this.web) return true;
                ViewGroup parent = (ViewGroup) v.getParent();
                if (parent != null) parent.removeView(v);
                v.destroy();
                MainActivity.this.web = makeWeb();
                setContentView(MainActivity.this.web);
                hideSystemBars();
                MainActivity.this.web.loadUrl("file:///android_asset/index.html");
                return true;
            }
        });
        web.setBackgroundColor(0xFF120D18);
        // v12.3: đấu trường gọi AndroidApp.setLandscape(true/false) để xoay ngang khi vào trận, xong trận về dọc
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void setLandscape(final boolean on) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        setRequestedOrientation(on ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                    }
                });
            }
        }, "AndroidApp");
        return web;
    }

    private void hideSystemBars() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** Nút Back của Android đóng vai nút B trong game. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.__vps && window.__vps.press('b')", null);
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.__vps && window.__vps.save && window.__vps.save()", null);
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    /** Hệ thống báo sắp thiếu RAM: lưu game trước để nếu app bị đóng vẫn giữ tiến độ. */
    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        web.evaluateJavascript("window.__vps && window.__vps.save && window.__vps.save()", null);
    }
}
