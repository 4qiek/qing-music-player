// 顶层构建脚本：只声明插件 id，不在此解析版本（版本集中在 gradle/libs 之外，直接写死以锁定兼容组合）
plugins {
    id("com.android.application") version "8.1.4" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
    // KSP 版本必须与 Kotlin 1.9.22 严格匹配
    id("com.google.devtools.ksp") version "1.9.22-1.0.17" apply false
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
