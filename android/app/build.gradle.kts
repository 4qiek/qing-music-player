plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // Room 使用 KSP 生成实现代码
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.qing.player"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.qing.player"
        minSdk = 26
        targetSdk = 34
        versionCode = 3
        versionName = "1.2.0"

        // 仅中文与英文资源，避免无用资源膨胀
        resourceConfigurations += setOf("zh", "en")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        // Compose 编译器版本由 BOM 之外单独指定。
        // 版本必须严格匹配 Kotlin：1.5.4 只认 1.9.20，而本项目是 Kotlin 1.9.22，
        // 对应的是 Compose 编译器 1.5.8（官方兼容表）。改 Kotlin 版本时这里要同步改。
        kotlinCompilerExtensionVersion = "1.5.8"
    }

    packaging {
        resources {
            // 排除 META-INF 冲突项，避免打包失败
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "META-INF/DEPENDENCIES"
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // 用 debug 签名给 release 包签名。
            //
            // 目的**不是**省事，而是拿掉 debuggable 标记：debug 构建下 ART 只做
            // quicken 而不是 AOT 编译，Compose 运行时还会打开额外的重组校验，
            // 在小内存设备上就是肉眼可见的掉帧。release 构建（debuggable = false）
            // 流畅度明显更好。
            //
            // 用同一个 debug key 签名的附带好处：可以直接覆盖安装先前那个 debug 包，
            // 不需要先卸载（卸载会清掉已扫描的歌单/收藏）。
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    // ---- AndroidX 核心 ----
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.6.2")
    implementation("androidx.lifecycle:lifecycle-service:2.6.2")

    // ---- Compose（BOM 统一版本）----
    val composeBom = platform("androidx.compose:compose-bom:2023.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // ---- Navigation ----
    implementation("androidx.navigation:navigation-compose:2.7.6")

    // ---- Media3：ExoPlayer + Session + UI（后台播放、通知、实体按键）----
    implementation("androidx.media3:media3-exoplayer:1.2.1")
    implementation("androidx.media3:media3-session:1.2.1")
    implementation("androidx.media3:media3-ui:1.2.1")

    // ---- Room（歌单/收藏/历史持久化）----
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // ---- Coil：加载 MediaStore 封面 ----
    implementation("io.coil-kt:coil-compose:2.5.0")

    // ----  accompanist 不用，权限用原生 Activity Result API ----
    // 注意：本项目严禁引入任何 GMS / Firebase 依赖，必须保证完全离线可用
}
