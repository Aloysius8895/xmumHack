import * as THREE from 'three/webgpu'
import { IslandNavigation } from './IslandNavigation.js'

export class ClickMove
{
    constructor(game)
    {
        this.game=game
        this.navigation=new IslandNavigation(game.island)
        this.path=[]
        this.ray=new THREE.Raycaster()
        this.pointer=new THREE.Vector2()
        this.marker=new THREE.Mesh(new THREE.RingGeometry(.28,.40,32),new THREE.MeshBasicNodeMaterial({color:'#fff2a0',side:THREE.DoubleSide}))
        this.marker.rotation.x=-Math.PI/2
        this.marker.visible=false
        game.scene.add(this.marker)
        game.canvasElement.addEventListener('pointerdown',e=>{this.down=e.button===0?{x:e.clientX,y:e.clientY}:null})
        game.canvasElement.addEventListener('pointerup',e=>
        {
            const down=this.down;this.down=null
            if(!down||e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||!this.enabled()||game.rayCursor.isAnyIntersecting)return
            const rect=game.canvasElement.getBoundingClientRect()
            this.pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2)
            this.ray.setFromCamera(this.pointer,game.view.camera)
            const hit=this.ray.intersectObject(game.world.floor.mesh,true)[0]
            if(!hit)return
            let ground=hit.object
            while(ground&&ground.name!=='ReferenceIslandGround')ground=ground.parent
            if(!ground||hit.point.y<.1)return
            this.goTo(hit.point)
        })
        game.physicalVehicle.events.on('respawn',()=>this.cancel())
    }

    enabled() {return this.game.inputs.filters.size===1&&this.game.inputs.filters.has('wandering')&&this.game.player.state===1}
    cancel() {this.path=[];this.marker.visible=false;this.stuck=0}
    goTo(target)
    {
        this.path=this.navigation.findPath(this.game.player.position,target)
        const end=this.path.at(-1)
        this.marker.visible=!!end
        if(end)this.marker.position.set(end.x,this.game.island.height(end.x,end.z)+.13,end.z)
        this.lastPosition=this.game.player.position.clone();this.stuck=0
        return this.path.length>0
    }
    update(player)
    {
        if(!this.enabled()||player.move.lengthSq()>.001||this.game.physicalVehicle.knockState!=='none'){this.cancel();return}
        while(this.path.length&&Math.hypot(this.path[0].x-player.position.x,this.path[0].z-player.position.z)<.32)this.path.shift()
        if(!this.path.length){this.cancel();return}
        const next=this.path[0]
        player.move.set(next.x-player.position.x,next.z-player.position.z).normalize()
        this.stuck=this.lastPosition.distanceTo(player.position)<.002?this.stuck+this.game.ticker.delta:0
        this.lastPosition.copy(player.position)
        if(this.stuck>2.5)this.cancel()
    }
}
