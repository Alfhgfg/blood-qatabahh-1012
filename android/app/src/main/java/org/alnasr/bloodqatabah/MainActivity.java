package org.alnasr.bloodqatabah;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

/**
 * Main Activity for Blood Donation App (Qaatabah).
 * Handles cold launches and background resumes from external notification clicks,
 * extracting the target blood requestId and triggering navigation inside the app,
 * as well as bridging Android hardware/gesture back presses to the WebView stack.
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "BloodQatabahApp";
    public static String pendingNotificationRequestId = null;
    private OnBackPressedCallback appBackCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SafePushNotificationsPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(NativeNavigationPlugin.class);
        MainApplication.initializeFirebase(this);
        super.onCreate(savedInstanceState);

        appBackCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleWebViewBackPress();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, appBackCallback);

        handleNotificationIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        if (appBackCallback != null) {
            appBackCallback.setEnabled(true);
        }
    }

    private void handleWebViewBackPress() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                String js = "(function(){"
                    + "try {"
                    + "  if (window.__appBackHandlerReady && typeof window.__handleAppNativeBack === 'function') {"
                    + "    return window.__handleAppNativeBack() ? 'handled' : 'exit';"
                    + "  }"
                    + "} catch (e) {}"
                    + "return 'exit';"
                    + "})();";

                getBridge().getWebView().evaluateJavascript(js, value -> {
                    if (value != null && value.contains("handled")) {
                        return;
                    }
                    performNaturalExit();
                });
                return;
            }
        } catch (Throwable t) {
            Log.w(TAG, "Error handling back press in WebView: " + t.getMessage());
        }
        performNaturalExit();
    }

    public void performNaturalExit() {
        runOnUiThread(() -> {
            if (appBackCallback != null) {
                appBackCallback.setEnabled(false);
            }
            getOnBackPressedDispatcher().onBackPressed();
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        Bundle extras = intent.getExtras();

        String requestId = null;
        if (extras != null) {
            requestId = extras.getString("requestId");
        }

        if (requestId == null || requestId.isEmpty()) {
            Uri data = intent.getData();
            if (data != null) {
                requestId = data.getQueryParameter("openRequest");
            }
        }

        if (requestId != null && !requestId.isEmpty()) {
            pendingNotificationRequestId = requestId;
            final String finalReqId = requestId;
            Log.i(TAG, "Notification tapped with target requestId: " + finalReqId);

            // Execute in WebView once ready
            getWindow().getDecorView().postDelayed(() -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        String js = "(function(){"
                            + "window.dispatchEvent(new CustomEvent('OPEN_REQUEST_NOTIFICATION', { detail: { requestId: '" + finalReqId + "' } }));"
                            + "try { const u = new URL(window.location.href); u.searchParams.set('openRequest', '" + finalReqId + "'); window.history.replaceState(window.history.state || {}, '', u.toString()); } catch(e){}"
                            + "})();";
                        getBridge().getWebView().evaluateJavascript(js, null);
                        Log.i(TAG, "Dispatched OPEN_REQUEST_NOTIFICATION to WebView for requestId: " + finalReqId);
                    }
                } catch (Throwable t) {
                    Log.w(TAG, "Error evaluating notification tap JS: " + t.getMessage());
                }
            }, 1200);
        }
    }
}
