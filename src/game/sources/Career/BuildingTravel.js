// Shared by the menu and building entrances. Browser-only code: no OS-specific paths or commands.
export const BUILDING_DESTINATIONS = Object.freeze({
    profile: 'lab',
    careers: 'career',
    market: 'projects',
    pet: 'cookie',
    roadmap: 'behindTheScene',
    sdg: 'altar',
    log: 'achievements',
    leaderboard: 'landing',
    settings: 'social',
})

export function travelToBuilding(game, ui, panel)
{
    const entrances = game.career?.buildingEntrances
    const station = entrances?.stations.get(panel)
    if(!station || ui.touring) return false
    // Already inside the exhibit: change its content without showing the map in between.
    if(entrances.visit.active)
    {
        ui.openPanel(panel)
        return true
    }
    if(game.view.cinematic.active) return false
    ui.closeDialogue()
    if(ui.panel) ui.closePanel()
    ui.setMenuOpen(false)
    game.modals.close()
    // No player movement, respawn or intermediate map stop. The exhibit owns just the camera.
    return entrances.visit.open(station, { direct: true })
}

/** Leave the display at the current category's entrance, without reloading the intro or resetting progress. */
export function leaveAtBuilding(game, panel)
{
    const station = game.career?.buildingEntrances?.stations.get(panel)
    const spawn = station && game.respawns.items.get(station.building)
    if(!station || !spawn) return false
    const position = { x: station.position.x + 1, y: spawn.position.y, z: station.position.z + 1 }
    game.clickMove?.cancel()
    game.physicalVehicle.moveTo(position, Math.PI * 0.75)
    game.player.state = 1
    const focus = game.view.focusPoint
    focus.isTracking = true
    if(focus.position)
    {
        focus.position.x = position.x
        focus.position.z = position.z
        focus.smoothedPosition?.copy(focus.position)
    }
    if(game.career.world?.pet) game.career.world.pet.placed = false
    return true
}
