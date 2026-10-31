/** Fit the shared illustrated board without shrinking the text on narrow screens. */
export function exhibitLayout(width, height)
{
    const compact = width < 700
    const availableWidth = Math.max(240, width - (compact ? 8 : 24))
    const availableHeight = Math.max(240, height - (compact ? 12 : 20))
    const boardWidth = compact ? availableWidth : Math.min(1536, availableWidth, availableHeight * 1.5)
    const boardHeight = compact ? availableHeight : boardWidth / 1.5
    return { width: boardWidth, height: boardHeight,
        left: (width - boardWidth) / 2, top: (height - boardHeight) / 2, compact }
}
