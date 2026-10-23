/** DeepSeek accepts image/text blocks. PDF document blocks need server-side text extraction. */
const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_PDF_PAGES = 40
const MAX_PDF_TEXT = 60000

function unreadablePdf()
{
    return Object.assign(new Error('PDF must contain readable text and fit within 10 MB, 40 pages and 60,000 characters. Upload page images or paste text for scanned PDFs.'), { code: 'ai-no-pdf' })
}

async function pdfText(source)
{
    if(source?.type !== 'base64' || source.media_type !== 'application/pdf' || typeof source.data !== 'string' || source.data.length > Math.ceil(MAX_PDF_BYTES / 3) * 4)
        throw unreadablePdf()
    const data = Buffer.from(source.data, 'base64')
    if(data.length > MAX_PDF_BYTES || !data.subarray(0, 5).equals(Buffer.from('%PDF-')))
        throw unreadablePdf()
    let parser
    try
    {
        const { PDFParse } = await import('pdf-parse')
        parser = new PDFParse({ data: new Uint8Array(data), isEvalSupported: false })
        const info = await parser.getInfo()
        if(info.total > MAX_PDF_PAGES)
            throw unreadablePdf()
        const result = await parser.getText()
        const text = result.pages.map((page) => page.text).join('\n').trim()
        if(!text || text.length > MAX_PDF_TEXT)
            throw unreadablePdf()
        return `<attached_pdf>\n${text}\n</attached_pdf>`
    }
    catch
    {
        throw unreadablePdf()
    }
    finally
    {
        if(parser)
            await parser.destroy().catch(() => {})
    }
}

export async function deepseekInput(content)
{
    if(!Array.isArray(content))
        return content
    return Promise.all(content.map(async (block) => block.type === 'document' ? { type: 'text', text: await pdfText(block.source) } : block))
}
