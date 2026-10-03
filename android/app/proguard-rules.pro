# 清 - 混淆规则
# Media3 / ExoPlayer：反射创建的 Renderer 需要保留
-keep class androidx.media3.** { *; }
-keep interface androidx.media3.** { *; }
-dontwarn androidx.media3.**

# Room：保留数据库相关类与生成实现
-keep class * extends androidx.room.RoomDatabase { *; }
-keep @androidx.room.Entity class * { *; }
-dontwarn androidx.room.paging.**

# Kotlin 序列化/协程
-keepclassmembers class **$WhenMappings {
    <fields>;
}
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}
-dontwarn kotlinx.coroutines.**

# Coil
-dontwarn coil.**
-keepclassmembers public class * implements coil.ImageLoader { *; }
