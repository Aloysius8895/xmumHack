import { leaveAtBuilding } from './BuildingTravel.js'

/** Camera/input lifecycle independent of rendering, so cancelling a zoom cannot reopen a stale screen. */
export class BuildingVisit
{
    constructor(game, ui, stage, delay)
    {
        Object.assign(this, { game, ui, stage, delay })
        this.active = false
        ui.events.on('panel', name =>
        {
            if(!this.active) return
            if(name) this.exitPanel = name
            else this.finish()
        })
    }

    open(station, { direct = false } = {})
    {
        const { game, ui } = this
        if(this.active || game.view.cinematic.active || ui.panel || ui.dialogue || ui.touring) return false
        this.active = true
        const generation = this.generation = (this.generation ?? 0) + 1
        this.station = station
        this.exitPanel = station.panel
        this.previousRatioOffset = game.view.cinematic.nonIdealRatioOffset
        try
        {
            game.clickMove?.cancel()
            ui.setMenuOpen(false)
            ui.takeInputs()
            game.inputs.interactiveButtons.clearItems()
            game.inputs.interactiveButtons.addItems(['close'])
            this.restorePoints = !game.interactivePoints.temporaryHidden
            if(this.restorePoints) game.interactivePoints.temporaryHide()
            const { position, target } = this.stage.show(station)
            // Stage fits the camera to the viewport itself (including portrait windows).
            game.view.cinematic.nonIdealRatioOffset = 0
            game.view.cinematic.start(position, target)
            if(direct)
            {
                this.stage.enterDirect(position, target)
                try { ui.openPanel(station.panel); this.stage.reveal() }
                catch(error) { this.fail(error); return false }
                return true
            }
            this.pending = this.delay(1.5, () =>
            {
                if(!this.active || this.generation !== generation) return
                this.pending = null
                try { ui.openPanel(station.panel); this.stage.reveal() }
                catch(error) { this.fail(error) }
            })
            return true
        }
        catch(error)
        {
            this.fail(error)
            return false
        }
    }

    fail(error)
    {
        console.error('Building visit could not open:', error)
        try { this.cancel() }
        finally { if(this.active) this.finish() }
    }

    cancel()
    {
        if(!this.active) return
        if(this.ui.panel) this.ui.closePanel()
        else this.finish()
    }

    finish()
    {
        if(!this.active) return
        this.active = false
        this.pending?.kill()
        this.pending = null
        this.stage.hide()
        leaveAtBuilding(this.game, this.exitPanel)
        this.game.view.cinematic.nonIdealRatioOffset = this.previousRatioOffset
        this.game.view.cinematic.end()
        this.game.inputs.interactiveButtons.removeItems(['close'])
        this.ui.releaseInputs()
        if(this.restorePoints) this.game.interactivePoints.recover()
    }
}
