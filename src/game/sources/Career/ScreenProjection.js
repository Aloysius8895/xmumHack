/** Map an HTML rectangle onto a projected world-space screen (TL, TR, BR, BL).
 * CSS matrix3d is supported by Chrome/Edge on Windows as well as Safari.
 */
export function screenTransform(points, width, height)
{
    if(width <= 0 || height <= 0 || points.some(p => !Number.isFinite(p.x + p.y))) return null
    const [p0, p1, p2, p3] = points
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y
    const sx = p0.x - p1.x + p2.x - p3.x
    const sy = p0.y - p1.y + p2.y - p3.y
    let g = 0, h = 0
    if(Math.abs(sx) + Math.abs(sy) > 1e-8)
    {
        const determinant = dx1 * dy2 - dx2 * dy1
        if(Math.abs(determinant) < 1e-8) return null
        g = (sx * dy2 - dx2 * sy) / determinant
        h = (dx1 * sy - sx * dy1) / determinant
    }
    const a = p1.x - p0.x + g * p1.x
    const b = p3.x - p0.x + h * p3.x
    const d = p1.y - p0.y + g * p1.y
    const e = p3.y - p0.y + h * p3.y
    return [a / width, d / width, 0, g / width,
        b / height, e / height, 0, h / height,
        0, 0, 1, 0, p0.x, p0.y, 0, 1]
}

export function displaySize(viewportWidth)
{
    return viewportWidth < 760 ? { width: 800, height: 450 } : { width: 1000, height: 562.5 }
}

// Sign meshes exported from Blender can use XZ instead of XY as their face.
export function signAspect(size)
{
    return Math.max(Math.abs(size.x), 0.1) / Math.max(Math.abs(size.y), Math.abs(size.z), 0.01)
}
