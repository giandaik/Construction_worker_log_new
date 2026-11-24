# ProGuard / R8 rules for the release build.
#
# `minifyEnabled true` is on in android/app/build.gradle. R8 renames and strips
# classes that are only reached by reflection, and Capacitor reaches its plugins
# that way: the JS bridge looks a plugin up by the name declared in
# `@CapacitorPlugin` and calls methods marked `@PluginMethod` through
# JavaScriptInterface. Over-aggressive shrinking shows up as the app booting to
# a blank WebView with "plugin not implemented" in logcat, so these keeps are
# deliberate.

# Keep attributes the bridge reflects over (annotations, method signatures).
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Capacitor core + every plugin registered with it.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# The JS bridge entry points.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# The app's own shell classes (MainActivity is referenced from the manifest by
# name, which R8 does not treat as a use).
-keep class com.constructionlog.app.** { *; }

# Keep line numbers so Play Console crash reports resolve to real lines.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
