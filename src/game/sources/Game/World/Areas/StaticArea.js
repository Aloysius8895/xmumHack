import * as THREE from 'three/webgpu'
import { Area } from './Area.js'
import { BuildingEffects } from './BuildingEffects.js'

// Interactive or content parts of the original Projects / Lab areas (text signs, arrows, links, distinctions,
// thumbnails, control labels), left out of the model before it is added to the world
const CONTENT = /^ref(Arrow|Attributes|Distinctions|InteractivePoint|Intersect|Pagination|Url|Mini|Title|Next|Previous|BlackboardLabels)/
// Display furniture an exhibit building keeps for the visit screen (BuildingScreen)
const EXHIBIT_FURNITURE = /^ref(Arrow|Attributes|Pagination|Url|Title|Next|Previous)/

/**
 * Building with ambient animation: no project content, the screen shows a blank dark panel
 * (Projects and Lab until the team's own content is ready)
 */
export class StaticArea extends Area
{
    constructor(model, { exhibit = false, keep = null } = {})
    {
        StaticArea.strip(model, exhibit ? EXHIBIT_FURNITURE : keep)
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

    /** furniture: the content parts to keep (a pattern), none when null */
    static strip(object, furniture = null)
    {
        for(const child of [ ...object.children ])
        {
            if(CONTENT.test(child.name) && !furniture?.test(child.name))
                child.removeFromParent()
            else
                StaticArea.strip(child, furniture)
        }
    }
}

/** The lab: its screen shows Profile (BuildingScreen), with the title and brand planks above it */
export class ProfileBoardArea extends StaticArea
{
    constructor(model)
    {
        super(model, { keep: /^ref(Title|Url)/ })
    }
}
