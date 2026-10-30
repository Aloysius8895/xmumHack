/** Pure navigation grid. The visual/collision terrain share the sampled height source. */
export class IslandNavigation
{
    constructor(island)
    {
        this.island = island
        this.cell = 1.5
        this.rows = Math.round(island.data.size / this.cell) + 1
        this.half = island.data.size / 2
        this.blocked = new Uint8Array(this.rows * this.rows)
        this.levels = new Float32Array(this.blocked.length)
        const buildings = island.data.buildings ?? []
        const trees = island.data.trees
        for(let j = 0; j < this.rows; j++) for(let i = 0; i < this.rows; i++)
        {
            const x=i*this.cell-this.half,z=j*this.cell-this.half,k=j*this.rows+i
            const h=island.height(x,z)
            this.levels[k]=h
            const slope=Math.hypot(island.height(x+.5,z)-island.height(x-.5,z),island.height(x,z+.5)-island.height(x,z-.5))
            this.blocked[k]=h<.10 || slope>.62
                || buildings.some(b=>Math.abs(x-b.x)<b.width/2+.65 && Math.abs(z-b.z)<b.depth/2+.65)
                || trees.some(t=>Math.hypot(x-t.x,z-t.z)<1.05)
        }
    }

    coordinates(k) { return {x:(k%this.rows)*this.cell-this.half,z:Math.floor(k/this.rows)*this.cell-this.half} }

    closest(x,z)
    {
        let result=-1,best=Infinity
        const ix=Math.round((x+this.half)/this.cell),iz=Math.round((z+this.half)/this.cell)
        for(let dz=-3;dz<=3;dz++) for(let dx=-3;dx<=3;dx++)
        {
            const i=ix+dx,j=iz+dz,k=j*this.rows+i
            if(i<0||j<0||i>=this.rows||j>=this.rows||this.blocked[k]) continue
            const p=this.coordinates(k),d=Math.hypot(p.x-x,p.z-z)
            if(d<best) {best=d;result=k}
        }
        return result
    }

    findPath(from,to)
    {
        const start=this.closest(from.x,from.z),goal=this.closest(to.x,to.z)
        if(start<0||goal<0) return []
        const costs=new Float32Array(this.blocked.length).fill(Infinity)
        const previous=new Int32Array(this.blocked.length).fill(-1)
        const closed=new Uint8Array(this.blocked.length)
        const heap=[]
        const push=(k,f)=>{let i=heap.length;heap.push([k,f]);while(i){const p=(i-1)>>1;if(heap[p][1]<=f)break;heap[i]=heap[p];i=p}heap[i]=[k,f]}
        const pop=()=>{const best=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[i]=heap[c];i=c}heap[i]=last}return best[0]}
        const end=this.coordinates(goal)
        costs[start]=0;push(start,0)
        while(heap.length)
        {
            const k=pop()
            if(closed[k])continue
            if(k===goal)
            {
                const path=[]
                for(let node=goal;node!==-1;node=previous[node])path.push(this.coordinates(node))
                return path.reverse()
            }
            closed[k]=1
            const i=k%this.rows,j=Math.floor(k/this.rows)
            for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)
            {
                if(!dx&&!dz)continue
                const x=i+dx,z=j+dz,n=z*this.rows+x
                if(x<0||z<0||x>=this.rows||z>=this.rows||this.blocked[n]||closed[n])continue
                if(dx&&dz&&(this.blocked[j*this.rows+x]||this.blocked[z*this.rows+i]))continue
                const length=Math.hypot(dx,dz)*this.cell,rise=Math.abs(this.levels[n]-this.levels[k])
                if(rise/length>.62)continue
                const next=costs[k]+length+rise*2
                if(next>=costs[n])continue
                costs[n]=next;previous[n]=k
                const p=this.coordinates(n)
                push(n,next+Math.hypot(p.x-end.x,p.z-end.z))
            }
        }
        return []
    }
}
