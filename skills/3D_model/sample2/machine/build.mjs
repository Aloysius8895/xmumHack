// Assembles apartment.html: the page head, the Machine kit (inlined, unchanged), the shared daylight
// model (../shared/daylight.mjs, wrapped as DL) and the apartment source (src/apartment.js).
//   node machine/build.mjs        (from sample2/) or  node build.mjs  (from machine/)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(HERE, p), 'utf8').replace(/\r\n/g, '\n')
const kit = read('../../machine/kit/lab-kit.js')
const shared = read('../shared/daylight.mjs')
const names = [...shared.matchAll(/^export\s+(?:const|function)\s+(\w+)/gm)].map((m) => m[1])
const DL = `const DL = (() => {\n${shared.replace(/^export\s+/gm, '')}\nreturn { ${names.join(', ')} }\n})()`
const src = read('src/apartment.js')
const head = read('src/head.html')
const safe = (s) => s.replace(/<\/script/gi, '<\\/script')

const html = `${head}
<body>
<!-- lab-kit:start -->
<script type="module">
${safe(kit)}
</script>
<!-- lab-kit:end -->
<script type="module">
// ------------------------------------------------------------------ shared daylight model (../shared/daylight.mjs)
${safe(DL)}
// ------------------------------------------------------------------ the apartment (src/apartment.js)
${safe(src)}
</script>
</body>
</html>
`
writeFileSync(join(HERE, 'apartment.html'), html)
console.log(`wrote apartment.html (${(html.length / 1024).toFixed(0)} KB, shared exports: ${names.length})`)
