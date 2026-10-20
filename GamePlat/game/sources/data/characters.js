/**
 * Characters placed in the world (see sources/Game/World/Characters.js)
 *
 * name         Unique id, also used in the debug panel and console
 * model        GLB path inside static/ (optional, a placeholder is shown until the file exists)
 * position     { x, z } absolute world position (copy it from the debug panel: open the game with #debug)
 * respawn      Or place relative to a respawn point: landing, cookie, altar, bonfire, projects, lab, career,
 *              social, bridge, toilet, controls, bowling, onlyFans, circuit, timeMachine, behindTheScene, achievements
 * offset       { x, z } metres added to the respawn position
 * rotation     Degrees around the vertical axis (0 = facing +Z)
 * height       Metres, the model is scaled to this height
 * animation    Clip to loop (matched by name, case insensitive), first clip if not found
 * collider     Vehicle bumps into the character
 * placeholder  Colors of the placeholder figure
 */
export default [
    {
        name: 'shinchan',
        model: 'characters/shinchan/shinchan.glb',
        respawn: 'landing',
        offset: { x: 4.5, z: - 3.5 },
        rotation: 45,
        height: 1.3,
        animation: 'walk',
        collider: true,
        placeholder: { skin: '#ffd9b8', hair: '#1c1c1c', shirt: '#e8322f', shorts: '#ffd23f', shoes: '#ffd23f' },
    },
]
