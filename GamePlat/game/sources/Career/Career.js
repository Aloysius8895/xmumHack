import { CareerApi } from './CareerApi.js'
import { CareerUI } from './CareerUI.js'
import { CareerWorld } from './CareerWorld.js'
import { CareerMinimap } from './CareerMinimap.js'
import { getLang } from './i18n.js'

/**
 * Career platform: know your skills > pick a career (General or Customise) > career pet > AI roadmap
 * > self-study + logs > gym Q&A > affinity. Backend in server/, AI by Claude.
 */
export class Career
{
    constructor()
    {
        this.api = new CareerApi()
        this.ui = new CareerUI(this.api)
        this.world = new CareerWorld(this.api, this.ui)
        this.minimap = new CareerMinimap(this.api, this.ui, this.world)

        let lang = getLang()
        this.api.events.on('state', () =>
        {
            if(getLang() !== lang)
            {
                lang = getLang()
                this.world.relabel()
            }
        })

        this.api.load().catch((error) =>
        {
            console.warn('Career > API unreachable, is the dev server running with server/?', error)
        })
    }
}
