package com.qing.player.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.qing.player.R
import com.qing.player.ui.theme.QingDimen

/**
 * 专辑封面。
 *
 * [model] 既可以是 MediaStore 的 content:// Uri，也可以是联网补全来的 http(s) 地址——
 * Coil 两种都支持，所以这里统一用 Any? 接。
 * 无封面 / 加载失败时回退到极简音符占位，不显示破碎图片。
 */
@Composable
fun AlbumArt(
    model: Any?,
    modifier: Modifier = Modifier,
    size: Dp = QingDimen.ArtSize,
    cornerRadius: Dp = QingDimen.RadiusControl
) {
    val shape = RoundedCornerShape(cornerRadius)
    Box(
        modifier = modifier
            .size(size)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center
    ) {
        if (model == null) {
            PlaceholderNote(size)
        } else {
            AsyncImage(
                model = model,
                contentDescription = null,
                modifier = Modifier.size(size),
                contentScale = ContentScale.Crop,
                placeholder = painterResource(id = R.drawable.ic_note),
                error = painterResource(id = R.drawable.ic_note),
                fallback = painterResource(id = R.drawable.ic_note)
            )
        }
    }
}

@Composable
private fun PlaceholderNote(size: Dp) {
    androidx.compose.foundation.Image(
        painter = painterResource(id = R.drawable.ic_note),
        contentDescription = null,
        modifier = Modifier.size(size * 0.6f)
    )
}
