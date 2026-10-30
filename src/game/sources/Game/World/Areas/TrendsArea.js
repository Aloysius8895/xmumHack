import * as THREE from 'three/webgpu'
import { InteractivePoints } from '../../InteractivePoints.js'
import { StaticArea } from './StaticArea.js'

/**
 * The workshop of the original Projects area, kept as a plain building (StaticArea) with one interaction: it opens the
 * player's job market trends (career panel "market"), at the spot of the original projects interaction
 */
export class TrendsArea extends StaticArea
{
    constructor(model)
    {
        // StaticArea strips the original interaction point: keep where it was first, in world space (the reference
        // is placed relative to the building)
        model.updateWorldMatrix(true, true)
        const position = TrendsArea.find(model, /^refInteractivePoint/)?.getWorldPosition(new THREE.Vector3()) ?? null
        super(model)

        if(position)
            this.setInteractivePoint(position)
    }

    static find(object, pattern)
    {
        for(const child of object.children)
        {
            if(pattern.test(child.name))
                return child
            const found = TrendsArea.find(child, pattern)
            if(found)
                return found
        }
        return null
    }

    setInteractivePoint(position)
    {
        const buttons = this.game.inputs.interactiveButtons
        this.interactivePoint = this.game.interactivePoints.create(
            position,
            'Trends',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                buttons.clearItems()
                this.game.career.ui.openPanel('market')
            },
            () => buttons.addItems([ 'interact' ]),
            () => buttons.removeItems([ 'interact' ]),
            () => buttons.removeItems([ 'interact' ]),
        )
    }
}
