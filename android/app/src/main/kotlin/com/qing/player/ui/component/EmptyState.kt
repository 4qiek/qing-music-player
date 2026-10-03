package com.qing.player.ui.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.TitleSerifStyle

/** 空状态：灰白极简，只有一行标题加一行说明 */
@Composable
fun EmptyState(
    title: String,
    message: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = title,
            style = TitleSerifStyle,
            color = MaterialTheme.colorScheme.onBackground
        )
        androidx.compose.foundation.layout.Spacer(
            modifier = Modifier.padding(top = 8.dp)
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            color = LocalQingExtendedColors.current.textSecondary,
            textAlign = TextAlign.Center
        )
    }
}
