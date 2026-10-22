import * as THREE from 'three/webgpu'
import { Area } from './Area.js'

// Interactive or content parts of the original Projects / Lab areas (text signs, arrows, links, distinctions,
// thumbnails, control labels), left out of the model before it is added to the world
const CONTENT = /^ref(Arrow|Attributes|Distinctions|InteractivePoint|Intersect|Pagination|Url|Mini|Title|Next|Previous|BlackboardLabels)/

/**
 * Area kept as a plain building: no interaction, no project content, the screen shows a blank dark panel
 * (Projects and Lab until the team's own content is ready)
 */
export class StaticArea extends Area
{
    constructor(model)
    {
        StaticArea.strip(model)
        super(model)

        const screen = this.references.items.get('images')?.[0]
        if(screen)
            screen.material = new THREE.MeshBasicNodeMaterial({ color: '#241a4a' })
    }

    static strip(object)
    {
        for(const child of [ ...object.children ])
        {
            if(CONTENT.test(child.name))
                child.removeFromParent()
            else
                StaticArea.strip(child)
        }
    }
}
