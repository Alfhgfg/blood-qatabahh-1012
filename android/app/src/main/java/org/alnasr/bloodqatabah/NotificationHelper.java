package org.alnasr.bloodqatabah;

import android.Manifest;
import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.Map;

/**
 * Robust notification dispatcher for Blood Registry (Qaatabah).
 * Displays high-priority heads-up emergency blood notifications in the Android status bar
 * with custom red branding, sound, vibration, and deep-link click action.
 */
public class NotificationHelper {
    private static final String TAG = "BloodNotificationHelper";

    public static void displayNotification(Context context, String title, String body, String requestId, Map<String, String> data) {
        if (context == null) return;

        try {
            // Guarantee notification channel is initialized
            MainApplication.createNotificationChannels(context);

            // Check POST_NOTIFICATIONS permission on Android 13+ (API 33+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "POST_NOTIFICATIONS permission not granted. Notification cannot be posted to status bar.");
                    return;
                }
            }

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);

            // Create target intent that launches MainActivity when notification is tapped
            Intent intent = new Intent(context, MainActivity.class);
            intent.setAction("OPEN_REQUEST_NOTIFICATION");
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            if (requestId != null && !requestId.isEmpty()) {
                intent.putExtra("requestId", requestId);
                intent.setData(Uri.parse("bloodqatabah://request?openRequest=" + Uri.encode(requestId)));
            }

            if (data != null) {
                for (Map.Entry<String, String> entry : data.entrySet()) {
                    intent.putExtra(entry.getKey(), entry.getValue());
                }
            }

            // Also mark with google.message_id so Capacitor PushNotificationsPlugin can recognize it
            intent.putExtra("google.message_id", "local_msg_" + System.currentTimeMillis());

            int reqCode = (int) (System.currentTimeMillis() % 100000);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                reqCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            String safeTitle = (title != null && !title.isEmpty()) ? title : "🚨 نداء دم عاجل - مديرية قعطبة";
            String safeBody = (body != null && !body.isEmpty()) ? body : "هناك حالة بحاجة عاجلة إلى التبرع بالدم.";

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, MainApplication.EMERGENCY_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_blood_drop)
                .setColor(0xFFBE123C)
                .setContentTitle(safeTitle)
                .setContentText(safeBody)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(safeBody))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            int notifId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
            notificationManager.notify(notifId, builder.build());
            Log.i(TAG, "Notification successfully posted to Android notification drawer: " + safeTitle);
        } catch (Throwable t) {
            Log.e(TAG, "Error posting notification: " + t.getMessage(), t);
        }
    }
}
