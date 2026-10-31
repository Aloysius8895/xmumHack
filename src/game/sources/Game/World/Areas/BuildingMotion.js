/** Use game time so the machinery stays consistent across frame rates and pauses. */
export function updateBuildingMotion(effects, elapsed)
{
    if(effects.oven)
        effects.oven.blower.scale.y = Math.sin(elapsed) * 0.2 + 0.8
    if(effects.grinder)
        effects.grinder.rotation.z = -elapsed * 0.75
    if(effects.anvil)
    {
        const time = elapsed * effects.anvil.frequency + Math.PI * 0.25
        effects.anvil.hammer.rotation.x = Math.pow(1 - Math.abs(Math.sin(time)), 5) - 1
    }
}
