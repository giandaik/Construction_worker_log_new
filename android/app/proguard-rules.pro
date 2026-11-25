# Capacitor resolves plugins through reflection, so R8 has to be told what to
# keep. A missing keep shows up as a blank WebView or "plugin not implemented"
# in logcat — never as a compile error.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * { @com.getcapacitor.PluginMethod public *; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keep class com.constructionlog.app.** { *; }
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

