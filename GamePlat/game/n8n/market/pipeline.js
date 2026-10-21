/**
 * Job market pipeline: JSearch (Google for Jobs) postings -> POST /api/integrations/market
 *
 * Plain functions with no imports, so the same code runs in three places:
 *   - the n8n Code nodes (build-workflow.mjs inlines this file into market-trends.workflow.json)
 *   - run-local.mjs (fallback runner without n8n)
 *   - pipeline.test.mjs
 *
 * Only counts leave this pipeline: job descriptions are read to count skill keywords and are never stored,
 * so no recruiter names, emails or phone numbers reach the game server.
 *
 * catalog = { careers: [ 'data-analyst', ... ], skills: { sql: { zh, en, ms }, ... } }, generated from server/careers.js
 */

export const DEFAULT_SETTINGS = {
    apiBaseUrl: 'http://localhost:8787',   // game server (Replit deployment URL in production), no trailing slash
    country: 'my',                         // JSearch country code
    datePosted: 'week',                    // JSearch date_posted: all | today | 3days | week | month
    numPages: 2,                           // pages per query (~10 jobs per page)
    timezone: 'Asia/Kuala_Lumpur',
    topSkills: 8,                          // skills kept per career in the push
}

/**
 * Search queries per career id of server/careers.js, plus a title filter: Google for Jobs returns loose matches,
 * only postings whose title fits the career are counted.
 */
export const CAREER_SEARCH = {
    'data-analyst': {
        queries: [ 'data analyst in Malaysia', 'business intelligence analyst in Malaysia' ],
        title: /\b(data|business intelligence|bi|reporting|insights?|business|analytics) analysts?\b|\bdata analytics\b/i,
    },
    'frontend-developer': {
        queries: [ 'frontend developer in Malaysia', 'front end engineer in Malaysia' ],
        title: /\bfront[- ]?end\b|\b(web|ui|react|angular|vue|javascript) (developer|engineer)\b/i,
    },
    'backend-developer': {
        queries: [ 'backend developer in Malaysia', 'backend engineer in Malaysia' ],
        title: /\bback[- ]?end\b|\b(java|node(\.js)?|python|php|golang|go|\.net|api|server[- ]side) (developer|engineer)\b/i,
    },
    'ui-ux-designer': {
        queries: [ 'UI UX designer in Malaysia', 'product designer in Malaysia' ],
        title: /\bui\b|\bux\b|\buser experience\b|\buser interface\b|\bproduct designer\b|\binteraction designer\b/i,
    },
    'ml-engineer': {
        queries: [ 'machine learning engineer in Malaysia', 'AI engineer in Malaysia' ],
        title: /\bmachine learning\b|\bml\b|\bmlops\b|\b(ai|deep learning|computer vision|nlp|llm) (engineer|developer|specialist|scientist)\b|\bdata scientist\b/i,
    },
    'product-manager': {
        queries: [ 'product manager in Malaysia', 'product owner in Malaysia' ],
        title: /\bproduct (manager|owner|lead|management)\b/i,
    },
}

/**
 * Keyword patterns per skill id of server/careers.js (English, the language of most Malaysian postings).
 * A posting counts once per skill however many times the keyword appears.
 */
