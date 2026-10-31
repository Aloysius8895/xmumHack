/** Center the content panel below the top bar (reserve: its height, 0 without it) and reserve desktop space for previous/next buttons. */
export function exhibitLayout(width, height, reserve = 0)
{
    const compact = width < 700
    const room = Math.max(1, height - reserve)
    const boardWidth = Math.max(1, compact ? width - 24 : Math.min(1480, width * 0.82, width - 160))
    const boardHeight = Math.max(1, Math.min(900, Math.round(room * (compact ? 0.92 : 0.86))))
    return { width: boardWidth, height: boardHeight,
        left: (width - boardWidth) / 2, top: reserve + (room - boardHeight) / 2, compact }
}
