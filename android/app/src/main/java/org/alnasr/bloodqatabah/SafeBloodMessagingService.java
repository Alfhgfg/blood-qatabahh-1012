package org.alnasr.bloodqatabah;

import android.util.Log;
import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Custom FirebaseMessagingService for Blood Registry (Qaatabah).
 * Receives all incoming FCM push messages whether app is in foreground, background, or closed,
 * and ensures an emergency notification is displayed in Android's notification drawer.
 */
public class SafeBloodMessagingService extends FirebaseMessagingService {
    private static final String TAG = "SafeBloodMessaging";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.i(TAG, "FCM RemoteMessage received: " + remoteMessage.getMessageId());

        try {
            // Forward to Capacitor PushNotificationsPlugin so JS listeners are triggered
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Throwable t) {
            Log.w(TAG, "Notice forwarding to Capacitor plugin: " + t.getMessage());
        }

        try {
            String title = null;
            String body = null;

            if (remoteMessage.getNotification() != null) {
                title = remoteMessage.getNotification().getTitle();
                body = remoteMessage.getNotification().getBody();
            }

            Map<String, String> data = remoteMessage.getData();
            if (title == null && data != null) {
                title = data.get("title");
            }
            if (body == null && data != null) {
                body = data.get("body");
            }

            if (title == null || title.isEmpty()) {
                title = "🚨 نداء دم عاجل - مديرية قعطبة";
            }
            if (body == null || body.isEmpty()) {
                body = "هناك طلب دم جديد بحاجة إلى متبرعين عاجلين.";
            }

            String requestId = data != null ? data.get("requestId") : null;
            NotificationHelper.displayNotification(this, title, body, requestId, data);
        } catch (Throwable t) {
            Log.e(TAG, "Error displaying notification in onMessageReceived: " + t.getMessage(), t);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.i(TAG, "FCM onNewToken: " + token.substring(0, Math.min(10, token.length())) + "...");
        try {
            PushNotificationsPlugin.onNewToken(token);
            SafePushNotificationsPlugin.notifyNewToken(token);
        } catch (Throwable t) {
            Log.w(TAG, "Notice delivering new FCM token: " + t.getMessage());
        }
    }
}
