const INK = '#4e2818'
const FONT = '"Pally-Bold", Georgia, "Microsoft YaHei", serif'
const MEDALS = ['#d8a347', '#bcb7ad', '#bb7a4e']

function star(context, x, y, radius)
{
    context.beginPath()
    for(let i = 0; i < 8; i++)
    {
        const angle = - Math.PI / 2 + i * Math.PI / 4
        const length = i % 2 ? radius * 0.3 : radius
        context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
    }
    context.closePath()
    context.fill()
}

function medal(context, rank, y)
{
    const x = 128
    context.fillStyle = MEDALS[rank]
    context.strokeStyle = '#7b502c'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(x - 23, y + 20)
    context.lineTo(x - 30, y + 57)
    context.lineTo(x - 10, y + 46)
    context.lineTo(x + 2, y + 56)
    context.lineTo(x + 22, y + 21)
    context.closePath()
    context.fill()
    context.stroke()
    context.beginPath()
    for(let i = 0; i < 32; i++)
    {
        const angle = i * Math.PI / 16
        const radius = i % 2 ? 34 : 39
        context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
    }
    context.closePath()
    context.fill()
    context.stroke()
    context.beginPath()
    context.arc(x, y, 28, 0, Math.PI * 2)
    context.stroke()
    context.fillStyle = INK
    context.font = 'bold 42px Georgia, serif'
    context.textAlign = 'center'
    context.fillText(String(rank + 1), x, y + 2)
}

function fittedText(context, text, x, y, width, size = 39)
{
    let fontSize = size
    context.font = `700 ${fontSize}px ${FONT}`
    while(fontSize > 29 && context.measureText(text).width > width)
        context.font = `700 ${--fontSize}px ${FONT}`

    const characters = Array.from(text)
    if(context.measureText(text).width > width)
    {
        while(characters.length && context.measureText(`${characters.join('')}…`).width > width)
            characters.pop()
        text = `${characters.join('')}…`
    }
    context.fillText(text, x, y)
    return text
}

/** Paint changing data directly on the ink document; the generated paper contains no sample players. */
export function paintRankings(context, rows, { portrait, emptyLabel, unnamedLabel })
{
    const painted = []
    context.save()
    context.textBaseline = 'middle'
    for(let rank = 0; rank < 3; rank++)
    {
        const row = rows[rank]
        const y = 472 + rank * 137
        medal(context, rank, y)

        // A portrait token for known game characters, otherwise the person's initial.
        const image = row ? portrait(row) : null
        context.fillStyle = '#e5c48d'
        context.strokeStyle = '#a07748'
        context.lineWidth = 2
        context.beginPath()
        context.arc(236, y, 36, 0, Math.PI * 2)
        context.fill()
        context.stroke()
        context.save()
        context.clip()
        if(image)
            context.drawImage(image, 197, y - 39, 78, 78)
        else
        {
            context.fillStyle = row ? INK : '#af9670'
            context.font = `700 35px ${FONT}`
            context.textAlign = 'center'
            context.fillText(row ? Array.from(row.name || unnamedLabel)[0] : '·', 236, y)
        }
        context.restore()

        context.fillStyle = row ? INK : '#947852'
        context.textAlign = 'left'
        const name = fittedText(context, String(row?.name || (row ? unnamedLabel : emptyLabel)), 300, y, 368)
        const points = row && Number.isFinite(row.points) ? Math.max(0, Math.round(row.points)) : 0
        const score = row ? new Intl.NumberFormat('en', points >= 1e6 ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(points) : '—'
        context.textAlign = 'right'
        fittedText(context, score, 884, y, 172, 38)
        context.fillStyle = rank === 0 ? '#bd822c' : '#875b32'
        star(context, 915, y, 11)

        if(rank === 0 && row)
        {
            context.strokeStyle = '#ce973c'
            context.lineWidth = 4
            context.beginPath()
            context.moveTo(300, y + 31)
            context.quadraticCurveTo(463, y + 35, 660, y + 30)
            context.stroke()
        }
        if(rank < 2)
        {
            context.strokeStyle = '#a47d4c'
            context.lineWidth = 1
            context.beginPath()
            context.moveTo(88, y + 76)
            context.lineTo(937, y + 75)
            context.stroke()
        }
        painted.push({ name, score, empty: !row })
    }
    context.restore()
    return painted
}

/** Small pinned guild notices, drawn as simple ink marks rather than additional UI. */
export function createQuestNotice(symbol, lavender = false)
{
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 320
    const context = canvas.getContext('2d')
    const paper = context.createLinearGradient(0, 10, 230, 315)
    paper.addColorStop(0, lavender ? '#e4c9d7' : '#f7e4b9')
    paper.addColorStop(1, lavender ? '#bca2ba' : '#dfbf8d')
    context.fillStyle = paper
    context.beginPath()
    context.moveTo(18, 24)
    context.lineTo(223, 17)
    context.lineTo(239, 295)
    context.lineTo(160, 291)
    context.lineTo(87, 299)
    context.lineTo(12, 290)
    context.closePath()
    context.fill()
    context.strokeStyle = '#84624e'
    context.fillStyle = '#84624e'
    context.lineWidth = 5
    context.lineCap = 'round'
    if(symbol === 'potion')
    {
        context.beginPath()
        context.moveTo(108, 88)
        context.lineTo(108, 120)
        context.bezierCurveTo(55, 148, 69, 201, 128, 200)
        context.bezierCurveTo(188, 201, 202, 148, 147, 120)
        context.lineTo(147, 88)
        context.closePath()
        context.fillStyle = '#9585ad'
        context.fill()
        context.stroke()
        context.strokeRect(103, 78, 49, 14)
        context.fillStyle = '#f8e9c9'
        star(context, 130, 163, 19)
    }
    else if(symbol === 'leaf')
    {
        context.beginPath()
        context.moveTo(100, 195)
        context.quadraticCurveTo(150, 140, 144, 90)
        context.stroke()
        context.fillStyle = '#8e9a70'
        for(let i = 0; i < 4; i++)
        {
            const x = 113 + i * 9, y = 169 - i * 22
            context.beginPath()
            context.ellipse(x + (i % 2 ? 16 : - 10), y - 10, 12, 24, i % 2 ? 0.65 : - 0.7, 0, Math.PI * 2)
            context.fill()
            context.stroke()
        }
    }
    else
    {
        star(context, 128, 140, 49)
        context.beginPath()
        context.arc(128, 140, 61, 0, Math.PI * 2)
        context.lineWidth = 2
        context.stroke()
    }
    context.strokeStyle = '#92725e'
    context.lineWidth = 3
    for(let i = 0; i < 3; i++)
    {
        const y = 230 + i * 16
        context.beginPath()
        context.moveTo(55, y)
        context.bezierCurveTo(91, y - 5, 145, y + 7, 197 - i * 13, y - 2)
        context.stroke()
    }
    context.fillStyle = '#a76d36'
    context.beginPath()
    context.arc(125, 31, 11, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#edbf70'
    context.beginPath()
    context.arc(122, 27, 4, 0, Math.PI * 2)
    context.fill()
    return canvas
}
