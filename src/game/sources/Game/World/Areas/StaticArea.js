import * as THREE from 'three/webgpu'
import { Area } from './Area.js'
import { BuildingEffects } from './BuildingEffects.js'

// Interactive or content parts of the original Projects / Lab areas (text signs, arrows, links, distinctions,
// thumbnails, control labels), left out of the model before it is added to the world
const CONTENT = /^ref(Arrow|Attributes|Distinctions|InteractivePoint|Intersect|Pagination|Url|Mini|Title|Next|Previous|BlackboardLabels)/

/**
 * Building with ambient animation: no project content, the screen shows a blank dark panel
 * (Projects and Lab until the team's own content is ready)
 */
export class StaticArea extends Area
{
    constructor(model, { exhibit = false } = {})
    {
        StaticArea.strip(model, exhibit)
        super(model)

        const screen = this.references.items.get('images')?.[0]
        if(screen)
            screen.material = new THREE.MeshBasicNodeMaterial({ color: '#241a4a' })

        this.buildingEffects = new BuildingEffects(this)
    }

    update()
    {
        this.buildingEffects?.update()
    }

    static strip(object, exhibit = false)
    {
        for(const child of [ ...object.children ])
        {
            const furniture = exhibit && /^ref(Arrow|Attributes|Pagination|Url|Title|Next|Previous)/.test(child.name)
            if(CONTENT.test(child.name) && !furniture)
                child.removeFromParent()
            else
                StaticArea.strip(child, exhibit)
        }
    }
}
