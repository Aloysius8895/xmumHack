import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWorkflow, checkCoverage } from './market/build-workflow.mjs'
import { buildTelegramWorkflow, buildDigestWorkflow, writeLearningWorkflows } from './learning/build-workflows.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const problems = checkCoverage()
if(problems.length)
    throw new Error(problems.join('\n'))
const workflows = [ buildWorkflow(), buildTelegramWorkflow(), buildDigestWorkflow() ]
fs.writeFileSync(path.join(here, 'market/market-trends.workflow.json'), JSON.stringify(workflows[0], null, 2) + '\n')
writeLearningWorkflows()

// Only diagram metadata, not the embedded pipeline source or any credentials.
const diagrams = workflows.map((workflow) => ({
    name: workflow.name,
    nodes: workflow.nodes.filter((node) => !node.type.endsWith('stickyNote')).map((node) => ({ name: node.name, type: node.type.split('.').at(-1), position: node.position, detail: node.parameters.url ?? node.parameters.errorMessage ?? node.parameters.rule?.interval?.[0]?.expression ?? '' })),
    connections: workflow.connections,
}))
const descriptions = [
    '每周一 08:00：按项目的 6 个职业搜索马来西亚职位 → 过滤国家、职位和重复 ID → 检查全部查询 → 推送游戏并保存历史。部分失败走告警分支，保留上次数据。新增 ID 与本周样本数分开统计。',
    '接收 Telegram 私聊 → 校验演示玩家 ID → 分离文字、确认按钮和附件 → 转发给已有 chatbot。chatbot 负责 AI 分类、游戏记账、去重和回复，附件返回仅支持文字的提示。',
    '每天 00:05（马来西亚）：取昨天 → 读取演示玩家已成功提交的汇报 → 原文摘录 → 保存总结。无记录跳过；skills 为空，不额外加熟练度或积分。',
]
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CareerSphere · n8n 工作流总览</title>
<style>*{box-sizing:border-box}body{margin:0;background:#101725;color:#edf3ff;font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1440px;margin:auto;padding:36px 24px}h1{font-size:30px;margin:0}p{color:#b6c7df;max-width:1000px}nav{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}button{border:1px solid #4d6586;border-radius:8px;background:#1c2b42;color:#edf3ff;padding:10px 18px;cursor:pointer}button[aria-selected=true]{background:#245b72;border-color:#6edcc3}.toolbar{display:flex;align-items:center;gap:12px;margin:12px 0}.canvas{overflow:auto;border:1px solid #3c516b;border-radius:12px;background:#142033}svg{display:block}svg g{cursor:pointer}svg g:focus rect{stroke:#fff;stroke-width:3}.detail{padding:14px;border-left:3px solid #6edcc3;margin-top:18px;background:#1c2b42;min-height:70px}code{color:#85e4cd}a{color:#85d4ff}.tag{font-size:13px;color:#85e4cd}.files{overflow-wrap:anywhere;font-size:14px}#description{min-height:56px}.tip{font-size:14px}footer{margin-top:26px;color:#a9bdd4}</style></head>
<body><main><span class="tag">CAREERSPHERE / PROJECT WORKFLOWS</span><h1>你的 n8n 工作流</h1><p>根据现有职业游戏和 chatbot 生成。这里是离线交互总览；实际配置凭证、执行节点及查看数据，请将 JSON 导入 n8n。</p>
<nav id="tabs" aria-label="选择工作流"></nav><p id="description"></p><div class="toolbar"><button id="fit">适应宽度</button><button id="actual">原始大小</button><span class="tip">点击节点查看类型和接口；横向滚动查看完整流程。IF 上方为 true，下方为 false。</span></div><div class="canvas" id="canvas"></div><div class="detail" id="detail" aria-live="polite">点击一个节点查看信息。</div>
<p class="files">导入文件：<a href="market/market-trends.workflow.json">招聘市场 JSON</a> · <a href="learning/telegram-learning.workflow.json">Telegram JSON</a> · <a href="learning/daily-digest.workflow.json">每日总结 JSON</a> · <a href="README.md">配置说明</a></p>
<footer>时区：Asia/Kuala_Lumpur · 3 份 JSON 默认未激活 · 基于模板 #10918 / #9254 的思路适配项目 · 月度 trends 接口独立，不能把每周样本相加当作月度招聘总数。</footer></main>
<script>const flows=${JSON.stringify(diagrams).replaceAll('<', '\\u003c')};const descriptions=${JSON.stringify(descriptions)};
const NS='http://www.w3.org/2000/svg';let selected=0;let actual=false;const labels=['招聘市场','Telegram 学习汇报','每日总结'];
function el(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))n.setAttribute(key,value);if(text!==undefined)n.textContent=text;return n;}
function draw(){const flow=flows[selected];document.getElementById('description').textContent=descriptions[selected];const nodes=new Map(flow.nodes.map(n=>[n.name,n]));const minX=Math.min(...flow.nodes.map(n=>n.position[0]))-35;const minY=Math.min(...flow.nodes.map(n=>n.position[1]))-70;const width=Math.max(...flow.nodes.map(n=>n.position[0]))-minX+250;const height=Math.max(...flow.nodes.map(n=>n.position[1]))-minY+145;const svg=el('svg',{viewBox:[minX,minY,width,height].join(' '),width:actual?width:'100%',role:'img','aria-label':flow.name});if(!actual)svg.style.minWidth='800px';const defs=el('defs');const marker=el('marker',{id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});marker.append(el('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#6f91b4'}));defs.append(marker);svg.append(defs);
for(const [from,outputs]of Object.entries(flow.connections)){const a=nodes.get(from);if(!a)continue;outputs.main.forEach((links,index)=>links.forEach(link=>{const b=nodes.get(link.node);if(!b)return;const x=a.position[0]+190,y=a.position[1]+38+(outputs.main.length>1?(index?12:-12):0),xx=b.position[0],yy=b.position[1]+38;svg.append(el('path',{d:'M '+x+' '+y+' C '+(x+45)+' '+y+' '+(xx-45)+' '+yy+' '+xx+' '+yy,fill:'none',stroke:index?'#dbab75':'#6f91b4','stroke-width':2,'marker-end':'url(#arrow)'}));}));}
for(const n of flow.nodes){const [x,y]=n.position;const g=el('g',{tabindex:0,role:'button','aria-label':n.name});g.append(el('rect',{x,y,width:190,height:76,rx:10,fill:n.type==='if'?'#4a3b2b':n.type==='httpRequest'?'#173d48':'#263753',stroke:n.type==='if'?'#dbab75':'#6edcc3'}));const words=n.name.split(' ');let lines=[''];for(const word of words){if((lines[lines.length-1]+' '+word).trim().length>25)lines.push(word);else lines[lines.length-1]=(lines[lines.length-1]+' '+word).trim();}lines.slice(0,2).forEach((line,i)=>g.append(el('text',{x:x+12,y:y+24+i*17,fill:'#edf3ff','font-size':13},line)));g.append(el('text',{x:x+12,y:y+64,fill:'#a9bdd4','font-size':11},n.type));const show=()=>{document.getElementById('detail').textContent=n.name+' · '+n.type+(n.detail?' · '+n.detail:'');};g.addEventListener('click',show);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});svg.append(g);}document.getElementById('canvas').replaceChildren(svg);document.querySelectorAll('#tabs button').forEach((button,i)=>button.setAttribute('aria-selected',String(i===selected)));}
labels.forEach((label,i)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{selected=i;document.getElementById('detail').textContent='点击一个节点查看信息。';draw();};document.getElementById('tabs').append(b);});document.getElementById('fit').onclick=()=>{actual=false;draw();};document.getElementById('actual').onclick=()=>{actual=true;draw();};draw();</script></body></html>`
fs.writeFileSync(path.join(here, 'overview.html'), html)
console.log('Built 3 n8n workflows and n8n/overview.html (offline preview).')
