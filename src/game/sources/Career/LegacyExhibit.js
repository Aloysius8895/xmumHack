/** Only the retired display furniture; workshop props and the surrounding world stay visible. */
export class LegacyExhibit
{
    constructor(area)
    {
        const parts = (area.objects?.items ?? []).map(item => item.visual?.object3D)
            .filter(object => object?.name === 'Cube.065') // Original workshop board/frame mesh.
        for(const name of ['images', 'title', 'url', 'previous', 'next', 'attributes', 'pagination',
            'arrowPreviousProject', 'arrowNextProject', 'arrowPreviousImage', 'arrowNextImage'])
            parts.push(...(area.references.items.get(name) ?? []))
        this.parts = [...new Set(parts)]
        this.previous = null
    }

    hide()
    {
        this.previous ??= this.parts.map(object => ({ object, visible: object.visible }))
        for(const object of this.parts) object.visible = false
    }

    restore()
    {
        for(const { object, visible } of this.previous ?? []) object.visible = visible
        this.previous = null
    }
}
