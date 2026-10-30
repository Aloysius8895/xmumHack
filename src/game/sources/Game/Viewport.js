import { Events } from './Events.js'
import { Game } from './Game.js'

export class Viewport
{
    constructor(domElement)
    {
        this.domElement = domElement

        this.events = new Events()
        this.quality = Game.getInstance().quality
        
        this.measure()
        this.setResize()
        this.quality.events.on('change', () =>
        {
            this.measure()
            this.events.trigger('change')
        })
    }

    measure()
    {
        const bounding = this.domElement.getBoundingClientRect()

        this.width = bounding.width
        this.height = bounding.height
        this.ratio = this.width / this.height

        this.pixelRatioPure = window.devicePixelRatio
        this.pixelRatioMax = this.quality.level === 0 ? 2 : 1
        this.pixelRatio = Math.min(this.pixelRatioPure, this.pixelRatioMax)
    }

    setResize()
    {
        const throttleDuration = 400
        let throttleTimeout = null
        addEventListener('resize', () =>
        {
            this.measure()
            this.events.trigger('change')

            if(throttleTimeout)
            {
                clearTimeout(throttleTimeout)
            }

            throttleTimeout = setTimeout(() =>
            {
                throttleTimeout = null
                this.events.trigger('throttleChange')
            }, throttleDuration)
        })
    }
}
