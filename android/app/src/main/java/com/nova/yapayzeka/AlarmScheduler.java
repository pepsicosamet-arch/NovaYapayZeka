package com.nova.yapayzeka;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

/**
 * Alarm, hatırlatma ve zamanlayıcıları Android'in AlarmManager'ına kurar.
 * Böylece uygulama kapalıyken ya da telefon kilitliyken de zamanında çalarlar.
 */
public final class AlarmScheduler {
    static final String PREFS = "nova_alarms";
    static final String CH_ALARM = "nova_alarm_v1";
    static final String CH_REMINDER = "nova_reminder_v1";
    static final String EXTRA_ID = "nova_id";
    static final String EXTRA_EVENT = "nova_event";
    static final String ACTION_FIRE = "com.nova.yapayzeka.FIRE";
    static final String ACTION_DISMISS = "com.nova.yapayzeka.DISMISS";
    static final String ACTION_SNOOZE = "com.nova.yapayzeka.SNOOZE";

    private AlarmScheduler() { }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel alarm = new NotificationChannel(CH_ALARM, "Alarmlar", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("NOVA alarmları ve zamanlayıcıları");
        Uri al = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (al == null) al = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        alarm.setSound(al, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        alarm.enableVibration(true);
        alarm.setVibrationPattern(new long[]{0, 600, 400, 600, 400, 600});
        alarm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        alarm.setBypassDnd(true);
        nm.createNotificationChannel(alarm);
        NotificationChannel rem = new NotificationChannel(CH_REMINDER, "Hatırlatmalar", NotificationManager.IMPORTANCE_HIGH);
        rem.setDescription("NOVA hatırlatmaları ve geri sayımları");
        rem.enableVibration(true);
        rem.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(rem);
    }

    static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = c.getSystemService(AlarmManager.class);
        return am != null && am.canScheduleExactAlarms();
    }

    private static int code(String id) { return id.hashCode(); }

    private static PendingIntent fireIntent(Context c, String id, String eventJson) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACTION_FIRE).putExtra(EXTRA_ID, id);
        if (eventJson != null) i.putExtra(EXTRA_EVENT, eventJson);
        return PendingIntent.getBroadcast(c, code(id), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent openAppIntent(Context c, String id, String eventJson) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (eventJson != null) i.putExtra(EXTRA_EVENT, eventJson);
        return PendingIntent.getActivity(c, code(id) ^ 0x5a5a, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void setAt(Context c, long at, String id, JSONObject ev) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        String json = ev.toString();
        PendingIntent pi = fireIntent(c, id, json);
        boolean isAlarm = "alarm".equals(ev.optString("kind")) || "timer".equals(ev.optString("kind"));
        try {
            if (isAlarm && canExact(c)) {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, openAppIntent(c, id, null)), pi);
            } else if (canExact(c)) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    static void cancel(Context c, String id) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACTION_FIRE).putExtra(EXTRA_ID, id);
        PendingIntent pi = PendingIntent.getBroadcast(c, code(id), i, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (pi != null) { am.cancel(pi); pi.cancel(); }
    }

    /** Arayüzden gelen tüm olay listesini kurar; listede olmayan eskileri iptal eder. */
    static synchronized void scheduleAll(Context c, String json) {
        try {
            JSONArray list = new JSONArray(json == null ? "[]" : json);
            SharedPreferences p = prefs(c);
            Set<String> old = new HashSet<>(p.getStringSet("ids", new HashSet<>()));
            Set<String> now = new HashSet<>();
            long t = System.currentTimeMillis();
            for (int k = 0; k < list.length() && k < 64; k++) {
                JSONObject ev = list.getJSONObject(k);
                String id = ev.getString("id");
                long at = ev.getLong("at");
                if (at <= t) continue;
                setAt(c, at, id, ev);
                now.add(id);
            }
            for (String id : old) if (!now.contains(id)) cancel(c, id);
            p.edit().putStringSet("ids", now).putString("events", list.toString()).apply();
        } catch (Exception ignored) { }
    }

    /** Telefon yeniden başlayınca kayıtlı olayları tekrar kurar. */
    static void restore(Context c) {
        SharedPreferences p = prefs(c);
        try {
            JSONArray list = new JSONArray(p.getString("events", "[]"));
            JSONArray keep = new JSONArray();
            long t = System.currentTimeMillis();
            for (int k = 0; k < list.length(); k++) {
                JSONObject ev = list.getJSONObject(k);
                long at = ev.getLong("at");
                if (at <= t) {
                    long next = nextRepeat(ev, t);
                    if (next <= 0) continue;
                    ev.put("at", next);
                }
                keep.put(ev);
            }
            scheduleAll(c, keep.toString());
            JSONArray sn = new JSONArray(p.getString("snoozes", "[]"));
            JSONArray snKeep = new JSONArray();
            for (int k = 0; k < sn.length(); k++) {
                JSONObject ev = sn.getJSONObject(k);
                if (ev.getLong("at") > t) { setAt(c, ev.getLong("at"), ev.getString("id"), ev); snKeep.put(ev); }
            }
            p.edit().putString("snoozes", snKeep.toString()).apply();
        } catch (Exception ignored) { }
    }

    /** Tekrarlı alarm için bir sonraki zamanı bulur (tekrarsızsa 0). */
    static long nextRepeat(JSONObject ev, long after) {
        JSONArray days = ev.optJSONArray("days");
        if (days == null || days.length() == 0) return 0;
        Set<Integer> ds = new HashSet<>();
        for (int k = 0; k < days.length(); k++) ds.add(days.optInt(k));
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(after);
        cal.set(Calendar.HOUR_OF_DAY, ev.optInt("h"));
        cal.set(Calendar.MINUTE, ev.optInt("m"));
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        for (int k = 0; k < 8; k++) {
            int jsDay = cal.get(Calendar.DAY_OF_WEEK) - 1; // Pazar = 0
            if (cal.getTimeInMillis() > after && ds.contains(jsDay)) return cal.getTimeInMillis();
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }
        return 0;
    }

    static void markFired(Context c, String id) {
        SharedPreferences p = prefs(c);
        try {
            JSONArray f = new JSONArray(p.getString("fired", "[]"));
            f.put(id);
            p.edit().putString("fired", f.toString()).apply();
        } catch (Exception ignored) { }
    }

    static String takeFired(Context c) {
        SharedPreferences p = prefs(c);
        String f = p.getString("fired", "[]");
        p.edit().putString("fired", "[]").apply();
        return f;
    }

    static void addSnooze(Context c, JSONObject ev) {
        SharedPreferences p = prefs(c);
        try {
            JSONArray sn = new JSONArray(p.getString("snoozes", "[]"));
            sn.put(ev);
            p.edit().putString("snoozes", sn.toString()).apply();
        } catch (Exception ignored) { }
        try { setAt(c, ev.getLong("at"), ev.getString("id"), ev); } catch (Exception ignored) { }
    }

    static void clearShownNotifications(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancelAll();
    }
}