export const SKILL_PATTERNS = {
    'sql':                /\b(sql|mysql|postgres(ql)?|t-sql|pl\/sql|mssql|sqlite|bigquery)\b/i,
    'excel':              /\b(excel|spreadsheets?|google sheets|vlookup|pivot tables?)\b/i,
    'statistics':         /\b(statistics|statistical|regression|hypothesis testing|a\/b test(ing|s)?)\b/i,
    'python':             /\b(python|pandas|numpy)\b/i,
    'data-cleaning':      /\b(data clean(ing|sing)|data cleansing|data wrangling|data preparation|data quality|etl|elt|data validation)\b/i,
    'data-visualization': /\b(data visuali[sz]ation|power ?bi|tableau|looker|qlik|dashboards?)\b/i,
    'communication':      /\b(communication|stakeholders?|presentation skills?|storytelling)\b/i,
    'html-css':           /\b(html5?|css3?|tailwind|sass|scss)\b/i,
    'javascript':         /\b(javascript|typescript|ecmascript)\b/i,
    'react':              /\bReact(\.?js)?\b|\bNext\.?js\b/,
    'git':                /\b(git|github|gitlab|bitbucket|version control)\b/i,
    'accessibility':      /\b(accessibility|wcag|a11y|responsive (web )?design)\b/i,
    'api-integration':    /\b(api integrations?|third[- ]party apis?|integrat\w* (with )?apis?|consum\w* apis?|graphql)\b/i,
    'backend-language':   /\b(java|node\.?js|golang|php|ruby|django|flask|fastapi|spring boot|express\.?js|nestjs|laravel|kotlin|\.net)\b|(^|[^\w])c#(?=$|[^\w])/i,
    'databases':          /\b(databases?|nosql|mongodb|redis|dynamodb|cassandra|data modell?ing|schema design)\b/i,
    'rest-api':           /\b(rest(ful)? apis?|restful|rest services?|api design|microservices?|openapi|swagger)\b/i,
    'cloud-deploy':       /\b(aws|amazon web services|azure|gcp|google cloud|docker|kubernetes|k8s|ci\/cd|terraform)\b/i,
    'testing':            /\b(unit test(s|ing)?|automated testing|test automation|jest|pytest|junit|cypress|selenium|playwright|tdd|integration tests?)\b/i,
    'user-research':      /\b(user research|user interviews?|ux research|personas?|customer research|user needs)\b/i,
    'prototyping':        /\b(prototyp\w*|wireframe\w*|mock-?ups?)\b/i,
    'figma':              /\b(figma|adobe xd)\b/i,
    'visual-design':      /\b(visual design|ui design|typography|colou?r theory|design systems?|graphic design|photoshop|illustrator)\b/i,
    'usability-testing':  /\b(usability test\w*|user testing|heuristic evaluation)\b/i,
    'ml-math':            /\b(linear algebra|calculus|mathematics|mathematical|optimi[sz]ation)\b/i,
    'ml-frameworks':      /\b(pytorch|tensorflow|keras|scikit-learn|sklearn|hugging ?face|xgboost|lightgbm|jax)\b/i,
    'mlops':              /\b(mlops|model deployment|deploy\w* (ml |machine learning )?models?|mlflow|kubeflow|sagemaker|vertex ai|model monitoring|model serving)\b/i,
    'roadmapping':        /\b(roadmaps?|roadmapping|prioriti[sz]ation|product strategy|product vision|backlog)\b/i,
    'agile':              /\b(agile|scrum|kanban|sprints?|jira)\b/i,
    'market-analysis':    /\b(market (research|analysis)|competitive analysis|competitor analysis|market trends?|go-to-market|customer insights?)\b/i,
}

/**
 * One search per (career, query)
 */
export function buildQueries(settings = DEFAULT_SETTINGS)
{
    const queries = []
    for(const [ careerId, search ] of Object.entries(CAREER_SEARCH))
        for(const query of search.queries)
            queries.push({ careerId, query, country: settings.country, datePosted: settings.datePosted, numPages: settings.numPages })
    return queries
}

/**
 * The job list of a JSearch response, [] for errors or unexpected shapes
 */
export function jobsFrom(body)
{
    if(!body || typeof body !== 'object' || body.error)
        return []
    if(Array.isArray(body.data))
        return body.data
    if(Array.isArray(body.data?.jobs))
        return body.data.jobs
    return []
}

/**
 * Short reason of a failed search: n8n error items ({ error: { message, stack } }), API errors or odd shapes
 */
function errorText(body)
{
    const error = body?.error ?? body
    const status = error?.httpCode ?? String(error?.stack ?? '').match(/status code (\d{3})/)?.[1]
    const message = typeof error === 'string' ? error : error?.message ?? body?.message ?? 'unexpected response'
    return `${status ? `HTTP ${status}: ` : ''}${message}`.slice(0, 200)
}

