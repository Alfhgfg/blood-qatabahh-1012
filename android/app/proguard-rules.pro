# Capacitor and WebView Bridge Preservation
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.annotation.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.BridgeActivity { *; }

# Keep Plugin methods, callbacks and reflection annotations (vital for requestPermissions and callbacks)
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
    @com.getcapacitor.annotation.PluginMethod public *;
    @com.getcapacitor.annotation.PermissionCallback *;
    @com.getcapacitor.annotation.ActivityCallback *;
}

# Capacitor & Cordova Plugin Preservation
-keep class com.capacitorjs.plugins.** { *; }
-keepclassmembers class com.capacitorjs.plugins.** { *; }
-dontwarn com.capacitorjs.plugins.**
-keep class org.apache.cordova.** { *; }
-keep interface org.apache.cordova.** { *; }

# App Package & Safe Push Plugin Preservation
-keep class org.alnasr.bloodqatabah.** { *; }
-keepclassmembers class org.alnasr.bloodqatabah.** { *; }

# Firebase & Google Play Services Preservation
-keep class com.google.firebase.** { *; }
-keepclassmembers class com.google.firebase.** { *; }
-keep class com.google.firebase.provider.FirebaseInitProvider { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-keepclassmembers class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

-keepattributes *Annotation*,Exceptions,InnerClasses,Signature,SourceFile,LineNumberTable

# Strip sensitive verbose debug logs from APK release builds while keeping warnings and errors
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
}
