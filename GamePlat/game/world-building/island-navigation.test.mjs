import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { IslandNavigation } from '../sources/Game/Island/IslandNavigation.js'

const data = JSON.parse(readFileSync(new URL('../static/island/island.json',import.meta.url),'utf8'))
const bytes = readFileSync(new URL('../static/island/heights.f32',import.meta.url))
const heights = new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))
const island={data,height(x,z){
    const u=Math.max(0,Math.min(data.rows-1,(x/data.size+.5)*(data.rows-1)))
    const v=Math.max(0,Math.min(data.rows-1,(z/data.size+.5)*(data.rows-1)))
    const i=Math.min(data.rows-2,Math.floor(u)),j=Math.min(data.rows-2,Math.floor(v)),a=u-i,b=v-j,n=data.rows
    return (heights[j*n+i]*(1-a)+heights[j*n+i+1]*a)*(1-b)+(heights[(j+1)*n+i]*(1-a)+heights[(j+1)*n+i+1]*a)*b
}}
const navigation = new IslandNavigation(island)

for(const site of data.sites)test(`port connects to ${site.id} without crossing water or buildings`,()=>{
    const path=navigation.findPath(data.spawn,site)
    assert.ok(path.length>1,'No reachable walking route')
    for(const p of path){
        assert.ok(island.height(p.x,p.z)>=.1)
        assert.ok(!data.buildings.some(b=>Math.abs(p.x-b.x)<b.width/2+.65&&Math.abs(p.z-b.z)<b.depth/2+.65))
    }
    for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i]
        assert.ok(Math.abs(island.height(a.x,a.z)-island.height(b.x,b.z))/Math.hypot(a.x-b.x,a.z-b.z)<=.621)
    }
})
test('offshore clicks do not produce a walking route',()=>assert.deepEqual(navigation.findPath(data.spawn,{x:90,z:90}),[]))