function textOf(job)
{
    const highlights = job.job_highlights && typeof job.job_highlights === 'object'
        ? Object.values(job.job_highlights).flat().join('\n')
        : ''
    const technologies = Array.isArray(job.required_technologies) ? job.required_technologies.join(', ') : ''
    return [ job.job_title, job.job_description, highlights, technologies ].filter(Boolean).join('\n')
}

/**
 * Skill ids mentioned by a posting
 */
export function extractSkills(text)
{
    const found = []
    for(const [ skillId, pattern ] of Object.entries(SKILL_PATTERNS))
        if(pattern.test(text))
            found.push(skillId)
    return found
}

/**
 * Week of the collection: its Monday in the given time zone, YYYY-MM-DD (the careers panel shows a weekly trend).
 * Runs inside the same week replace that week's snapshot, the server keeps one snapshot per week as history.
 */
export function periodOf(now, timezone)
{
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
    const get = (type) => Number(parts.find((part) => part.type === type).value)
    const day = new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
    day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
    return day.toISOString().slice(0, 10)
}

function windowLabel(datePosted)
{
    return {
        today: { zh: '今天', en: 'today', ms: 'hari ini' },
        '3days': { zh: '近 3 天', en: 'past 3 days', ms: '3 hari lepas' },
        week: { zh: '近 7 天', en: 'past 7 days', ms: '7 hari lepas' },
        month: { zh: '近 30 天', en: 'past 30 days', ms: '30 hari lepas' },
        backfill: { zh: '这周发布且仍在招的职位中', en: 'posted that week and still open', ms: 'disiar minggu itu dan masih dibuka' },
    }[datePosted] ?? { zh: '近期', en: 'recently', ms: 'kebelakangan ini' }
}

function noteFor(career, catalog, settings)
{
    const window = windowLabel(settings.datePosted)
    if(!career.postings)
        return {
            zh: `${window.zh}未找到相符职位（样本来自 JSearch）。`,
            en: `No matching postings found ${window.en} (JSearch sample).`,
            ms: `Tiada jawatan sepadan ${window.ms} (sampel JSearch).`,
        }

    const top = Object.entries(career.topSkills).slice(0, 3)
    const list = (lang) => top.map(([ id, count ]) => `${catalog.skills[id]?.[lang] ?? id} ${Math.round(count / career.postings * 100)}%`).join(lang === 'zh' ? '、' : ', ')
    const capped = career.saturated
    return {
        zh: `${window.zh}抽样 ${career.postings} 个职位${capped ? '（达抽样上限）' : ''}，最常要求：${list('zh') || '无明显技能'}。`,
        en: `${career.postings} postings sampled ${window.en}${capped ? ' (sample cap reached)' : ''}. Most asked: ${list('en') || 'none'}.`,
        ms: `${career.postings} jawatan disampel ${window.ms}${capped ? ' (had sampel dicapai)' : ''}. Paling diminta: ${list('ms') || 'tiada'}.`,
    }
}

/**
 * Turns the search responses into the market push
 * responses: [ { query: { careerId, query }, body: <JSearch JSON or { error }> }, ... ]
 * Returns { payload, report }, payload.careers is empty when every search failed.
 */
