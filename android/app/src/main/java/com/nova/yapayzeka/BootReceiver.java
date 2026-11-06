package com.nova.yapayzeka;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Telefon yeniden başlayınca ya da uygulama güncellenince alarmları geri kurar. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            AlarmScheduler.ensureChannels(c);
            AlarmScheduler.restore(c);
        }
    }
}
