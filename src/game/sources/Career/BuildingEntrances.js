import { InteractivePoints } from '../Game/InteractivePoints.js'
import { BUILDING_DESTINATIONS } from './BuildingTravel.js'
import { t } from './i18n.js'
import gsap from 'gsap'
import { BuildingScreen } from './BuildingScreen.js'
import { BuildingVisit } from './BuildingVisit.js'

/** Enter at a building, rather than opening a sidebar from the top navigation. */
export class BuildingEntrances
{
    constructor(game, ui)
    {
        this.points = []
        this.stations = new Map()
        this.screen = new BuildingScreen(game, ui)
        this.visit = new BuildingVisit(game, ui, this.screen, (seconds, callback) => gsap.delayedCall(seconds, callback))
        ui.buildingVisit = this.visit
        for(const [panel, building] of Object.entries(BUILDING_DESTINATIONS))
        {
            const spawn = game.respawns.items.get(building)
            if(!spawn) continue
            const existing = game.world.areas[building]?.interactivePoint
            const position = spawn.position.clone()
            if(existing) { position.x = existing.position.x; position.z = existing.position.y }
            const station = { panel, building, position }
            this.stations.set(panel, station)
            if(existing)
            {
                existing.interactCallback = () => this.visit.open(station)
                existing.setText(t(`menu.${panel}`))
                this.points.push({ point: existing, panel })
                continue
            }
            position.y = 2.5
            const buttons = game.inputs.interactiveButtons
            const point = game.interactivePoints.create(
                position, t(`menu.${panel}`),
                InteractivePoints.ALIGN_RIGHT, InteractivePoints.STATE_CONCEALED,
                () => this.visit.open(station),
                () => buttons.addItems(['interact']),
                () => buttons.removeItems(['interact']),
                () => buttons.removeItems(['interact']),
            )
            this.points.push({ point, panel })
        }
        game.inputs.addActions([{ name: 'buildingExit', categories: ['career'], keys: ['Keyboard.Escape', 'Gamepad.b'] }])
        game.inputs.events.on('buildingExit', action => { if(action.active) this.visit.cancel() })
        game.inputs.interactiveButtons.events.on('close', () => this.visit.cancel())
    }

    relabel()
    {
        for(const { point, panel } of this.points)
            point.setText(t(`menu.${panel}`))
    }
}
