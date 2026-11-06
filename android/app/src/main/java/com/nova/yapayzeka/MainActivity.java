package com.nova.yapayzeka;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.view.WindowInsets;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    /** Uygulama ön plandayken alarmları arayüz çalar, bildirim gerekmez. */
    public static volatile boolean foreground = false;

    private static final int REQ_PERMS = 41;
    private static final int REQ_MIC = 42;

    private WebView web;
    private NovaBridge bridge;
    private PermissionRequest pendingMic;
    private boolean permsInFlight = false;
    /** Bildirimden açıldıysa çalınacak alarm / hatırlatma (arayüz alır). */
    volatile String pendingRing;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        AlarmScheduler.ensureChannels(this);

        web = new WebView(this);
        web.setBackgroundColor(0xFF030B14);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF030B14);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        // Android 15+ ekranı kenardan kenara çizer: durum çubuğu, gezinme çubuğu ve klavye kadar boşluk bırak
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((v, ins) -> {
                android.graphics.Insets i = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(i.left, i.top, i.right, i.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        // Android 13+ geri hareketi
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        bridge = new NovaBridge(this, web);
        web.addJavascriptInterface(bridge, "NovaAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return openExternalIfNeeded(req.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openExternalIfNeeded(Uri.parse(url));
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsMic = false;
                    for (String r : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsMic = true;
                    }
                    if (!wantsMic) { request.deny(); return; }
                    if (hasMic()) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        if (pendingMic != null) pendingMic.deny();
                        pendingMic = request;
                        if (!permsInFlight) { permsInFlight = true; requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC); }
                    }
                });
            }
        });

        pendingRing = getIntent().getStringExtra(AlarmScheduler.EXTRA_EVENT);
        requestStartupPermissions();
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String ev = intent.getStringExtra(AlarmScheduler.EXTRA_EVENT);
        if (ev != null) {
            pendingRing = null;
            web.evaluateJavascript("window.NovaAndroidEvents && NovaAndroidEvents.ring(" + org.json.JSONObject.quote(ev) + ")", null);
        }
    }

    String takeRing() { String r = pendingRing; pendingRing = null; return r; }

    private boolean openExternalIfNeeded(Uri uri) {
        String scheme = uri.getScheme();
        if ("file".equals(scheme) || "about".equals(scheme) || "blob".equals(scheme) || "data".equals(scheme)) return false;
        openUrl(uri.toString());
        return true;
    }

    void openUrl(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException ignored) { }
    }

    private boolean hasMic() {
        return checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestStartupPermissions() {
        List<String> need = new ArrayList<>();
        if (!hasMic()) need.add(Manifest.permission.RECORD_AUDIO);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            need.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!need.isEmpty()) { permsInFlight = true; requestPermissions(need.toArray(new String[0]), REQ_PERMS); }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        permsInFlight = false;
        if (pendingMic != null) {
            if (hasMic()) pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pendingMic.deny();
            pendingMic = null;
        }
        if (hasMic()) web.evaluateJavascript("window.NovaAndroidEvents && NovaAndroidEvents.micGranted()", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        foreground = true;
        web.onResume();
        AlarmScheduler.clearShownNotifications(this);
        web.evaluateJavascript("window.NovaAndroidEvents && NovaAndroidEvents.resume()", null);
    }

    @Override
    protected void onPause() {
        foreground = false;
        web.evaluateJavascript("window.NovaAndroidEvents && NovaAndroidEvents.pause()", null);
        web.onPause();
        super.onPause();
    }

    private void handleBack() {
        web.evaluateJavascript("(window.NovaBack ? NovaBack() : false)", value -> {
            if (!"true".equals(value)) moveTaskToBack(true);
        });
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() { handleBack(); }

    /** Android 12+ : "Alarmlar ve hatırlatıcılar" izni sayfasını aç. */
    void openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT < 31) return;
        try {
            startActivity(new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
        } catch (ActivityNotFoundException ignored) { }
    }

    @Override
    protected void onDestroy() {
        if (bridge != null) bridge.shutdown();
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
