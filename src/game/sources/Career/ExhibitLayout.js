/** Center the content panel and reserve desktop space for previous/next buttons. */
export function exhibitLayout(width, height)
{
    const compact = width < 700
    const boardWidth = Math.max(1, compact ? width - 24 : Math.min(1480, width * 0.82, width - 160))
    const boardHeight = Math.max(1, Math.min(900, Math.round(height * (compact ? 0.92 : 0.86))))
    return { width: boardWidth, height: boardHeight,
        left: (width - boardWidth) / 2, top: (height - boardHeight) / 2, compact }
}
