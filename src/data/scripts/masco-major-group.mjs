/**
 * The DOSM stratum of a job title (prompt 01e): MASCO major groups as DOSM's releases quote them, four strata:
 *   managers (1), professionals (2), technicians_and_associate_professionals (3), others (4-9)
 *
 * Rules first, on the title alone, in order: a title several rules could claim goes to the first. A title the rules
 * cannot place (generic "Executive", account managers, ...) returns null and is left to the AI pass
 * (masco-classify.mjs). Rules follow MASCO 2013 job titles; Malaysian usage is noted where it differs.
 */
export const GROUPS = [ 'managers', 'professionals', 'technicians_and_associate_professionals', 'others' ]

const RULES = [
    // Reviewer's conventions (Aloysius Ting, 2026-10-30, data/official-signals/raw/masco-review-corrections.json), checked
    // before the general rules: assistants of executives, support and sales roles named like professionals or managers
    [ 'technicians_and_associate_professionals', /\b(executive assistants?|personal assistants?|assistant to)\b|\b(technical|it|desktop) support\b|\b(procurement|purchasing) (executives?|officers?)\b|\bpurchasers?\b|\bbusiness development (consultants?|executives?|officers?)\b|\bloan (consultants?|officers?)\b/ ],
    [ 'professionals', /\b(information|cyber|it) security (specialists?|analysts?|engineers?|architects?)\b|\bqa\/?qc engineers?\b|\b(human resources?|hr)\b.{0,12}\bexecutives?\b|\bexecutive\b.{0,6}\b(digital marketing|e-?commerce|social media)\b|\baccounts? executives?\b|\bdatabase administrators?\b|\bbusiness analysts?\b/ ],
    [ 'others', /\b(car|automotive|motor|vehicle) (technicians?|mechanics?)\b|\baccounts? assistants?\b|\bcollections? (specialists?|executives?|officers?)\b/ ],
    // Titles named "manager" that MASCO puts elsewhere: left to the AI
    [ null, /\b(account|relationship|key account|property|community|social media|project|programme|program|case|store|branch|outlet|restaurant|shift|area|territory|product)\s+manager\b/ ],
    [ 'managers', /\b(managers?|directors?|head of|chief|ceo|cfo|coo|cto|cio|vice president|vp|general manager|country head|managing partner)\b/ ],
    // 4-9: clerical, service and sales, crafts, operators, elementary
    [ 'others', /\b(clerks?|admin(istrative)? (assistant|clerk)|office assistant|receptionists?|front desk|cashiers?|drivers?|operators?|general workers?|cleaners?|helpers?|waiters?|waitress|barista|cooks?|kitchen (helper|crew|assistant)|commis|security (guards?|officers?)|guards?|store ?keepers?|packers?|promoters?|(sales|retail|shop|store) (assistant|associate|advisor|crew)|customer (service|support|care) (officer|executive|representative|agent|assistant|associate|specialist)|call cent(re|er)|telemarketers?|data entry|machinists?|welders?|warehouse (assistant|worker|crew|operator)|production (operator|worker)|beauticians?|caregivers?|stewards?|housekeep\w*|runners?|despatch|dispatch|riders?|electricians?|plumbers?|mechanics?|fitters?|carpenters?|tailors?|bakers?|butchers?|hairstylists?|nanny|maids?|labou?rers?)\b/ ],
    // 3: technicians and associate professionals; in Malaysia "assistant accountant", admin and sales executives sit here
    [ 'technicians_and_associate_professionals', /\b(technicians?|supervisors?|foreman|forewoman|draughts(wo)?man|drafts(wo)?man|coordinators?|co-ordinators?|inspectors?|qa\/?qc (inspectors?|executives?|officers?|technicians?)|assistant engineers?|engineering assistants?|lab(oratory)? assistants?|assistant accountants?|admin(istrative)? executives?|admin(istrative)? officers?|sales executives?|sales (representatives?|officers?|coordinators?)|chefs?|chef de partie|sous chef|pharmacy assistants?|paralegals?|draughting|surveyors? assistant|assistant (quantity )?surveyors?|junior executives?|executive assistants?|personal assistants?|secretar(y|ies)|bookkeepers?|payroll (executive|officer|assistant))\b/ ],
    // 2: professionals
    [ 'professionals', /\b(engineers?|developers?|programmers?|accountants?|auditors?|analysts?|scientists?|architects?|lawyers?|legal (counsel|executive|associate|advisor)|doctors?|medical officers?|physicians?|pharmacists?|dentists?|lecturers?|teachers?|tutors?|educators?|consultants?|designers?|quantity surveyors?|actuar(y|ies)|economists?|statisticians?|(marketing|digital marketing|hr|human resources?|finance|financial|accounts|procurement|purchasing|compliance|risk|credit|treasury|tax|audit|recruitment|talent acquisition|business development|communications?|brand|content|seo|social media|e-?commerce) (executives?|specialists?|officers?)|nurses?|therapists?|dietitians?|psychologists?|counsell?ors?|researchers?)\b/ ],
]

/** The stratum of a title, or null when no rule places it */
export function ruleGroup(title)
{
    const text = String(title ?? '').toLowerCase().replace(/\s+/g, ' ')
    for(const [ group, pattern ] of RULES)
        if(pattern.test(text))
            return group
    return null
}
