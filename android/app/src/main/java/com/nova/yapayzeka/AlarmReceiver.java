package com.nova.yapayzeka;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

/** Zamanı gelen alarm / hatırlatmayı bildirim olarak gösterir. */
public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent intent) {
        String action = intent.getAction();
        String id = intent.getStringExtra(AlarmScheduler.EXTRA_ID);
        if (id == null) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        int nid = id.hashCode();

        if (AlarmScheduler.ACTION_DISMISS.equals(action)) {
            if (nm != null) nm.cancel(nid);
            return;
        }

        JSONObject ev;
        try { ev = new JSONObject(intent.getStringExtra(AlarmScheduler.EXTRA_EVENT)); }
        catch (Exception e) { return; }

        if (AlarmScheduler.ACTION_SNOOZE.equals(action)) {
            if (nm != null) nm.cancel(nid);
            try {
                JSONObject sn = new JSONObject(ev.toString());
                sn.put("id", "snooze-" + System.currentTimeMillis());
                sn.put("at", System.currentTimeMillis() + 5 * 60 * 1000L);
                sn.put("days", null);
                sn.put("sub", "Ertelendi");
                AlarmScheduler.addSnooze(c, sn);
            } catch (Exception ignored) { }
            return;
        }

        // Tekrarlı alarm: bir sonrakini hemen kur
        long next = AlarmScheduler.nextRepeat(ev, System.currentTimeMillis() + 1000);
        if (next > 0) {
            try {
                JSONObject n = new JSONObject(ev.toString());
                n.put("at", next);
                AlarmScheduler.setAt(c, next, id, n);
            } catch (Exception ignored) { }
        } else if (!id.startsWith("snooze-")) {
            AlarmScheduler.markFired(c, id);
        }

        // Uygulama açıksa çalmayı arayüz yapar
        if (MainActivity.foreground) return;

        String kind = ev.optString("kind", "reminder");
        boolean loud = "alarm".equals(kind) || "timer".equals(kind);
        String title = ev.optString("title", "NOVA");
        String sub = ev.optString("sub", "");
        String label = "alarm".equals(kind) ? "⏰ Alarm" : "timer".equals(kind) ? "⏱ Süre doldu" : "🔔 Hatırlatma";

        PendingIntent open = AlarmScheduler.openAppIntent(c, id, ev.toString());
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(c, loud ? AlarmScheduler.CH_ALARM : AlarmScheduler.CH_REMINDER)
                : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat_nova)
                .setContentTitle(label + " · " + title)
                .setContentText(sub.isEmpty() ? "NOVA Yapay Zeka" : sub)
                .setAutoCancel(true)
                .setContentIntent(open)
                .setCategory(loud ? Notification.CATEGORY_ALARM : Notification.CATEGORY_REMINDER)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setColor(0xFFF5A524);
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_MAX).setDefaults(Notification.DEFAULT_ALL);
        }
        if (loud) {
            b.setOngoing(true);
            Intent snooze = new Intent(c, AlarmReceiver.class).setAction(AlarmScheduler.ACTION_SNOOZE)
                    .putExtra(AlarmScheduler.EXTRA_ID, id).putExtra(AlarmScheduler.EXTRA_EVENT, ev.toString());
            Intent dismiss = new Intent(c, AlarmReceiver.class).setAction(AlarmScheduler.ACTION_DISMISS)
                    .putExtra(AlarmScheduler.EXTRA_ID, id);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
            b.addAction(new Notification.Action.Builder(null, "5 dk ertele", PendingIntent.getBroadcast(c, nid ^ 0x11, snooze, flags)).build());
            b.addAction(new Notification.Action.Builder(null, "Kapat", PendingIntent.getBroadcast(c, nid ^ 0x22, dismiss, flags)).build());
        }
        Notification n = b.build();
        if (loud) n.flags |= Notification.FLAG_INSISTENT; // kapatılana kadar çalsın
        if (nm != null) {
            try { nm.notify(nid, n); } catch (SecurityException ignored) { }
        }
    }
}
