import * as THREE from 'three/webgpu'
import { GridNavigation } from './GridNavigation.js'

/** Click navigation for the retained original terrain, using its actual static colliders. */
export class MapClickMove
{
    constructor(game)
    {
        this.game=game
        this.path=[]
        this.stuck=0
        this.raycaster=new THREE.Raycaster()
        this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0)
        const rows=129,size=192,step=size/(rows-1),levels=new Float32Array(rows*rows)
        const ray=new game.RAPIER.Ray({x:0,y:20,z:0},{x:0,y:-1,z:0})
        for(let j=0;j<rows;j++)for(let i=0;i<rows;i++)
        {
            const x=i*step-size/2,z=j*step-size/2,b=game.mapBounds
            if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ){levels[j*rows+i]=-2;continue}
            ray.origin.x=x;ray.origin.z=z
            const hit=game.physics.world.castRay(ray,24,true,game.RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC)
            levels[j*rows+i]=hit?20-hit.timeOfImpact:-2
        }
        this.height=(x,z)=>
        {
            const u=THREE.MathUtils.clamp((x+96)/step,0,rows-1),v=THREE.MathUtils.clamp((z+96)/step,0,rows-1)
            const i=Math.min(rows-2,Math.floor(u)),j=Math.min(rows-2,Math.floor(v)),a=u-i,b=v-j
            return (levels[j*rows+i]*(1-a)+levels[j*rows+i+1]*a)*(1-b)+(levels[(j+1)*rows+i]*(1-a)+levels[(j+1)*rows+i+1]*a)*b
        }
        this.navigation=new GridNavigation({height:this.height,data:{size,trees:[],buildings:[],bounds:game.mapBounds,minimumHeight:-.2,maximumHeight:.7}})
        this.marker=new THREE.Mesh(new THREE.RingGeometry(.28,.4,32),new THREE.MeshBasicNodeMaterial({color:'#fff2a0',side:THREE.DoubleSide}))
        this.marker.rotation.x=-Math.PI/2;this.marker.visible=false
        game.scene.add(this.marker)
        game.canvasElement.addEventListener('pointerdown',event=>{this.down=event.button===0?{x:event.clientX,y:event.clientY}:null})
        game.canvasElement.addEventListener('pointerup',event=>
        {
            const down=this.down;this.down=null
            if(!down||event.button!==0||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5||!this.enabled()||game.rayCursor.isAnyIntersecting)return
            const rect=game.canvasElement.getBoundingClientRect()
            this.raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),game.view.camera)
            const target=this.raycaster.ray.intersectPlane(this.plane,new THREE.Vector3())
            if(target)this.goTo(target)
        })
    }

    enabled(){return this.game.inputs.filters.size===1&&this.game.inputs.filters.has('wandering')&&this.game.player.state===1}
    cancel(){this.path=[];this.marker.visible=false;this.stuck=0}
    goTo(target)
    {
        const b=this.game.mapBounds
        if(target.x<b.minX||target.x>b.maxX||target.z<b.minZ||target.z>b.maxZ||this.height(target.x,target.z)<-.2){this.cancel();return false}
        this.path=this.navigation.findPath(this.game.player.position,target)
        const end=this.path.at(-1)
        this.marker.visible=!!end
        if(end)this.marker.position.set(end.x,this.height(end.x,end.z)+.12,end.z)
        this.lastPosition=this.game.player.position.clone();this.stuck=0
        // The pointer press detached the camera (map drag), follow the player again like keyboard moves do
        if(this.path.length)this.game.view.focusPoint.isTracking=true
        return this.path.length>0
    }
    update(player)
    {
        if(!this.enabled()||player.move.lengthSq()>.001||this.game.physicalVehicle.knockState!=='none'){this.cancel();return}
        while(this.path.length&&Math.hypot(this.path[0].x-player.position.x,this.path[0].z-player.position.z)<.32)this.path.shift()
        if(!this.path.length){this.cancel();return}
        player.move.set(this.path[0].x-player.position.x,this.path[0].z-player.position.z).normalize()
        this.stuck=this.lastPosition.distanceTo(player.position)<.002?this.stuck+this.game.ticker.delta:0
        this.lastPosition.copy(player.position)
        if(this.stuck>2.5)this.cancel()
    }
}
