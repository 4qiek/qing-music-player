package com.qing.player.data

/**
 * 音频文件的格式参数，来自 MediaMetadataRetriever。
 * 读取开销较大（要打开文件头），调用方必须按需取并缓存。
 *
 * @param bitrate    平均比特率 bit/s；读不到为 null
 * @param sampleRate 采样率 Hz；读不到为 null
 * @param channels   声道数；读不到为 null
 * @param codec      容器/编码 MIME（如 audio/mpeg、audio/flac）
 * @param durationMs 时长（毫秒），与 MediaStore 口径一致
 * @param size       文件字节数（沿用 MediaStore 值）
 * @param path       文件绝对路径
 */
data class AudioInfo(
    val bitrate: Int? = null,
    val sampleRate: Int? = null,
    val channels: Int? = null,
    val codec: String? = null,
    val durationMs: Long = 0L,
    val size: Long = 0L,
    val path: String = ""
) {
    /** 比特率展示：kbps */
    val bitrateKbps: String?
        get() = bitrate?.takeIf { it > 0 }?.let { "${(it + 500) / 1000}" }

    /** 采样率展示：kHz，一位小数去尾零 */
    val sampleRateKhz: String?
        get() = sampleRate?.takeIf { it > 0 }?.let {
            val khz = it / 1000.0
            if (khz == khz.toLong().toDouble()) "${khz.toLong()} kHz"
            else "%.1f kHz".format(khz)
        }

    /** 声道展示：单声道 / 双声道 / X 声道 */
    val channelText: String?
        get() = when (channels) {
            null, 0 -> null
            1 -> "mono"
            2 -> "stereo"
            else -> "$channels ch"
        }

    /** 文件大小展示：MB / KB */
    val sizeText: String
        get() = when {
            size >= 1 shl 20 -> "%.1f MB".format(size / 1048576.0)
            size >= 1024 -> "${size / 1024} KB"
            else -> "$size B"
        }
}
