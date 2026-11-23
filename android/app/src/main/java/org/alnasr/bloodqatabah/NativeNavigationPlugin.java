package org.alnasr.bloodqatabah;

import android.app.Activity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native Capacitor Plugin for handling natural Android app exit
 * when no previous page or overlay remains in the JS navigation stack.
 */
@CapacitorPlugin(name = "NativeNavigation")
public class NativeNavigationPlugin extends Plugin {

    @PluginMethod
    public void exitApp(PluginCall call) {
        Activity activity = getActivity();
        if (activity instanceof MainActivity) {
            ((MainActivity) activity).performNaturalExit();
            call.resolve();
        } else if (activity != null) {
            activity.runOnUiThread(activity::finish);
            call.resolve();
        } else {
            call.reject("Activity unavailable");
        }
    }
}
