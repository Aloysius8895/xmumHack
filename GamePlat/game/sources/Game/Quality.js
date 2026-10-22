import { Events } from './Events.js'
import { Game } from './Game.js'

export class Quality
{
    constructor()
    {
        this.game = Game.getInstance()

        this.events = new Events()

        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        this.level = isMobile ? 1 : 0 // 0 = highest quality
        this.manual = false // The player picked a level in the options: never switched automatically

        this.setAuto()

        // Debug
        if(this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({
                title: '⚙️ Quality',
                expanded: false,
            })

            this.game.debug.addButtons(
                debugPanel,
                {
                    low: () =>
                    {
                        this.changeLevel(1)
                    },
                    high: () =>
                    {
                        this.changeLevel(0)
                    },
                },
                'change'
            )
        }
    }

    /**
     * Frame rate watch: high quality that can't hold ~45 fps for a few seconds drops to low quality by itself
     * (no depth of field, smaller shadows and bloom). Starts once the loading spike is over, checks once per second
     */
    setAuto()
    {
        const minimumFps = 45
        const slowSecondsToSwitch = 4
        let slowSeconds = 0
        let frames = 0
        let last = performance.now()

        const tick = (now) =>
        {
            if(this.level !== 0 || this.manual)
                return

            frames++
            if(now - last >= 1000)
            {
                const fps = frames * 1000 / (now - last)
                frames = 0
                last = now

                // Hidden tab or a long hitch (tab switch, shader compile): not a measure of the rendering
                if(!document.hidden && fps > 5)
                    slowSeconds = fps < minimumFps ? slowSeconds + 1 : 0

                if(slowSeconds >= slowSecondsToSwitch)
                {
                    console.info(`Quality > ${Math.round(fps)} fps, switching to low quality`)
                    this.changeLevel(1)
                    return
                }
            }
            requestAnimationFrame(tick)
        }

        setTimeout(() => requestAnimationFrame((now) => { last = now; tick(now) }), 12000)
    }

    changeLevel(level = 0)
    {
        // Same
        if(level === this.level)
            return
            
        this.level = level
        this.events.trigger('change', [ this.level ])
    }
}