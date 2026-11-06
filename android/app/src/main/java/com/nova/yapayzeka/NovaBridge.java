package com.nova.yapayzeka;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.Locale;

/** Arayüzün (JavaScript) telefona eriştiği köprü: window.NovaAndroid */
public class NovaBridge {
    private final Activity act;
    private final WebView web;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private volatile String ttsLang = "";
    private String pendingId, pendingText;
    private double pendingRate = 1;

    NovaBridge(Activity act, WebView web) {
        this.act = act;
        this.web = web;
        initTts();
    }

    private void initTts() {
        tts = new TextToSpeech(act.getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS) { js("NovaAndroidEvents.ttsState(false,'')"); return; }
            int r = tts.setLanguage(new Locale("tr", "TR"));
            ttsLang = (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) ? "" : "tr-TR";
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { js("NovaAndroidEvents.ttsStart(" + JSONObject.quote(id) + ")"); }
                @Override public void onDone(String id) { js("NovaAndroidEvents.ttsDone(" + JSONObject.quote(id) + ")"); }
                @SuppressWarnings("deprecation")
                @Override public void onError(String id) { js("NovaAndroidEvents.ttsDone(" + JSONObject.quote(id) + ")"); }
                @Override public void onStop(String id, boolean interrupted) { js("NovaAndroidEvents.ttsDone(" + JSONObject.quote(id) + ")"); }
            });
            ttsReady = true;
            js("NovaAndroidEvents.ttsState(true," + JSONObject.quote(ttsLang) + ")");
            synchronized (this) {
                if (pendingId != null) { doSpeak(pendingId, pendingText, pendingRate); pendingId = null; pendingText = null; }
            }
        });
    }

    private void js(final String code) {
        act.runOnUiThread(() -> web.evaluateJavascript("window.NovaAndroidEvents && " + code, null));
    }

    private void doSpeak(String id, String text, double rate) {
        tts.setSpeechRate((float) rate);
        Bundle p = new Bundle();
        p.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
        int max = TextToSpeech.getMaxSpeechInputLength();
        if (text.length() > max) text = text.substring(0, max);
        int r = tts.speak(text, TextToSpeech.QUEUE_FLUSH, p, id);
        if (r != TextToSpeech.SUCCESS) js("NovaAndroidEvents.ttsDone(" + JSONObject.quote(id) + ")");
    }

    // ---------- Seslendirme ----------
    @JavascriptInterface
    public void speak(String id, String text, double rate) {
        if (text == null) text = "";
        if (!ttsReady) {
            synchronized (this) { pendingId = id; pendingText = text; pendingRate = rate; }
            return;
        }
        doSpeak(id, text, rate);
    }

    @JavascriptInterface
    public void stopSpeak() {
        synchronized (this) { pendingId = null; pendingText = null; }
        if (tts != null) tts.stop();
    }

    @JavascriptInterface
    public boolean isSpeaking() { return tts != null && ttsReady && tts.isSpeaking(); }

    @JavascriptInterface
    public String ttsLanguage() { return ttsLang; }

    // ---------- Alarm / hatırlatma ----------
    @JavascriptInterface
    public void schedule(String json) { AlarmScheduler.scheduleAll(act.getApplicationContext(), json); }

    @JavascriptInterface
    public String takeFired() { return AlarmScheduler.takeFired(act.getApplicationContext()); }

    @JavascriptInterface
    public String takeLaunchRing() { String r = ((MainActivity) act).takeRing(); return r == null ? "" : r; }

    @JavascriptInterface
    public boolean canExactAlarm() { return AlarmScheduler.canExact(act.getApplicationContext()); }

    // ---------- Genel ----------
    @JavascriptInterface
    public String version() {
        try {
            PackageInfo pi = act.getPackageManager().getPackageInfo(act.getPackageName(), 0);
            return pi.versionName;
        } catch (Exception e) { return "1.0.0"; }
    }

    @JavascriptInterface
    public void requestExactAlarm() { act.runOnUiThread(() -> ((MainActivity) act).openExactAlarmSettings()); }

    /** Google Play'den kurulduysa kendi kendine güncelleme kapalıdır (güncellemeleri Play yapar). */
    @JavascriptInterface
    public boolean fromPlayStore() {
        try {
            String src;
            if (android.os.Build.VERSION.SDK_INT >= 30) src = act.getPackageManager().getInstallSourceInfo(act.getPackageName()).getInstallingPackageName();
            else src = act.getPackageManager().getInstallerPackageName(act.getPackageName());
            return "com.android.vending".equals(src);
        } catch (Exception e) { return false; }
    }

    @JavascriptInterface
    public void openUrl(String url) { act.runOnUiThread(() -> ((MainActivity) act).openUrl(url)); }

    @JavascriptInterface
    public void minimize() { act.runOnUiThread(() -> act.moveTaskToBack(true)); }

    void shutdown() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
    }
}
