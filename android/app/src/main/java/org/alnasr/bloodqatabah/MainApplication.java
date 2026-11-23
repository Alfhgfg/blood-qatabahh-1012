package org.alnasr.bloodqatabah;

import android.app.Application;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.util.Log;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

/**
 * Main Application class for Blood Donation Registry (Qaatabah).
 * Guarantees that default FirebaseApp and high-priority Notification Channels
 * are initialized at process start before any Activity, Service, or Capacitor Plugin calls Firebase.
 */
public class MainApplication extends Application {
    private static final String TAG = "BloodQatabahApp";
    public static final String EMERGENCY_CHANNEL_ID = "blood_emergency_channel";

    @Override
    public void onCreate() {
        super.onCreate();
        initializeFirebase(this);
        createNotificationChannels(this);
    }

    /**
     * Creates system notification channels immediately upon app startup.
     */
    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && context != null) {
            try {
                NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager == null) return;

                NotificationChannel channel = new NotificationChannel(
                    EMERGENCY_CHANNEL_ID,
                    "نداءات طوارئ الدم قعطبة",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("تنبيهات فورية لطلبات التبرع بالدم العاجلة والحرجة في مديرية قعطبة");
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#be123c"));
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 400, 200, 400});
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .build();
                channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), audioAttributes);

                manager.createNotificationChannel(channel);
                Log.i(TAG, "Notification channel " + EMERGENCY_CHANNEL_ID + " created successfully.");
            } catch (Throwable t) {
                Log.w(TAG, "Error creating notification channel: " + t.getMessage());
            }
        }
    }

    /**
     * Initializes the default FirebaseApp.
     */
    public static synchronized void initializeFirebase(Context context) {
        try {
            Context appContext = context != null ? context.getApplicationContext() : null;
            if (appContext == null) {
                appContext = context;
            }

            if (!FirebaseApp.getApps(appContext).isEmpty()) {
                Log.d(TAG, "Default FirebaseApp already initialized.");
                return;
            }

            Log.d(TAG, "Attempting automatic Firebase initialization from google-services resources...");
            FirebaseApp app = FirebaseApp.initializeApp(appContext);
            if (app != null) {
                Log.i(TAG, "Default FirebaseApp initialized successfully from resources: " + app.getName());
                return;
            }
        } catch (Throwable t) {
            Log.w(TAG, "Automatic Firebase initialization notice: " + t.getMessage());
        }

        // Guaranteed fallback initialization using credentials matching google-services.json
        try {
            Context appContext = context != null ? context.getApplicationContext() : null;
            if (appContext == null) {
                appContext = context;
            }

            if (FirebaseApp.getApps(appContext).isEmpty()) {
                Log.i(TAG, "Initializing default FirebaseApp using verified project options...");
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId("1:589909705354:android:33008ef0e0b84fd4d0e373")
                    .setApiKey("AIzaSyC2kUM_IxD-iN6HRK0BdTKyaU4mdRsO_iA")
                    .setProjectId("avian-gate-pbcxw")
                    .setGcmSenderId("589909705354")
                    .setStorageBucket("avian-gate-pbcxw.firebasestorage.app")
                    .build();
                FirebaseApp.initializeApp(appContext, options);
                Log.i(TAG, "Default FirebaseApp initialized successfully with options.");
            }
        } catch (Throwable t) {
            Log.e(TAG, "Fatal: Error during Firebase initialization: " + t.getMessage(), t);
        }
    }
}
