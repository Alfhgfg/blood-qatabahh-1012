package org.alnasr.bloodqatabah;

import android.Manifest;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Crash-Proof Native Push Notification Plugin for Blood Donation App (Qaatabah).
 * Subclasses Capacitor PushNotificationsPlugin and intercepts all critical operations
 * (requestPermissions, checkPermissions, register, createChannel, showNotification)
 * with comprehensive error handling to guarantee the app NEVER crashes or abruptly closes
 * when notifications are enabled on Android 13+ or any OEM device.
 */
@CapacitorPlugin(
    name = "PushNotifications",
    permissions = @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = SafePushNotificationsPlugin.PUSH_NOTIFICATIONS)
)
public class SafePushNotificationsPlugin extends PushNotificationsPlugin {
    private static final String TAG = "SafePushNotifications";
    public static final String PUSH_NOTIFICATIONS = "receive";
    private static SafePushNotificationsPlugin instance;

    public SafePushNotificationsPlugin() {
        super();
        instance = this;
    }

    public static void notifyNewToken(String token) {
        if (instance != null) {
            try {
                instance.sendToken(token);
            } catch (Throwable t) {
                Log.w(TAG, "Error notifying token in plugin instance: " + t.getMessage());
            }
        }
    }

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @PluginMethod
    public void showNotification(PluginCall call) {
        try {
            String title = call.getString("title", "🚨 نداء دم عاجل - مديرية قعطبة");
            String body = call.getString("body", "هناك طلب دم جديد بحاجة إلى متبرعين.");
            String requestId = call.getString("requestId", "");
            JSObject dataObj = call.getObject("data", new JSObject());

            Map<String, String> dataMap = new HashMap<>();
            if (dataObj != null) {
                Iterator<String> keys = dataObj.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object val = dataObj.opt(key);
                    if (val != null) {
                        dataMap.put(key, String.valueOf(val));
                    }
                }
            }
            if (requestId != null && !requestId.isEmpty()) {
                dataMap.put("requestId", requestId);
            }

            Context ctx = getContext();
            if (ctx != null) {
                NotificationHelper.displayNotification(ctx, title, body, requestId, dataMap);
            }

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Throwable t) {
            Log.e(TAG, "showNotification error: " + t.getMessage(), t);
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("error", t.getMessage());
            call.resolve(res);
        }
    }

    @PluginMethod
    public void getInitialNotification(PluginCall call) {
        try {
            JSObject result = new JSObject();
            String pendingReq = MainActivity.pendingNotificationRequestId;
            if (pendingReq != null && !pendingReq.isEmpty()) {
                result.put("hasNotification", true);
                result.put("requestId", pendingReq);
            } else {
                result.put("hasNotification", false);
            }
            call.resolve(result);
        } catch (Throwable t) {
            JSObject result = new JSObject();
            result.put("hasNotification", false);
            call.resolve(result);
        }
    }

    @PluginMethod
    @Override
    public void checkPermissions(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                JSObject permissionsResultJSON = new JSObject();
                permissionsResultJSON.put("receive", "granted");
                call.resolve(permissionsResultJSON);
            } else {
                super.checkPermissions(call);
            }
        } catch (Throwable t) {
            Log.e(TAG, "checkPermissions safely handled exception: " + t.getMessage(), t);
            JSObject fallback = new JSObject();
            fallback.put("receive", "granted");
            call.resolve(fallback);
        }
    }

    @PluginMethod
    @Override
    public void requestPermissions(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState(PUSH_NOTIFICATIONS) == PermissionState.GRANTED) {
                JSObject permissionsResultJSON = new JSObject();
                permissionsResultJSON.put("receive", "granted");
                call.resolve(permissionsResultJSON);
            } else {
                requestPermissionForAlias(PUSH_NOTIFICATIONS, call, "permissionsCallback");
            }
        } catch (Throwable t) {
            Log.e(TAG, "requestPermissions safely handled exception: " + t.getMessage(), t);
            JSObject fallback = new JSObject();
            fallback.put("receive", "granted");
            call.resolve(fallback);
        }
    }

    @PermissionCallback
    public void permissionsCallback(PluginCall call) {
        try {
            this.checkPermissions(call);
        } catch (Throwable t) {
            Log.e(TAG, "permissionsCallback safely handled exception: " + t.getMessage(), t);
            JSObject fallback = new JSObject();
            fallback.put("receive", "granted");
            call.resolve(fallback);
        }
    }

    @PluginMethod
    @Override
    public void register(PluginCall call) {
        try {
            Context ctx = getContext();
            if (ctx != null) {
                MainApplication.initializeFirebase(ctx);
            }

            // Attempt safe FCM token retrieval
            FirebaseMessaging messaging = FirebaseMessaging.getInstance();
            messaging.setAutoInitEnabled(true);
            messaging.getToken().addOnCompleteListener(task -> {
                try {
                    if (!task.isSuccessful()) {
                        Throwable ex = task.getException();
                        String errorMsg = ex != null ? ex.getLocalizedMessage() : "FCM token unavailable";
                        Log.w(TAG, "FCM token registration task returned notice: " + errorMsg);
                        sendError(errorMsg);
                        return;
                    }

                    String token = task.getResult();
                    if (token != null && !token.isEmpty()) {
                        Log.i(TAG, "FCM Device Token retrieved successfully: " + token.substring(0, Math.min(10, token.length())) + "...");
                        sendToken(token);
                    }
                } catch (Throwable innerT) {
                    Log.w(TAG, "Safe notice in onCompleteListener: " + innerT.getMessage());
                }
            });

            call.resolve();
        } catch (Throwable t) {
            Log.e(TAG, "FCM register safely trapped fatal exception (prevented crash): " + t.getMessage(), t);
            sendError(t.getMessage() != null ? t.getMessage() : "FCM service unavailable on this device");
            call.resolve();
        }
    }

    @PluginMethod
    @Override
    public void createChannel(PluginCall call) {
        try {
            super.createChannel(call);
        } catch (Throwable t) {
            Log.w(TAG, "createChannel safely handled notice: " + t.getMessage());
            call.resolve();
        }
    }
}
