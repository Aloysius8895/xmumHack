/** Own the building camera only until its career panel closes or changes. */
export class AreaPanelTransition
{
    constructor(game, { panel, position, target, delay, enter = () => {}, leave = () => {} })
    {
        Object.assign(this, { game, panel, position, target, delay, enter, leave })
        this.active = false
    }

    open()
    {
        const ui = this.game.career.ui
        if(this.active || this.game.view.cinematic.active || ui.panel || ui.dialogue || ui.menuOpen || ui.touring)
            return

        this.active = true
        this.ui = ui
        this.onPanel = name => { if(name !== this.panel) this.close() }
        ui.events.on('panel', this.onPanel)
        ui.takeInputs()
        this.game.inputs.interactiveButtons.clearItems()
        this.game.inputs.interactiveButtons.addItems([ 'close' ])
        this.restorePoints = !this.game.interactivePoints.temporaryHidden
        if(this.restorePoints)
            this.game.interactivePoints.temporaryHide()
        this.game.view.cinematic.start(this.position, this.target)
        this.enter()

        // Let the original 1.5-second camera move finish before covering it with a panel.
        this.pending = this.delay(1.5, () =>
        {
            this.pending = null
            if(!this.active)
                return
            try { ui.openPanel(this.panel) }
            catch(error) { this.close(); throw error }
        })
    }

    cancel()
    {
        if(!this.active)
            return
        if(this.ui.panel?.name === this.panel)
            this.ui.closePanel()
        else
            this.close()
    }

    close()
    {
        if(!this.active)
            return
        this.active = false
        this.pending?.kill()
        this.pending = null
        this.ui.events.off('panel', this.onPanel)
        this.game.view.cinematic.end()
        this.leave()
        this.game.inputs.interactiveButtons.removeItems([ 'close' ])
        // CareerUI retains input ownership if the user switched into another panel.
        this.ui.releaseInputs()
        if(this.restorePoints)
            this.game.interactivePoints.recover()
    }
}
