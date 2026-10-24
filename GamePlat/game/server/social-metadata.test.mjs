import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const html = fs.readFileSync(new URL('../sources/index.html', import.meta.url), 'utf8')
const head = html.split('</head>')[0]

test('public metadata identifies CareerSphere, not the original portfolio', () => {
    assert.match(head, /<title>CareerSphere<\/title>/)
    for(const field of ['og:title', 'og:site_name', 'twitter:title'])
        assert.ok(head.includes(`="${field}" content="CareerSphere"`))
    assert.doesNotMatch(head, /bruno|creative portfolio|Three\.js Journey/i)
    assert.ok(head.includes('property="og:url" content="https://xmum-hackfinal.replit.app/"'))
})

test('share previews use a local CareerSphere PNG with declared dimensions', () => {
    const image = 'https://xmum-hackfinal.replit.app/social/careersphere-share.png'
    for(const field of ['og:image', 'twitter:image', 'image'])
        assert.ok(head.includes(`="${field}" content="${image}"`))
    const png = fs.readFileSync(new URL('../static/social/careersphere-share.png', import.meta.url))
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(png.readUInt32BE(16), 1200)
    assert.equal(png.readUInt32BE(20), 630)
})

test('installed app name matches CareerSphere while source attribution is retained', () => {
    const manifest = JSON.parse(fs.readFileSync(new URL('../static/favicons/site.webmanifest', import.meta.url), 'utf8'))
    assert.equal(manifest.name, 'CareerSphere')
    assert.equal(manifest.short_name, 'CareerSphere')
    assert.match(head, /name="apple-mobile-web-app-title" content="CareerSphere"/)
    assert.match(html, /foundation is adapted from Bruno Simon/)
})