export function aggregate(responses, settings, catalog, now = new Date())
{
    const known = new Set(catalog.careers)
    const perPageCap = 10 * settings.numPages
    const state = {}
    const publishers = {}

    for(const { query, body } of responses)
    {
        if(!query || !known.has(query.careerId) || !CAREER_SEARCH[query.careerId])
            continue
        const career = state[query.careerId] ??= { jobs: new Map(), fetched: 0, filtered: 0, failedQueries: [], okQueries: 0, saturated: false }

        const valid = body && !body.error && (Array.isArray(body.data) || Array.isArray(body.data?.jobs))
        if(!valid)
        {
            career.failedQueries.push({ query: query.query, error: errorText(body) })
            continue
        }

        const jobs = jobsFrom(body)
        career.okQueries++
        career.fetched += jobs.length
        if(jobs.length >= perPageCap)
            career.saturated = true

        for(const job of jobs)
        {
            if(!CAREER_SEARCH[query.careerId].title.test(String(job.job_title ?? '')))
            {
                career.filtered++
                continue
            }
            const key = job.job_id || `${job.employer_name}|${job.job_title}|${job.job_city ?? ''}`.toLowerCase()
            if(!career.jobs.has(key))
                career.jobs.set(key, job)
        }
    }

    const careers = {}
    const report = { period: periodOf(now, settings.timezone), careers: {}, failedCareers: [] }

    for(const [ careerId, career ] of Object.entries(state))
    {
        // Every query of this career failed: leave it out so the game keeps its previous value
        if(!career.okQueries)
        {
            report.failedCareers.push({ careerId, failedQueries: career.failedQueries })
            continue
        }

        const skillCounts = {}
        for(const job of career.jobs.values())
        {
            for(const skillId of extractSkills(textOf(job)))
                if(catalog.skills[skillId])
                    skillCounts[skillId] = (skillCounts[skillId] ?? 0) + 1
            const publisher = String(job.job_publisher ?? 'other').trim() || 'other'
            publishers[publisher] = (publishers[publisher] ?? 0) + 1
        }

        const topSkills = Object.fromEntries(
            Object.entries(skillCounts)
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .slice(0, settings.topSkills)
        )
        const summary = { postings: career.jobs.size, topSkills, saturated: career.saturated }
        careers[careerId] = { postings: summary.postings, topSkills, note: noteFor(summary, catalog, settings) }
        report.careers[careerId] = { fetched: career.fetched, kept: career.jobs.size, filteredByTitle: career.filtered, saturated: career.saturated, failedQueries: career.failedQueries }
    }

    const topPublishers = Object.entries(publishers).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ name, count ]) => `${name} ${count}`).join(', ')
    const payload = {
        period: report.period,
        source: `JSearch/Google for Jobs ${settings.country.toUpperCase()} ${settings.datePosted}${topPublishers ? `: ${topPublishers}` : ''}`.slice(0, 120),
        collectedAt: now.toISOString(),
        careers,
    }
    report.publishers = publishers
    return { payload, report }
}

/**
 * Weeks before the first run, rebuilt from one search over the past 30 days (settings.datePosted: 'month'):
 * each posting goes to the week (Monday, settings.timezone) of its job_posted_at_timestamp, and every one of the
 * `weeks` full weeks before the current one becomes a snapshot marked backfilled.
 * Postings already taken down are missing, so the older a week the lower its count: the server and the careers
 * panel never compute a change % against a backfilled week, only the skill shares are comparable.
 * Returns [ { payload, report } ] oldest week first, weeks without any posting left out.
 */
export function backfill(responses, settings, catalog, now = new Date(), weeks = 3)
{
    const current = periodOf(now, settings.timezone)
    const weekSettings = { ...settings, datePosted: 'backfill' }
    const results = []

    for(let index = weeks; index >= 1; index--)
    {
        const monday = new Date(`${current}T00:00:00Z`)
        monday.setUTCDate(monday.getUTCDate() - 7 * index)
        const period = monday.toISOString().slice(0, 10)

        const weekResponses = responses.map(({ query, body }) =>
        {
            const valid = body && !body.error && (Array.isArray(body.data) || Array.isArray(body.data?.jobs))
            if(!valid)
                return { query, body }
            const jobs = jobsFrom(body).filter((job) => Number.isFinite(job.job_posted_at_timestamp) && periodOf(new Date(job.job_posted_at_timestamp * 1000), settings.timezone) === period)
            return { query, body: { ...body, data: { jobs } } }
        })

        // Noon on that Monday: aggregate() takes the period from it
        const { payload, report } = aggregate(weekResponses, weekSettings, catalog, new Date(`${period}T04:00:00Z`))
        if(!Object.values(payload.careers).some((career) => career.postings))
            continue
        payload.backfilled = true
        payload.source = `Backfill by posting date, ${payload.source}`.slice(0, 120)
        payload.collectedAt = now.toISOString()
        results.push({ payload, report })
    }
    return results
}
