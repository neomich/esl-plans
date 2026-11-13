const fs = require('fs');
const https = require('https'); 

// Read secrets at top level
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
console.log('Telegram token at startup:', TELEGRAM_BOT_TOKEN ? `yes (${TELEGRAM_BOT_TOKEN.length} chars)` : 'NO');

// ── GENERATE LESSON PAGES ──
const lessonsContent = fs.readFileSync('lessons.js', 'utf8');
const getLessons = new Function(lessonsContent.replace('const lessonsCatalog', 'var lessonsCatalog') + '\nreturn lessonsCatalog;');
const lessons = getLessons();
console.log(`Found ${lessons.length} lessons`); 

// Hand-written SERP descriptions, keyed by lesson title. Optional on purpose:
// if the file is missing or a new lesson is not in it yet, the generator falls
// back to the automatic description and still builds.
let lessonDescriptions = {};
let articleDescriptions = {};
try {
    const maps = require('./meta-descriptions.js') || {};
    lessonDescriptions = maps.lessons || maps || {};
    articleDescriptions = maps.articles || {};
} catch (e) {
    console.log('⚠️ meta-descriptions.js not found — using auto-generated descriptions');
}

// Free conversation-question pages (/questions/<slug>). Optional: if the file
// is missing the rest of the build is unaffected.
let conversationQuestions = [];
try {
    conversationQuestions = require('./conversation-questions.js') || [];
} catch (e) {
    console.log('⚠️ conversation-questions.js not found — skipping question pages');
}

if (!fs.existsSync('lessons')) fs.mkdirSync('lessons');

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

// ── ONE ADDRESS PER PAGE ──
// GitHub Pages serves every generated file at BOTH /lessons/foo and
// /lessons/foo.html, with no HTTP redirect between them. Search engines
// therefore discover two URLs for one page and split the ranking signals.
// From here on, only the extensionless form is ever advertised: internal
// links, canonical tags, og:url, schema.org URLs, the sitemap and IndexNow
// all derive their addresses from these helpers, so the forms cannot drift
// apart again. The files themselves stay <slug>.html on disk.
const SITE = 'https://esl-plans.com';
const lessonUrl = slug => `${SITE}/lessons/${slug}`;
const topicUrl = code => `${SITE}/topics/${code}`;
const levelUrl = code => `${SITE}/levels/${code}`;
const articleUrl = slug => `${SITE}/articles/${slug}`;
const ALL_LESSONS_URL = `${SITE}/lessons/`;

const LEVEL_CODES = ['a2', 'b1', 'b2', 'c1'];
const LEVEL_NAMES = { a2: 'A2', b1: 'B1', b2: 'B2', c1: 'C1' };

// ── AUTHOR / ORGANISATION ENTITY ──
// Google and AI crawlers decide whether a page is worth citing partly on who
// wrote it. The same Person @id is reused everywhere (lessons, articles, About)
// and the sameAs list ties it to the real profiles, so they resolve to one
// entity instead of a name that appears from nowhere.
// Public byline name only. The surname appears in exactly one place on the
// site — docs/terms.html, where a legal contract needs the legal name — and
// nowhere else: not in copy, not in schema, not in llms.txt.
const AUTHOR_NAME = 'Alex';
const AUTHOR_URL = `${SITE}/about/`;
const AUTHOR_SAMEAS = [
    'https://www.linkedin.com/in/alex-esl-plans-8a3451235/',
    'https://www.instagram.com/eslplans',
    'https://www.threads.com/@eslplans',
    'https://eslplanscomconversationdriveneslplans.quora.com/',
    'https://www.freeed.com/users/551959',
    'https://en.islcollective.com/portfolio/12970284',
    'https://x.com/neomich',
    'https://medium.com/@esl-plans',
    'https://bsky.app/profile/esl-plans.com'
];
const ORG_SAMEAS = [
    'https://t.me/eslplans',
    'https://www.instagram.com/eslplans',
    'https://www.threads.com/@eslplans',
    'https://www.linkedin.com/in/alex-esl-plans-8a3451235/',
    'https://www.reddit.com/r/FreeESLLessonPlans/',
    'https://bsky.app/profile/esl-plans.com',
    'https://medium.com/@esl-plans',
    'https://au.pinterest.com/alexeslplans/esl-lesson-plans/',
    'https://eslplanscomconversationdriveneslplans.quora.com/'
];
const AUTHOR_SCHEMA = JSON.stringify({ '@type': 'Person', name: AUTHOR_NAME, url: AUTHOR_URL, sameAs: AUTHOR_SAMEAS });
const ORG_SCHEMA = JSON.stringify({ '@type': 'Organization', name: 'ESL-plans.com', url: `${SITE}/`, sameAs: ORG_SAMEAS });

// ── LIBRARY SIZE ──
// Copy never quotes the exact total: "126" is wrong the moment lesson 127 is
// published, and then somebody has to remember where all the numbers live.
// The public figure is the next round hundred (100+ today, 200+ at 200), which
// stays true for a year. The free count is exact because it is short and
// genuinely useful, and it is computed from the same data that renders /free/.
const TOTAL_LESSONS = lessons.length;
const FREE_LESSONS_COUNT = lessons.filter(l => l.isFree === true).length;
const TOTAL_PLUS = `${Math.floor(TOTAL_LESSONS / 100) * 100}+`;

function formatLongDate(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

const SITE_FOOTER_CSS = `<style>
        .site-foot{max-width:820px;margin:40px auto 0;padding:22px 20px 40px;border-top:1px solid #eee;text-align:center;font-size:13px;line-height:2;}
        .site-foot a{color:#a9440c;text-decoration:none;}
        .site-foot a:hover{text-decoration:underline;}
        .site-foot .sep{color:#d8d8d8;padding:0 6px;}
    </style>`;

function renderSiteFooter() {
    return `${SITE_FOOTER_CSS}
        <footer class="site-foot">
            <a href="${SITE}/">Home</a><span class="sep">·</span><a href="${ALL_LESSONS_URL}">All lesson plans</a><span class="sep">·</span><a href="${SITE}/free/">Free lessons</a><span class="sep">·</span><a href="${SITE}/questions/">Conversation questions</a><span class="sep">·</span><a href="${SITE}/articles/">Teacher's Corner</a><span class="sep">·</span><a href="${SITE}/about/">About Alex</a>
        </footer>`;
}

// Safe to drop inside a JSON-LD string. Also neutralises "</script>".
function jsonSafe(value) {
    return String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/</g, '\\u003c')
        .replace(/\r?\n/g, ' ');
}

// Safe to drop inside an HTML attribute.
function escapeAttr(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Build a SERP-friendly description: ~150-152 characters, always cut on a
// word boundary, never leaving a dangling half-word or a broken entity.
// Also strips the "Page 1:" / "Pages 1&2:" prefixes that leaked in from the
// PDF text extraction, which used to make lesson pages look like a document
// dump in search results.
function makeMetaDescription(raw, fallback) {
    let t = String(raw || '')
        .replace(/\s+/g, ' ')
        .replace(/^Page[s]?\s*\d+\s*(?:&|and)\s*\d+\s*[:\-\u2013\u2014]\s*/i, '')
        .replace(/^Page[s]?\s*\d+\s*[:\-\u2013\u2014]\s*/i, '')
        .trim();
    if (!t) t = String(fallback || '').replace(/\s+/g, ' ').trim();

    const LIMIT = 152;
    if (t.length <= LIMIT) return t;

    // Prefer to end on a real sentence.
    let sentenceCut = -1;
    const re = /[.!?](?=\s|$)/g;
    let m;
    while ((m = re.exec(t)) !== null) {
        const end = m.index + 1;
        if (end >= 90 && end <= LIMIT) sentenceCut = end;
        if (end > LIMIT) break;
    }
    if (sentenceCut > 0) return t.slice(0, sentenceCut).trim();

    const slice = t.slice(0, LIMIT);
    const space = slice.lastIndexOf(' ');
    let cut = space >= 90 ? space : LIMIT;

    // Never cut inside a bracket. "(such as bruises…" reads like a broken page
    // rather than a summary, and it is the single most common failure mode in
    // PDF-derived text, where lists of examples live inside parentheses.
    let candidate = t.slice(0, cut);
    const opens = (candidate.match(/\(/g) || []).length;
    const closes = (candidate.match(/\)/g) || []).length;
    if (opens > closes) {
        const paren = candidate.lastIndexOf('(');
        if (paren >= 45) {
            cut = paren;
            candidate = t.slice(0, cut);
        }
    }

    // Also refuse to trail off on a dangling connector ("…including", "…such as").
    let out = candidate.replace(/[\s,;:\-\u2013\u2014&]+$/, '');
    out = out.replace(/[\s,;:\-\u2013\u2014&]+(?:e\.g\.|i\.e\.|such as|including|like|for example)$/i, '');
    out = out.replace(/[\s,;:\-\u2013\u2014&]+$/, '');
    return out + '\u2026';
}

// makeMetaDescription counts plain characters, but the value is later placed
// in an HTML attribute where & becomes &amp; (and " becomes &quot;). That
// escaping can push a 152-character description well past Google's ~160-char
// cut, so trim whole words from the end until the ESCAPED form fits too.
// Returns the plain text; callers still run escapeAttr() themselves.
function makeFittingDescription(raw, fallback) {
    const MAX = 156; // leaves room under the ~160-char SERP cut
    const plain = makeMetaDescription(raw, fallback);
    if (escapeAttr(plain).length <= MAX) return plain;

    const words = plain.replace(/\u2026$/, '').trim().split(/\s+/);
    while (words.length > 1) {
        words.pop();
        const candidate = words.join(' ').replace(/[\s,;:\-\u2013\u2014&]+$/, '');
        if (escapeAttr(candidate + '\u2026').length <= MAX) return candidate + '\u2026';
    }
    return plain;
}

// Human date ("4 November 2026") -> ISO date, for schema.org.
function toISODate(value) {
    const fallback = new Date().toISOString().split('T')[0];
    if (!value) return fallback;
    const d = new Date(value);
    return isNaN(d.getTime()) ? fallback : d.toISOString().split('T')[0];
}

// ── LESSON PAGE ARTWORK ──
// Every lesson already has a cover (visualSource) and it is already public on
// the home cards, but the static lesson page showed no image at all. Reading
// the real pixel size lets the <img> reserve space, so the banner costs no
// layout shift. Pure JPEG/PNG header parsing — no dependencies.
function readImageSize(file) {
    try {
        const b = fs.readFileSync(file);
        if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
        let i = 2;
        while (i < b.length - 9) {
            if (b[i] !== 0xFF) { i++; continue; }
            const marker = b[i + 1];
            if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
            }
            const len = b.readUInt16BE(i + 2);
            if (!len || len < 2) break;
            i += 2 + len;
        }
    } catch (e) { /* fall through */ }
    return null;
}

// visualSource values were written by hand over two years, so the filename
// case does not always match the file on disk (54 of 126 lessons say
// "b1_teens.jpg" while the file is "b1_teens.JPG"). Windows hides this;
// GitHub Pages runs Linux and is case-sensitive, so the wrong case 404s and
// the OG image silently falls back to the generic card. Always resolve to the
// real on-disk name.
function resolveVisual(src) {
    if (!src) return null;
    const rel = String(src).replace(/\\/g, '/').replace(/^\.?\//, '');
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '';
    const base = rel.slice(dir.length);
    try {
        const entries = fs.readdirSync(dir || '.');
        const hit = entries.find(f => f === base) || entries.find(f => f.toLowerCase() === base.toLowerCase());
        if (hit) return { rel: dir + hit, dims: readImageSize(dir + hit) };
    } catch (e) { /* ignore */ }
    return null;
}

// ── "WHAT'S INSIDE" CONTENTS LIST ──
// The page-by-page descriptions ("Page 1: ...", "Page 2: ...") are already
// written for the newest lessons. This lifts the heading of each block into a
// scannable contents list. It never invents anything: if the description is
// not written in that convention, no list is rendered.
function extractOutline(description) {
    const text = String(description || '');
    const re = /^[ \t]*Page[ \t]+(\d+)(?:[ \t]*(?:&|and|\u2013|-)[ \t]*(\d+))?[ \t]*[:\u2013\u2014.\-][ \t]*(.+)$/gim;
    const items = [];
    let m;
    while ((m = re.exec(text)) !== null) {
        const label = m[2] ? `Pages ${m[1]}\u2013${m[2]}` : `Page ${m[1]}`;
        const heading = m[3].trim().replace(/\s+/g, ' ');
        if (heading.length < 3 || heading.length > 90) continue;
        if (items.some(i => i.label === label && i.heading === heading)) continue;
        items.push({ label, heading });
    }
    // One block is a paragraph, not a contents list. Two is the minimum where
    // the list tells the reader something the prose does not already show.
    return items.length >= 2 ? items : [];
}

// First level code a lesson belongs to, e.g. "b1-b2" -> "b1".
function primaryLevelCode(lesson) {
    return (lesson.level || '').split('-').map(s => s.trim().toLowerCase())
        .find(c => LEVEL_CODES.includes(c)) || null;
}

const today = new Date().toISOString().split('T')[0];

// Most recent dateAdded in a set of lessons — used for honest hub lastmods.
function latestDate(items) {
    const dates = items.map(i => i.dateAdded).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : today;
}

// Shared topic label map — used by both lesson pages and topic archive pages
const topicLabels = {
    psychology: 'Psychology', society: 'Society', technology: 'Technology',
    work: 'Work & Career', business: 'Business', life: 'Life & Relationships',
    travel: 'Travel', media: 'Media & Fame', art: 'Art & Culture',
    grammar: 'Grammar', food: 'Food & Drink'
};

// Extract a YouTube video ID from a URL, if it is one
function getYouTubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
    return m ? m[1] : null;
}

// Build one factual, data-derived sentence about lesson logistics — no invented content
function buildLogisticsSentence(lesson) {
    const isRange = (lesson.duration || '').includes('-');
    let sentence = isRange
        ? `This lesson runs ${lesson.duration} and can be split across two shorter sessions if needed.`
        : `This lesson is designed to fit within a single ${lesson.duration} session.`;
    const hasVideo = (lesson.mediaType || '').includes('Video');
    const hasAudio = (lesson.mediaType || '').includes('Audio');
    if (hasVideo && hasAudio) {
        sentence += ' Both audio and video components are included, which also works well for homework-based or asynchronous practice.';
    } else if (hasVideo) {
        sentence += ' The video component works well as homework before the live session.';
    } else if (hasAudio) {
        sentence += ' The audio component works well for pre-class listening practice.';
    }
    return sentence;
}

// ── NETWORK TIMEOUT HELPERS ──
// Every outbound network call in this script MUST go through one of these two
// helpers so the GitHub Action can never hang indefinitely waiting on a
// silent/slow third-party response.
const DEFAULT_TIMEOUT_MS = 10000;

// For https.get / https.request based calls
function httpGetWithTimeout(url, ms = DEFAULT_TIMEOUT_MS) {
    return new Promise((resolve) => {
        const req = https.get(url, res => {
            resolve(res);
        });
        req.setTimeout(ms, () => {
            req.destroy();
            resolve({ statusCode: 0, timedOut: true });
        });
        req.on('error', () => resolve({ statusCode: 0, timedOut: true }));
    });
}

function httpsRequestWithTimeout(options, payload, ms = DEFAULT_TIMEOUT_MS) {
    return new Promise((resolve) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });
        req.setTimeout(ms, () => {
            req.destroy();
            resolve({ statusCode: 0, body: '', timedOut: true });
        });
        req.on('error', () => resolve({ statusCode: 0, body: '', timedOut: true }));
        if (payload) req.write(payload);
        req.end();
    });
}

// For global fetch() based calls (Bluesky)
async function fetchWithTimeout(url, options = {}, ms = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (e) {
        return { ok: false, json: async () => ({ error: 'timeout_or_network', message: e.message }) };
    } finally {
        clearTimeout(timer);
    }
}

let handWrittenCount = 0;
let autoCount = 0;

// Fallback for a lesson with no hand-written SERP description.
// Order: Telegram recap (already written in a human voice, usually <150 chars)
// -> first objective -> raw PDF text. Keeps level and duration at the end, the
// same way the hand-written lines do.
// Largest plain-text length for a fallback description. Google truncates
// around 160 characters in the SERP, and escapeAttr() can add a few more.
const AUTO_DESC_MAX = 152;

// Remove what makes auto-generated text look broken:
//   - an unclosed parenthesis: "vocabulary (e.g., salary, budget, loan,"
//   - trailing list punctuation: "…, debt,"
//   - a dangling connector: "…including", "…such as", "…and how it"
function tidyTail(s) {
    let out = String(s).replace(/\s+/g, ' ').trim();
    const open = out.lastIndexOf('(');
    const close = out.lastIndexOf(')');
    if (open > close) out = out.slice(0, open).trim();
    for (let i = 0; i < 3; i++) {
        const before = out;
        out = out.replace(/[\s,;:&\/\u2013\u2014-]+$/, '');
        out = out.replace(/\s+\b(?:e\.g\.|i\.e\.|such as|including|like|for example|and|or|with|of|to|the|a)$/i, '');
        out = out.replace(/[\s,;:&\/\u2013\u2014-]+$/, '');
        if (out === before) break;
    }
    return out.trim();
}

// Cut to whole words. If the cut lands mid-sentence, prefer the last clause
// boundary (comma / semicolon / dash) when it keeps at least half the text —
// "Explore the philosophical tension between freedom and comfort" reads like a
// summary, "…and how it applies" reads like a bug.
function clipClause(s, max) {
    const t = String(s).replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const boundaries = [', ', '; ', ' \u2014 ', ': '].map(b => cut.lastIndexOf(b));
    const best = Math.max(...boundaries);
    if (best >= max * 0.5) return cut.slice(0, best).trim();
    const sp = cut.lastIndexOf(' ');
    return (sp > 30 ? cut.slice(0, sp) : cut).trim();
}

// Objectives from the PDF are full of lists inside brackets. Drop them before
// anything else, or the description ends up as "(e.g., salary, budget, loan,".
function stripParentheticals(s) {
    return String(s)
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\([^)]*$/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Trim an already-clipped description to `room` characters so level and
// duration can be appended. Cuts on a word boundary, then backs out of any
// bracket the cut landed inside — "(e.g., rivalry…" is worse than no bracket.
function trimToRoom(text, room) {
    const strip = s => s.replace(/[\s,;:\-&\/\u2013\u2014]+$/, '');
    let t = String(text).replace(/\u2026$/, '').trim();

    const open = t.lastIndexOf('(');
    const close = t.lastIndexOf(')');
    if (open > close) t = t.slice(0, open).trim();

    if (t.length + 1 > room) {
        const cut = t.slice(0, room - 1);
        const sp = cut.lastIndexOf(' ');
        t = (sp > 40 ? cut.slice(0, sp) : cut).trim();
        const o2 = t.lastIndexOf('(');
        const c2 = t.lastIndexOf(')');
        if (o2 > c2) t = t.slice(0, o2).trim();
    }
    if (!t) return '';
    return strip(t) + '\u2026';
}

function buildAutoDescription(lesson) {
    const level = String(lesson.levelLabel || '').trim();
    const dur = String(lesson.duration || '').trim();
    const title = String(lesson.title || '').trim();
    const tail = [level, dur].filter(Boolean).join(', ');

    // 1. Telegram recap — written by hand, so it already sounds human.
    const recap = String(lesson.telegramRecap || '').replace(/\s+/g, ' ').trim();
    if (recap) {
        const room = tail ? AUTO_DESC_MAX - tail.length - 2 : AUTO_DESC_MAX;
        let body = tidyTail(clipClause(recap, room));
        if (body) {
            if (!/[.!?]$/.test(body)) body += '.';
            return `${body}${tail ? ' ' + tail + '.' : ''}`;
        }
    }

    // 2. First objective — but only when it fits in full. A half-clause
    // ("…essential vocabulary related", "…hidden in") is worse than no clause,
    // so anything too long falls through to the real description below.
    const firstObjective = stripParentheticals((lesson.objectives || [])[0] || '')
        .replace(/[\s,;:.!?\u2013\u2014-]+$/, '');
    if (firstObjective) {
        // "Zombies: practice critical viewing and listening comprehension.
        //  B2-C1 lesson for adults, 90 min, zero prep."
        const suffix = `${level ? level + ' ' : ''}lesson for adults, ${dur}, zero prep.`;
        const prefix = title ? `${title}: ` : '';
        const room = AUTO_DESC_MAX - prefix.length - suffix.length - 2;
        if (room >= 45 && firstObjective.length <= room) {
            const clause = firstObjective.charAt(0).toLowerCase() + firstObjective.slice(1);
            return `${prefix}${clause}. ${suffix}`;
        }
    }

    // 3. The lesson's own description. Take whole sentences where possible:
    // PDF text usually opens with a usable line, and a complete sentence reads
    // far better in the SERP than a clipped one. Only fall back to
    // makeFittingDescription (which trails off with "…") when no sentence fits.
    const raw = String(lesson.description || '')
        .replace(/^Page[s]?\s*\d+\s*(?:&|and)\s*\d+\s*[:\-\u2013\u2014]\s*/i, '')
        .replace(/^Page[s]?\s*\d+\s*[:\-\u2013\u2014]\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    const cleaned = stripBoilerplate(raw);
    if (cleaned) {
        // Split on sentence ends only. A naive /[^.!?]+[.!?]/ scan breaks on
        // abbreviations inside brackets ("(e.g., salary…") and starts a
        // "sentence" mid-list, which is how descriptions used to begin with ", ".
        const sentences = cleaned.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
        let body = '';
        for (const s of sentences) {
            const next = body ? `${body} ${s}` : s;
            const withTail = tail ? `${next} ${tail}.` : next;
            if (withTail.length > AUTO_DESC_MAX) break;
            body = next;
        }
        if (body) {
            if (!/[.!?]$/.test(body)) body += '.';
            const full = tail ? `${body} ${tail}.` : body;
            // A very short whole sentence ("Defining altruism and egoism.")
            // wastes the snippet; below ~100 chars a clean cut fills it better.
            if (full.length >= 100) return full;
        }

        // Fall back to a clean word-boundary cut, then add level and duration
        // if there is room for them.
        let fd = makeFittingDescription(
            cleaned,
            `${title ? title + ' — ' : ''}a ${level} ESL lesson plan for adult learners.`
        );
        if (tail) {
            const room = AUTO_DESC_MAX - tail.length - 2;
            return `${trimToRoom(fd, room)} ${tail}.`;
        }
        return fd;
    }

    return makeFittingDescription(
        lesson.description,
        `${title ? title + ' — ' : ''}a ${level} ESL lesson plan for adult learners.`
    );
}

// PDF descriptions all start the same way. Stripping the formula gets straight
// to the content: "In this lesson, students begin by analysing a chart" ->
// "Analysing a chart". Only leading boilerplate is touched.
function stripBoilerplate(text) {
    let out = String(text)
        .replace(/^In this lesson,?\s+students\s+(?:begin|start)\s+(?:by|with)\s+/i, '')
        .replace(/^In this lesson,?\s+/i, '')
        .replace(/^In the lesson,?\s+students\s+(?:begin|start)\s+(?:by|with)\s+/i, '')
        .replace(/^The lesson\s+(?:opens|starts|begins)\s+(?:with|by)\s+/i, '')
        .replace(/^Students\s+(?:begin|start)\s+(?:by|with)\s+/i, '')
        .replace(/^[\s,;:)\u2013\u2014-]+/, '')
        .trim();
    if (!out) return '';
    out = out.charAt(0).toUpperCase() + out.slice(1);
    return out;
}

lessons.forEach(lesson => {
    const slug = slugify(lesson.title);
    // Prefer the hand-written SERP description. Auto-generation from PDF text
    // is only a safety net for lessons added before their description is written.
    const handWritten = String(lessonDescriptions[lesson.title] || '').trim();
    if (handWritten) handWrittenCount++;
    else autoCount++;
    const descPlain = handWritten || buildAutoDescription(lesson);
    const descMeta = escapeAttr(descPlain);
    const descSafe = (lesson.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const objList = (lesson.objectives || []).map(o => `<li>${o.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('\n');

    // "What's the \"The Loneliness Economy\" ESL Lesson About?" reads like a
    // typo, so the article is dropped in this one sentence only. The h1, the
    // cards and the schema keep the real title.
    const titleForH2 = String(lesson.title).replace(/^(The|A|An)\s+/i, '');

    // Preview image: the lesson's own cover when it exists on disk, otherwise
    // the site-wide card. resolveVisual returns the true on-disk filename, so
    // the 54 hand-written case mismatches do not 404 on the Linux runner.
    const resolvedCover = resolveVisual(lesson.visualSource);
    const coverRel = resolvedCover ? resolvedCover.rel : 'images/og-image.jpg';
    const ogImage = `${SITE}/${coverRel.replace(/^\.?\//, '')}`;

    // Breadcrumb targets: level hub first, topic hub as the middle step.
    const lessonLevel = primaryLevelCode(lesson);
    const lessonTopic = (lesson.topics || [])[0] || null;

    // Find 3 related lessons by shared topics
    const currentIdx = lessons.indexOf(lesson);
    const related = lessons
        .filter((l, i) => i !== currentIdx && l.topics && lesson.topics && l.topics.some(t => (lesson.topics || []).includes(t)))
        .slice(0, 3);

    const relatedHtml = related.length > 0 ? `
        <div style="margin-top:32px;border-top:1px dashed #ddd;padding-top:24px;">
            <h3 style="font-size:14px;font-weight:700;color:#6b6b6b;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">You may also like</h3>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                ${related.map(r => `<a href="${lessonUrl(slugify(r.title))}" style="flex:1;min-width:180px;background:white;border-radius:12px;padding:14px;text-decoration:none;border:1px solid #eee;display:block;">
                    <div style="font-size:14px;font-weight:700;color:#333;margin-bottom:4px;">${r.title}</div>
                    <div style="font-size:12px;color:#6b6b6b;">${r.levelLabel} &middot; ${r.duration}</div>
                    <div style="font-size:12px;color:#a9440c;font-weight:700;margin-top:8px;">View Lesson &rarr;</div>
                </a>`).join('')}
            </div>
        </div>` : '';

    // Build topics tags
    const topicTags = (lesson.topics || []).map(t => topicLabels[t] || t).join(' · ');

    // Artwork + contents list. Both are derived from data that already exists,
    // and both disappear cleanly if the data is not there.
    const cover = resolvedCover;
    const coverHtml = cover
        ? `<div class="cover"><img src="${SITE}/${cover.rel}" alt="${escapeAttr(lesson.title)} — ESL lesson plan cover"${cover.dims ? ` width="${cover.dims.w}" height="${cover.dims.h}"` : ''} loading="eager" decoding="async"></div>`
        : '';
    const outlineItems = extractOutline(lesson.description);
    const outlineHtml = outlineItems.length
        ? `<h3>Page by page</h3>
        <ol class="inside">${outlineItems.map(i => `<li><span class="inside-page">${escapeAttr(i.label)}</span><span>${escapeAttr(i.heading)}</span></li>`).join('')}</ol>`
        : '';

    // Materials list
    // Premium lessons carry hasPdf/hasAudio/hasRar flags instead of file URLs,
    // because their real URLs live in Supabase. The `|| lesson.pdfUrl` keeps
    // old/free entries (which still have inline URLs) working unchanged.
    const materials = [];
    if (lesson.hasPdf || lesson.pdfUrl) materials.push('PDF handout');
    if (lesson.hasAudio || lesson.audioUrl || lesson.audioUrls) materials.push('audio materials (MP3)');
    if (lesson.links && lesson.links.length) materials.push('video links');
    if (lesson.hasRar || lesson.rarUrl) materials.push('full downloadable package (RAR)');
    const materialsText = materials.join(', ');

    // NO VideoObject schema here, deliberately.
    // Google only supports video structured data on a "watch page" — a page
    // whose main purpose is showing that one video. A lesson page's purpose is
    // the lesson plan; the embedded video is supplementary, which is Google's
    // own example of a page that is NOT a watch page ("a blog post that reviews
    // an embedded video"). VideoObject here can never earn a video result and
    // only produces permanent "Video isn't on a watch page" errors in Search
    // Console. The <iframe> embed and "Watch the Video" links below stay, so
    // users see exactly the same page.

    // Visible breadcrumb + matching BreadcrumbList schema. The level step is
    // also the site's only link path to the level hubs, which previously had
    // zero inbound internal links.
    const breadcrumbHtml = `<nav aria-label="Breadcrumb" style="font-size:13px;color:#6b6b6b;margin-bottom:16px;">
        <a href="${SITE}/" style="color:#a9440c;text-decoration:underline;">Home</a> &rsaquo;
        ${lessonLevel ? `<a href="${levelUrl(lessonLevel)}" style="color:#a9440c;text-decoration:underline;">${LEVEL_NAMES[lessonLevel]} lesson plans</a> &rsaquo; ` : ''}<span>${lesson.title}</span>
    </nav>`;

    const breadcrumbSchema = `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
            ...(lessonLevel ? [{ '@type': 'ListItem', position: 2, name: `${LEVEL_NAMES[lessonLevel]} lesson plans`, item: levelUrl(lessonLevel) }] : []),
            { '@type': 'ListItem', position: lessonLevel ? 3 : 2, name: lesson.title, item: lessonUrl(slug) }
        ]
    })}</script>`;

    const levelMoreHtml = lessonLevel ? `
        <p style="text-align:center;margin:10px 0 0;">
            <a href="${levelUrl(lessonLevel)}" style="color:#a9440c;font-weight:600;text-decoration:none;font-size:14px;">Browse all ${LEVEL_NAMES[lessonLevel]} ESL lesson plans &rarr;</a>
        </p>` : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${lesson.title} — ESL Lesson Plan for Adults | ESL-plans.com</title>
    <meta name="description" content="${descMeta}">
    <meta name="keywords" content="${(lesson.keywords||'')}, ESL lesson plan for adults, adult English lesson plan, online ESL tutor resources, ${lesson.levelLabel} ESL adults, conversation ESL lesson, ${topicTags.toLowerCase()}">
    <link rel="canonical" href="${lessonUrl(slug)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${lessonUrl(slug)}">
    <meta property="og:title" content="${escapeAttr(lesson.title)} — ESL Lesson Plan for Adults">
    <meta property="og:description" content="${descMeta}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:image:alt" content="${escapeAttr(lesson.title)} — ESL lesson plan cover">
    <meta property="og:site_name" content="ESL-plans.com">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(lesson.title)} — ESL Lesson Plan for Adults">
    <meta name="twitter:description" content="${descMeta}">
    <meta name="twitter:image" content="${ogImage}">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Course","name":"${jsonSafe(lesson.title)}","description":"${jsonSafe(descPlain)}","provider":${ORG_SCHEMA},"author":${AUTHOR_SCHEMA},"educationalLevel":"${jsonSafe(lesson.levelLabel)}","inLanguage":"en","isAccessibleForFree":${lesson.isFree ? 'true' : 'false'},"url":"${lessonUrl(slug)}","image":"${ogImage}"}</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What level is the ${jsonSafe(lesson.title)} ESL lesson plan?","acceptedAnswer":{"@type":"Answer","text":"The ${jsonSafe(lesson.title)} lesson plan is designed for ${jsonSafe(lesson.levelLabel)} level adult learners. It takes approximately ${jsonSafe(lesson.duration)} to complete."}},{"@type":"Question","name":"What materials are included in the ${jsonSafe(lesson.title)} lesson?","acceptedAnswer":{"@type":"Answer","text":"The ${jsonSafe(lesson.title)} lesson includes ${jsonSafe(materialsText)}."}},{"@type":"Question","name":"Is the ${jsonSafe(lesson.title)} lesson plan suitable for online ESL tutors?","acceptedAnswer":{"@type":"Answer","text":"Yes, the ${jsonSafe(lesson.title)} lesson is specifically designed for online ESL tutors working with adult learners at ${jsonSafe(lesson.levelLabel)} level. It is zero-prep and conversation-driven, covering the topic of ${jsonSafe(topicTags)}."}}]}</script>
    ${breadcrumbSchema}
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}
        .container{max-width:820px;margin:0 auto;padding:40px 20px}
        .logo{font-size:22px;margin-bottom:28px;text-decoration:none;display:block;}
        .logo .esl{font-weight:900;font-style:italic;color:#a9440c;}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif;}
        h1{color:#a9440c;font-size:28px;margin-bottom:8px;line-height:1.3;}
        .meta{color:#6b6b6b;font-size:14px;margin-bottom:24px;display:flex;flex-wrap:wrap;gap:12px;}
        .meta-badge{background:white;border-radius:20px;padding:4px 12px;font-size:13px;color:#555;border:1px solid #eee;}
        .byline{font-size:13px;color:#6b6b6b;margin:-14px 0 22px;}
        .byline a{color:#a9440c;text-decoration:underline;}
        .byline a:hover{text-decoration:underline;}
        .cover{max-width:700px;margin:0 auto 20px;border-radius:14px;overflow:hidden;background:#f3e7dd;aspect-ratio:16/9;}
        .cover img{width:100%;height:100%;object-fit:cover;display:block;}
        .inside{list-style:none;padding:0;margin:0 0 24px;}
        .inside li{background:white;border:1px solid #f3ece6;border-radius:10px;padding:10px 14px;margin-bottom:6px;font-size:14px;color:#333;display:flex;gap:10px;align-items:baseline;line-height:1.5;}
        .inside-page{font-size:11px;font-weight:800;color:#a9440c;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;}
        h2{color:#333;font-size:17px;font-weight:700;margin:28px 0 12px;text-transform:uppercase;letter-spacing:0.5px;}
        h3{color:#333;font-size:15px;font-weight:700;margin:20px 0 10px;text-transform:uppercase;letter-spacing:0.5px;}
        ul{color:#444;line-height:1.8;padding-left:20px;margin-bottom:16px;}
        li{margin-bottom:4px;}
        .desc{color:#444;line-height:1.8;white-space:pre-line;margin-bottom:24px;}
        .info-box{background:white;border-radius:16px;padding:20px 24px;margin:24px 0;border-left:4px solid #c95210;}
        .info-box h3{font-size:14px;font-weight:700;color:#a9440c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;}
        .info-box p{font-size:14px;color:#555;line-height:1.7;margin:0;}
        .topics{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;}
        .topic-tag{background:#fff3e0;color:#a9440c;border-radius:20px;padding:5px 14px;font-size:13px;font-weight:600;text-decoration:none;}
        .cta-box{background:#b8480d;border-radius:16px;padding:24px;text-align:center;margin:32px 0;color:white;}
        .cta-box p{margin-bottom:14px;font-size:15px;}
        .cta-btn{display:inline-block;background:white;color:#a9440c;padding:12px 28px;border-radius:25px;text-decoration:none;font-weight:700;font-size:15px;}
        .back{display:inline-block;margin-top:20px;color:#a9440c;text-decoration:none;font-weight:600;font-size:14px;}
    </style>
    <script>
        // Highlight the view lesson button after 1 second to draw attention
        setTimeout(function() {
            const btn = document.getElementById('view-on-site-btn');
            if (btn) btn.style.transform = 'scale(1.03)';
        }, 1000);
    </script>
</head>
<body>
    <main class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>

        ${breadcrumbHtml}

        <h1>${lesson.title}</h1>

        <div style="text-align:center; margin:18px 0 22px;">
            <a id="view-on-site-btn-top" href="${SITE}/#lesson-${slug}"
               style="display:inline-block; background:#b8480d; color:white; padding:14px 32px; border-radius:50px; text-decoration:none; font-size:17px; font-weight:800; box-shadow:0 4px 16px rgba(201,82,16,0.3);">
                View &amp; Download This Lesson →
            </a>
        </div>

        ${coverHtml}

        <div class="meta">
            <span class="meta-badge">🎓 ${lesson.categoryLabel}</span>
            <span class="meta-badge">🥉 ${lessonLevel ? `<a href="${levelUrl(lessonLevel)}" style="color:inherit;text-decoration:none;">${lesson.levelLabel}</a>` : lesson.levelLabel}</span>
            <span class="meta-badge">⏱ ${lesson.duration}</span>
            <span class="meta-badge">${lesson.mediaIcon} ${lesson.mediaType}</span>
            ${lesson.isFree ? '<span class="meta-badge" style="background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7;">⭐ Free Lesson</span>' : ''}
        </div>

        <p class="byline">By <a href="${SITE}/about/">${AUTHOR_NAME}</a> &middot; ${formatLongDate(lesson.dateAdded) || 'ESL-plans'} &middot; taught to real adult students before it was published</p>

        ${topicTags ? `<div class="topics">${(lesson.topics||[]).map(t => `<a href="${topicUrl(t)}" class="topic-tag">${topicLabels[t]||t}</a>`).join('')}</div>` : ''}

        <table style="width:100%;border-collapse:collapse;margin:16px 0 24px;font-size:13px;background:white;border-radius:12px;overflow:hidden;border:1px solid #eee;">
            <thead>
                <tr style="background:#faf6f2;">
                    <th style="padding:10px 14px;text-align:left;color:#6b6b6b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-size:11px;">Level</th>
                    <th style="padding:10px 14px;text-align:left;color:#6b6b6b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-size:11px;">Category</th>
                    <th style="padding:10px 14px;text-align:left;color:#6b6b6b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-size:11px;">Format</th>
                    <th style="padding:10px 14px;text-align:left;color:#6b6b6b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-size:11px;">Duration</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding:10px 14px;color:#333;">${lesson.levelLabel}</td>
                    <td style="padding:10px 14px;color:#333;">${lesson.categoryLabel}</td>
                    <td style="padding:10px 14px;color:#333;">${lesson.mediaType}</td>
                    <td style="padding:10px 14px;color:#333;">${lesson.duration}</td>
                </tr>
            </tbody>
        </table>

        <h2>What's the "${titleForH2}" ESL Lesson About?</h2>
        <p style="color:#6b6b6b;font-size:13px;margin-bottom:20px;">${lesson.levelLabel} · ${lesson.categoryLabel}</p>

        <h3>Main Objectives</h3>
        <ul>${objList}</ul>

        ${outlineHtml}

        <h3>About This Lesson</h3>
        <p class="desc">${descSafe}</p>
        <p style="color:#5f5f5f;font-size:13px;margin-top:-10px;margin-bottom:20px;font-style:italic;">${buildLogisticsSentence(lesson)}</p>

        ${(lesson.links || []).filter(l => l && l.url).length ? `<h3>Watch the Video</h3>
        ${(lesson.links || []).filter(l => l && l.url).map(l => {
            const ytId = getYouTubeId(l.url);
            if (ytId) {
                return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><iframe src="https://www.youtube.com/embed/${ytId}" title="${lesson.title.replace(/"/g,'&quot;')} — video" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
            }
            return `<a href="${l.url}" target="_blank" rel="noopener" style="display:block;color:#a9440c;font-weight:700;text-decoration:none;margin-bottom:10px;">▶️ ${(l.label||'Watch Video').replace(/</g,'&lt;')} &rarr;</a>`;
        }).join('')}` : ''}

        <div class="info-box">
            <h3>What's Included</h3>
            <p>${materialsText.charAt(0).toUpperCase() + materialsText.slice(1)}. Everything you need to run this lesson is ready to download — zero preparation required.</p>
        </div>

        <div class="info-box">
            <h3>Who Is This For?</h3>
            <p>This lesson plan is designed for online ESL tutors working with adult learners at <strong>${lesson.levelLabel}</strong> level. It uses a conversation-driven approach with authentic materials to keep adult students genuinely engaged throughout the session.</p>
        </div>

        ${relatedHtml}

        <div class="cta-box">
            <p>Looking for more ESL lesson plans for adult learners? Browse our full library of ${TOTAL_PLUS} conversation-driven plans.</p>
            <a href="${ALL_LESSONS_URL}" class="cta-btn">Browse All Lesson Plans →</a>
        </div>

        <div style="text-align:center; margin:32px 0;">
            <a id="view-on-site-btn" href="${SITE}/#lesson-${slug}"
               style="display:inline-block; background:#b8480d; color:white; padding:16px 36px; border-radius:50px; text-decoration:none; font-size:18px; font-weight:800; box-shadow:0 4px 16px rgba(201,82,16,0.3); transition:transform 0.2s;">
                🎓 View &amp; Download This Lesson →
            </a>
            <p style="margin-top:12px; font-size:13px; color:#6b6b6b;">Free PDF, audio and video included for free lessons</p>
            ${levelMoreHtml}
        </div>
        <a class="back" href="${ALL_LESSONS_URL}">&larr; Browse all lesson plans</a>
    </main>
    ${renderSiteFooter()}
</body>
</html>`;
    fs.writeFileSync(`lessons/${slug}.html`, html, 'utf8');
    console.log(`Lesson: lessons/${slug}.html`);
});

console.log(`Descriptions: ${handWrittenCount} hand-written, ${autoCount} auto-generated${autoCount ? ' ⚠️ add those to meta-descriptions.js' : ''}`);

// ── GENERATE ARTICLE PAGES ──
let articles = [];
// ── ARTICLE ↔ LESSON LINKS ──
// Articles used to point at "#lesson-<slug>", a fragment that only resolves
// inside the SPA, so in plain HTML an article linked to no lesson at all.
// Each article carries an explicit relatedLessons list; when a new one does
// not, the list is derived from the text: lessons whose titles are actually
// named in the article. No match means no block — a wrong link is worse than
// no link, and the whole point is that the links be real.
function articlePlainText(article) {
    return String(`${article.title || ''} ${article.intro || ''} ${article.body || ''}`)
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#?\w+;/g, ' ')
        .replace(/[^a-z0-9]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function relatedLessonsForArticle(article) {
    // Accept a real slug or the lesson title: "life-3-0" and "Life 3.0" both
    // resolve to the page at /lessons/life-30 (slugify strips the dot). A typo
    // is reported in the build log instead of silently shrinking the list.
    const key = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
    const find = value => lessons.find(l => key(l.title) === key(value));

    if (Array.isArray(article.relatedLessons)) {
        const picked = [];
        for (const value of article.relatedLessons) {
            const lesson = find(value);
            if (lesson) picked.push(lesson);
            else console.log(`⚠️  relatedLessons: "${value}" does not match a lesson (${article.title})`);
        }
        if (picked.length) {
            return { lessons: picked.slice(0, 5), heading: 'Lesson plans on this topic', mentioned: true };
        }
    }

    const plain = ` ${articlePlainText(article)} `;
    const hits = [];
    for (const lesson of lessons) {
        const title = String(lesson.title)
            .replace(/[^a-z0-9]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        if (title.length < 6) continue;
        const words = title.split(' ').filter(Boolean);
        const occurrences = plain.split(` ${title} `).length - 1;
        if (!occurrences) continue;
        // A one-word title ("Purpose", "Teenagers") also appears as ordinary
        // vocabulary, so it only counts when the article keeps coming back to
        // it. A multi-word title is specific enough on its own.
        if (words.length === 1 && occurrences < 2) continue;
        hits.push({ lesson, score: occurrences * (words.length > 1 ? 10 : 4) });
    }
    hits.sort((a, b) => b.score - a.score || String(a.lesson.title).localeCompare(String(b.lesson.title)));
    if (hits.length) {
        return { lessons: hits.slice(0, 4).map(h => h.lesson), heading: 'Lesson plans mentioned in this article', mentioned: true };
    }

    // Nothing in the text names a lesson. Rather than invent a thematic link,
    // show the newest plans under an honest heading — every future article gets
    // a useful block without pretending the two are related.
    const newest = [...lessons]
        .sort((a, b) => String(b.dateAdded || '').localeCompare(String(a.dateAdded || '')))
        .slice(0, 4);
    return { lessons: newest, heading: 'Newest lesson plans', mentioned: false };
}

if (fs.existsSync('articles.js')) {
    const articlesContent = fs.readFileSync('articles.js', 'utf8');
    try {
        const getArticles = new Function(articlesContent.replace('const articlesCatalog', 'var articlesCatalog') + '\nreturn articlesCatalog;');
        articles = getArticles();
        console.log(`Found ${articles.length} articles`);
    } catch(e) {
        console.log('No articles yet');
    }
}

if (!fs.existsSync('articles')) fs.mkdirSync('articles');

articles.forEach(article => {
    const slug = slugify(article.title);
    const bodySafe = article.body || '';
    const introSafe = article.intro || '';
    const bodyPlain = makeFittingDescription(
        (article.intro || article.body || '').replace(/<[^>]+>/g, ' '),
        article.title
    );
    // Meta tags get the hand-written line when one exists; schema keeps the
    // longer intro, which is more useful as structured data.
    const metaPlain = String(articleDescriptions[slug] || '').trim() || bodyPlain;
    const bodyMeta = escapeAttr(metaPlain);
    const articleISO = toISODate(article.date);
    const articleImage = `${SITE}/images/og-image.jpg`;
    const related = relatedLessonsForArticle(article);
    const relatedHtml = related.lessons.length ? `
        <div class="related">
            <h2>${related.heading}</h2>
            ${related.lessons.map(l => `<a href="${lessonUrl(slugify(l.title))}">
                <span class="t">${escapeAttr(l.title)}</span>
                <span class="m">${escapeAttr(l.levelLabel)} &middot; ${escapeAttr(l.duration)}${l.isFree ? ' &middot; <span class="free">Free</span>' : ''}</span>
            </a>`).join('\n            ')}
        </div>` : '';
    const mentionsJson = related.mentioned && related.lessons.length
        ? `,"mentions":${JSON.stringify(related.lessons.map(l => ({ '@type': 'Course', name: l.title, url: lessonUrl(slugify(l.title)) })))}`
        : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} | ESL-plans.com Teacher's Corner</title>
    <meta name="description" content="${bodyMeta}">
    <meta name="keywords" content="ESL teaching tips, online ESL tutor, adult ESL learners, ${slugify(article.title).replace(/-/g,' ')}">
    <link rel="canonical" href="${articleUrl(slug)}">
    <link rel="alternate" type="application/rss+xml" title="ESL-plans.com — new lessons and articles" href="${SITE}/feed.xml">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${articleUrl(slug)}">
    <meta property="og:title" content="${escapeAttr(article.title)}">
    <meta property="og:description" content="${bodyMeta}">
    <meta property="og:image" content="${articleImage}">
    <meta property="og:site_name" content="ESL-plans.com">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(article.title)}">
    <meta name="twitter:description" content="${bodyMeta}">
    <meta name="twitter:image" content="${articleImage}">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"${jsonSafe(article.title)}","description":"${jsonSafe(bodyPlain)}","author":${AUTHOR_SCHEMA},"publisher":${ORG_SCHEMA},"datePublished":"${articleISO}","dateModified":"${articleISO}","inLanguage":"en","url":"${articleUrl(slug)}","mainEntityOfPage":{"@type":"WebPage","@id":"${articleUrl(slug)}"}${mentionsJson}}</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"${jsonSafe(article.title)}","acceptedAnswer":{"@type":"Answer","text":"${jsonSafe(bodyPlain)}"}}]}</script>
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}
        .container{max-width:760px;margin:0 auto;padding:40px 20px}
        .logo{font-size:24px;margin-bottom:32px;cursor:pointer}
        .logo .esl{font-weight:900;font-style:italic;color:#a9440c;font-family:'Segoe UI',sans-serif}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif}
        h1{color:#333;font-size:28px;line-height:1.3;margin-bottom:8px}
        .meta{color:#6b6b6b;font-size:13px;margin-bottom:32px}
        .body{color:#444;font-size:16px;line-height:1.8;}
        .cta{margin-top:40px;padding:24px;background:white;border-radius:16px;border-left:4px solid #c95210;text-align:center}
        .cta p{color:#555;margin-bottom:16px}
        .cta a{display:inline-block;background:#b8480d;color:white;padding:12px 28px;border-radius:25px;text-decoration:none;font-weight:700}
        .related{margin-top:40px;border-top:1px dashed #e2d5c9;padding-top:22px}
        .related h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#6b6b6b;margin:0 0 12px}
        .related a{display:block;background:white;border:1px solid #f0e6dd;border-radius:12px;padding:13px 16px;margin-bottom:8px;text-decoration:none}
        .related a:hover{border-color:#b8480d}
        .related .t{display:block;font-weight:700;font-size:15px;color:#333;line-height:1.4}
        .related .m{display:block;font-size:12px;color:#6b6b6b;margin-top:3px}
        .related .free{color:#2e7d32;font-weight:700}
        .back{display:inline-block;margin-top:24px;color:#a9440c;text-decoration:none;font-weight:600;font-size:14px}
    </style>
</head>
<body>
    <main class="container">
        <div class="logo" onclick="window.location='https://esl-plans.com'">
            <span class="esl">ESL</span>-<span class="plans">plans</span>
        </div>
        <h1>${article.title}</h1>
        <p class="meta">${article.date || ''} &middot; by <a href="${SITE}/about/" style="color:#a9440c;text-decoration:underline;">${AUTHOR_NAME}</a> &middot; ESL-plans Teacher's Corner</p>
        ${introSafe ? `<p style="font-style:italic; color:#666; border-left:3px solid #c95210; padding-left:14px; margin-bottom:24px; line-height:1.7;">${introSafe}</p>` : ''}
        <div class="body">${bodySafe}</div>
        ${relatedHtml}
        <div class="cta">
            <p>Looking for ready-made ESL lesson plans for adult learners?</p>
            <a href="${ALL_LESSONS_URL}">Browse ${TOTAL_PLUS} Lesson Plans →</a>
        </div>
        <a class="back" href="${SITE}/">&larr; Back to ESL-plans.com</a>
    </main>
    ${renderSiteFooter()}
</body>
</html>`;
    fs.writeFileSync(`articles/${slug}.html`, html, 'utf8');
    console.log(`Article: articles/${slug}.html`);
});

// ── STATIC ARTICLE INDEX (/articles/) ──
// The footer link "Teacher's Corner articles" used to point at #articles-grid,
// an anchor that only exists inside the SPA. On a lesson page it did nothing,
// and on the home page it just scrolled. This writes a real, crawlable hub at
// /articles/ so every article has a parent page, the footer link has a target,
// and the section can actually rank for "ESL teaching articles".
if (articles.length && !articles.some(a => slugify(a.title) === 'index')) {
    const cardsHtml = articles.map(a => {
        const s = slugify(a.title);
        const fallback = (a.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        let excerpt = String(articleDescriptions[s] || '').trim() || fallback;
        if (excerpt.length > 190) excerpt = excerpt.slice(0, 187).replace(/\s+\S*$/, '') + '…';
        return `<a class="card" href="${articleUrl(s)}">
            <h2>${escapeAttr(a.title)}</h2>
            <p>${escapeAttr(excerpt)}</p>
            <span class="date">${escapeAttr(a.date || '')}</span>
        </a>`;
    }).join('\n            ');

    const listSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'ESL Teaching Articles for Online Tutors',
        url: `${SITE}/articles/`,
        description: 'Practical articles about teaching English to adults online: lesson ideas, student motivation, textbooks, grammar and what actually works in a real classroom.',
        mainEntity: {
            '@type': 'ItemList',
            itemListElement: articles.map((a, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: articleUrl(slugify(a.title)),
                name: a.title
            }))
        }
    });
    const crumbSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
            { '@type': 'ListItem', position: 2, name: "Teacher's Corner", item: `${SITE}/articles/` }
        ]
    });

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ESL Teaching Articles for Online Tutors | Teacher's Corner</title>
    <meta name="description" content="Practical articles about teaching English to adults online: lesson ideas, student motivation, textbook fatigue, grammar and what actually works with real students.">
    <link rel="canonical" href="${SITE}/articles/">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${SITE}/articles/">
    <meta property="og:title" content="ESL Teaching Articles for Online Tutors | Teacher's Corner">
    <meta property="og:description" content="Practical articles about teaching English to adults online: lesson ideas, student motivation, textbook fatigue, grammar and what actually works with real students.">
    <meta property="og:image" content="${SITE}/images/og-image.jpg">
    <meta property="og:site_name" content="ESL-plans.com">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">${listSchema}</script>
    <script type="application/ld+json">${crumbSchema}</script>
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}
        .container{max-width:820px;margin:0 auto;padding:40px 20px}
        .logo{font-size:22px;margin-bottom:18px;text-decoration:none;display:block}
        .logo .esl{font-weight:900;font-style:italic;color:#a9440c}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif}
        .crumb{font-size:13px;color:#6b6b6b;margin-bottom:10px}
        .crumb a{color:#a9440c;text-decoration:underline}
        h1{color:#a9440c;font-size:28px;margin-bottom:10px;line-height:1.3}
        p.intro{color:#666;font-size:15px;margin-bottom:26px;line-height:1.6}
        .card{display:block;background:white;border-radius:12px;padding:18px 20px;text-decoration:none;border:1px solid #eee;margin-bottom:12px}
        .card:hover{border-color:#ffc89a}
        .card h2{font-size:18px;font-weight:700;color:#333;margin:0 0 6px;line-height:1.35}
        .card p{font-size:14px;color:#666;line-height:1.6;margin:0 0 8px}
        .card .date{font-size:12px;color:#6b6b6b}
        .back{display:inline-block;margin-top:26px;color:#a9440c;text-decoration:none;font-weight:600;font-size:14px}
    </style>
</head>
<body>
    <main class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>
        <nav class="crumb" aria-label="Breadcrumb"><a href="${SITE}/">Home</a> &rsaquo; <span>Teacher's Corner</span></nav>
        <h1>Teacher's Corner</h1>
        <p class="intro">Practical, opinionated writing about teaching English to adults online — what works, what wastes your time, and why so much textbook advice falls flat with real students. No fluff, no listicles for the sake of it.</p>
            ${cardsHtml}
        <a class="back" href="${ALL_LESSONS_URL}">Browse ${TOTAL_PLUS} ESL lesson plans &rarr;</a>
    </main>
    ${renderSiteFooter()}
</body>
</html>`;

    fs.writeFileSync('articles/index.html', indexHtml, 'utf8');
    console.log(`Article index: articles/index.html (${articles.length} articles)`);
}

// ── SPLICE A REAL, CRAWLABLE ARTICLE LIST INTO index.html ──
// The live SPA's Teacher's Corner section used to hardcode a "No articles
// yet" placeholder as its initial state, only replaced by JS after an async
// fetch completes. Search engines and AI crawlers that don't fully execute
// that JS were reading the false placeholder as the page's real content.
// This writes real, static, linkable article cards directly into the two
// marker comments in index.html so the true content is there from the start.
try {
    const indexPath = 'index.html';
    const startMarker = '<!-- STATIC-ARTICLES-START -->';
    const endMarker = '<!-- STATIC-ARTICLES-END -->';
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const startIdx = indexContent.indexOf(startMarker);
    const endIdx = indexContent.indexOf(endMarker);

    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
        console.log('⚠️ STATIC-ARTICLES markers not found in index.html — skipping article splice. index.html was NOT modified.');
    } else {
        let articleCardsHtml;
        if (articles.length === 0) {
            articleCardsHtml = '<div class="articles-empty">No articles yet — check back soon!</div>';
        } else {
            articleCardsHtml = articles.map(a => {
                const plainText = (a.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                const cardSlug = slugify(a.title);
                return `<a href="${articleUrl(cardSlug)}" class="article-card" style="text-decoration:none; color:inherit; display:block;">
                    <div class="article-card-body">
                        <h3>${a.title.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</h3>
                        <p class="article-preview">${plainText.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
                    </div>
                    <div class="article-card-footer">
                        <span class="read-more">Read more →</span>
                        <span class="article-date">${a.date || ''}</span>
                    </div>
                </a>`;
            }).join('\n                ');
        }

        const before = indexContent.slice(0, startIdx + startMarker.length);
        const after = indexContent.slice(endIdx);
        const newIndexContent = `${before}\n                ${articleCardsHtml}\n                ${after}`;

        fs.writeFileSync(indexPath, newIndexContent, 'utf8');
        console.log(`✅ Spliced ${articles.length} static article card(s) into index.html`);
    }
} catch (e) {
    console.log('⚠️ Error splicing articles into index.html — index.html was NOT modified:', e.message);
}

// ── SPLICE A STATIC "BROWSE" BLOCK INTO index.html ──
// The SPA's raw HTML links to no lesson, topic or level at all, so the single
// strongest page on the site contributes nothing to discovery. This writes a
// plain-HTML footer navigation block — levels, topics, popular free lessons —
// between two markers so it survives every rebuild.
try {
    const indexPath = 'index.html';
    const navStart = '<!-- STATIC-NAV-START -->';
    const navEnd = '<!-- STATIC-NAV-END -->';
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const navStartIdx = indexContent.indexOf(navStart);
    const navEndIdx = indexContent.indexOf(navEnd);

    if (navStartIdx === -1 || navEndIdx === -1 || navEndIdx < navStartIdx) {
        console.log('⚠️ STATIC-NAV markers not found in index.html — skipping nav splice. index.html was NOT modified.');
    } else {
        // Free lessons that already earn impressions in Search Console.
        const popularSlugs = [
            'phobias', 'unusual-jobs', 'astrology', 'the-star-method-job-interview',
            'purpose', 'europe', 'ai-anxiety', 'dopamine-decor'
        ];
        const popular = popularSlugs
            .map(s => lessons.find(l => slugify(l.title) === s))
            .filter(Boolean);

        const navHtml = `<nav class="footer-nav" aria-label="Browse lesson plans">
    <style>
        .footer-nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:26px;width:100%;max-width:1100px;margin:0 auto 30px;padding:0 20px;text-align:left}
        .footer-nav h3{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#a8a8a8;margin-bottom:10px;font-weight:700}
        .footer-nav a{display:block;color:#cfcfcf;text-decoration:none;font-size:14px;padding:3px 0;line-height:1.4}
        .footer-nav a:hover{color:#fff;text-decoration:underline}
        .footer-nav .all{color:#ffb27a;font-weight:700}
    </style>
    <div>
        <h3>By level</h3>
        ${LEVEL_CODES.map(c => `<a href="${levelUrl(c)}">${LEVEL_NAMES[c]} lesson plans</a>`).join('\n        ')}
    </div>
    <div>
        <h3>By topic</h3>
        ${Object.keys(topicLabels).map(t => `<a href="${topicUrl(t)}">${topicLabels[t]}</a>`).join('\n        ')}
    </div>
    <div>
        <h3>Popular free lessons</h3>
        ${popular.map(l => `<a href="${lessonUrl(slugify(l.title))}">${l.title}</a>`).join('\n        ')}
    </div>
    <div>
        <h3>All lesson plans</h3>
        <a class="all" href="${ALL_LESSONS_URL}">Browse all ${TOTAL_PLUS} plans &rarr;</a>
        <a href="${SITE}/free/">Free lesson plans</a>
        <a href="${SITE}/questions/">Free conversation questions</a>
        <a href="${SITE}/articles/">Teacher's Corner articles</a>
        <a href="${SITE}/about/">About Alex</a>
    </div>
</nav>`;

        const before = indexContent.slice(0, navStartIdx + navStart.length);
        const after = indexContent.slice(navEndIdx);
        fs.writeFileSync(indexPath, `${before}\n${navHtml}\n${after}`, 'utf8');
        console.log(`✅ Spliced static browse navigation into index.html (${lessons.length} plans in the /lessons/ directory)`);
    }
} catch (e) {
    console.log('⚠️ Error splicing nav into index.html — index.html was NOT modified:', e.message);
}

// ── LIVE COUNTS IN index.html ──
// The home page is hand-written, so its copy used to say "100+ lessons / 26
// free" as literals. Those numbers now sit between markers and are rewritten
// from lessons.js on every build, so publishing a lesson updates the home page,
// the pricing page and the stat strip without anybody editing HTML.
try {
    const indexPath = 'index.html';
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const withCounts = indexContent
        .replace(/(<!--COUNT:PLUS-->)[\s\S]*?(<!--\/COUNT-->)/g, (m, open, close) => open + TOTAL_PLUS + close)
        .replace(/(<!--COUNT:FREE-->)[\s\S]*?(<!--\/COUNT-->)/g, (m, open, close) => open + FREE_LESSONS_COUNT + close);
    if (withCounts !== indexContent) {
        fs.writeFileSync(indexPath, withCounts, 'utf8');
        console.log(`index.html counts: ${TOTAL_PLUS} plans, ${FREE_LESSONS_COUNT} free`);
    }
} catch (e) {
    console.log('⚠️ Error updating counts in index.html:', e.message);
}

// ── GENERATE TOPIC & LEVEL ARCHIVE PAGES ──
if (!fs.existsSync('topics')) fs.mkdirSync('topics');
if (!fs.existsSync('levels')) fs.mkdirSync('levels');

function renderLessonCard(l) {
    return `<a href="${lessonUrl(slugify(l.title))}" style="display:block;background:white;border-radius:12px;padding:16px;text-decoration:none;border:1px solid #eee;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:700;color:#333;margin-bottom:6px;">${l.title}</div>
        <div style="font-size:12px;color:#6b6b6b;">${l.levelLabel} &middot; ${l.categoryLabel} &middot; ${l.duration}</div>
    </a>`;
}

function renderArchivePage(heading, description, matchingLessons, canonicalUrl, crossLinksHtml, crumbHtml, proseHtml = '') {
    const image = `${SITE}/images/og-image.jpg`;
    const descMeta = escapeAttr(description);
    const collectionSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: heading,
        description: description,
        url: canonicalUrl,
        isPartOf: { '@type': 'WebSite', name: 'ESL-plans.com', url: `${SITE}/` }
    });
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${heading} | ESL-plans.com</title>
    <meta name="description" content="${descMeta}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:title" content="${escapeAttr(heading)}">
    <meta property="og:description" content="${descMeta}">
    <meta property="og:image" content="${image}">
    <meta property="og:site_name" content="ESL-plans.com">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(heading)}">
    <meta name="twitter:description" content="${descMeta}">
    <meta name="twitter:image" content="${image}">
    <script type="application/ld+json">${collectionSchema}</script>
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}
        .container{max-width:820px;margin:0 auto;padding:40px 20px}
        .logo{font-size:22px;margin-bottom:18px;text-decoration:none;display:block;}
        .logo .esl{font-weight:900;font-style:italic;color:#a9440c;}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif;}
        .crumb{font-size:13px;color:#6b6b6b;margin-bottom:10px;}
        .crumb a{color:#a9440c;text-decoration:underline;}
        h1{color:#a9440c;font-size:26px;margin-bottom:8px;line-height:1.3;}
        p.intro{color:#666;font-size:15px;margin-bottom:20px;line-height:1.6;}
        .prose{margin:28px 0 32px;}
        .prose h2{color:#333;font-size:19px;margin:30px 0 10px;line-height:1.35;}
        .prose h2:first-child{margin-top:0;}
        .prose p{color:#555;font-size:15px;line-height:1.75;margin:0 0 14px;}
        .prose a{color:#a9440c;text-decoration:none;font-weight:600;}
        .cross{background:#fff3e0;border-radius:12px;padding:12px 16px;margin-bottom:24px;font-size:14px;color:#555;line-height:2;}
        .cross a{color:#a9440c;text-decoration:none;font-weight:600;margin-right:12px;white-space:nowrap;}
        .back{display:inline-block;margin-top:24px;color:#a9440c;text-decoration:none;font-weight:600;font-size:14px;}
    </style>
</head>
<body>
    <main class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>
        ${crumbHtml}
        <h1>${heading}</h1>
        <p class="intro">${description}</p>
        ${proseHtml}
        ${crossLinksHtml}
        ${matchingLessons.map(renderLessonCard).join('')}
        <a class="back" href="${ALL_LESSONS_URL}">&larr; Browse all lesson plans</a>
    </main>
    ${renderSiteFooter()}
</body>
</html>`;
}

const levelCrossLinks = `<div class="cross"><strong>Browse by level:</strong>${LEVEL_CODES.map(c => `<a href="${levelUrl(c)}">${LEVEL_NAMES[c]} lesson plans</a>`).join('')}<a href="${ALL_LESSONS_URL}">All lesson plans</a></div>`;

// Prose blocks for the level hubs. These pages already rank for
// "<level> esl plans for adults", so they get real H2s and copy instead of a
// bare list of links: the query family around them is "B2 conversation
// questions", "C1 discussion topics", "B2 speaking lesson plans".
const levelProse = {
    a2: `
        <div class="prose">
            <h2>A2 ESL lesson plans for adults</h2>
            <p>A2 students can survive a shop, a station and a short story about their weekend. What they cannot do yet is keep a conversation going once the easy questions run out. Every A2 plan here is built around one situation and one set of phrases they will actually need — not a vocabulary list to memorise and forget.</p>
            <h2>A2 conversation topics that do not feel childish</h2>
            <p>Adults at A2 are not children at A2. The topics are food, travel, money, work, habits and small everyday decisions, because that is what a forty-year-old talks about. The language is simple; the subject is not.</p>
            <h2>How these A2 plans work online</h2>
            <p>Each plan includes a PDF handout, audio and video, and is designed for a 60-minute one-to-one lesson over a screen share. No printing. The questions are short enough to answer with the grammar the student already has, and there is always an extension task for the student who turns out to be stronger than the level label.</p>
        </div>`,
    b1: `
        <div class="prose">
            <h2>B1 ESL lesson plans for adults</h2>
            <p>B1 is the awkward middle: enough language to say almost anything, not enough control to say it well. Students at this level usually want to talk about real things — work, money, family, travel, the news — but freeze when the topic needs an opinion rather than a fact. These plans are built to push them from describing into arguing.</p>
            <h2>B1 conversation questions and discussion topics</h2>
            <p>Each lesson opens with questions that a B1 student can answer in one sentence, then escalates to questions that need two or three. That progression is deliberate: it gives them a running start before the difficult part. If you only need the questions, there are free sets on <a href="${SITE}/questions/">psychology, work, travel and more</a>.</p>
            <h2>B1 speaking lesson plans for online tutors</h2>
            <p>Every plan is one-to-one friendly: PDF, audio, video, and a lesson flow that fills 60-90 minutes without padding. Grammar and vocabulary are tied to the topic instead of bolted on, which is why students remember them a week later.</p>
        </div>`,
    b2: `
        <div class="prose">
            <h2>What a B2 ESL lesson plan has to do</h2>
            <p>B2 is the level where students stop needing the language and start needing a reason to use it. They can already explain their job, tell a story and disagree politely. What they cannot always do is hold a position under pressure, notice register, or say the same thing three different ways. So every B2 plan here is built around one argument or one decision, not a vocabulary list.</p>
            <h2>B2 ESL conversation questions</h2>
            <p>Conversation is the engine. The questions move from concrete to uncomfortable: first what happened, then what you think, then what you would defend in front of someone who disagrees. If you only want the questions, the <a href="${SITE}/questions/">free conversation-question sets</a> cover psychology, work, travel, food, technology, society, relationships and media.</p>
            <h2>B2 speaking lesson plans for online tutors</h2>
            <p>These are made for one-to-one online teaching: a screen-shareable PDF, links that open in a browser, nothing to print. A typical B2 lesson runs 60-90 minutes — warm-up, core task, feedback you can actually get through. Teaching in 45-minute blocks? Split the plan at the second page; each half still works on its own.</p>
            <h2>What B2 students usually still get wrong</h2>
            <p>Not grammar. Register is the big one — "kids" in a job interview, "furthermore" in a bar. Then hedging: B2 students state opinions like facts. Both are easier to fix inside a topic they care about than inside a grammar exercise, which is the whole point of this library.</p>
        </div>`,
    c1: `
        <div class="prose">
            <h2>What a C1 lesson plan has to do</h2>
            <p>C1 students are the easiest to bore and the hardest to impress. They have opinions, they have vocabulary, and they can smell a textbook exercise from across the room. A C1 lesson only works if the topic is genuinely difficult — an ethical trade-off, an uncomfortable statistic, a position they have never had to defend.</p>
            <h2>C1 discussion topics that survive advanced students</h2>
            <p>The topics here are the ones adults argue about when the small talk is over: status, debt, authenticity, attention, the ethics of work, what progress actually costs. Nothing is "advanced" because the words are long; it is advanced because there is no safe answer. If you only want the questions, start with the <a href="${SITE}/questions/">free conversation-question sets</a>.</p>
            <h2>C1 speaking lesson plans and exam-style tasks</h2>
            <p>Plans include a PDF, audio and video, and are built for 90-minute one-to-one sessions, though most split cleanly into two. You get discussion, a listening or reading text with real difficulty, and language work that targets precision — collocation, connotation, register — rather than another round of conditionals.</p>
            <h2>Why there is no "advanced grammar" lesson here</h2>
            <p>At C1, grammar is rarely the bottleneck. Precision is. A student who says "the government should invest more" is grammatically fine and communicatively vague. The lessons work on the second problem, because that is the one that shows up in a meeting, an interview or an exam.</p>
        </div>`
};

const levelDescriptions = {
    a2: n => `${n} A2 ESL lesson plans for adults — simple, conversation-led materials with PDF, audio and video. Zero prep for online tutors.`,
    b1: n => `${n} B1 ESL lesson plans for adults — conversation-driven, zero-prep materials for online tutors. PDF, audio and video included.`,
    b2: n => `${n} B2 ESL lesson plans for adults: conversation, speaking and discussion topics with PDF, audio and video. Zero prep for online tutors.`,
    c1: n => `${n} C1 ESL lesson plans for adults — advanced conversation and discussion topics with PDF, audio and video. Zero prep for online tutors.`
};

const topicCrossLinks = `<div class="cross"><strong>Browse by topic:</strong>${Object.keys(topicLabels).map(t => `<a href="${topicUrl(t)}">${topicLabels[t]}</a>`).join('')}<a href="${ALL_LESSONS_URL}">All lesson plans</a></div>`;

const topicArchiveUrls = [];
const topicArchiveLastmod = {};
Object.keys(topicLabels).forEach(topicCode => {
    const matching = lessons.filter(l => (l.topics||[]).includes(topicCode));
    if (matching.length === 0) return;
    const heading = `${topicLabels[topicCode]} ESL Lesson Plans for Adults`;
    const description = `Browse ${matching.length} ESL lesson plan${matching.length===1?'':'s'} on ${topicLabels[topicCode].toLowerCase()} — conversation-driven materials for adult learners and online ESL tutors.`;
    const url = topicUrl(topicCode);
    const crumb = `<nav class="crumb" aria-label="Breadcrumb"><a href="${SITE}/">Home</a> &rsaquo; <span>${topicLabels[topicCode]} lesson plans</span></nav>`;
    const qPage = conversationQuestions.find(q => q.topic === topicCode);
    const topicCross = qPage
        ? `${levelCrossLinks}<div class="cross"><strong>Just want the questions?</strong><a href="${SITE}/questions/${qPage.slug}">ESL conversation questions about ${topicLabels[topicCode].toLowerCase()}</a></div>`
        : levelCrossLinks;
    fs.writeFileSync(`topics/${topicCode}.html`, renderArchivePage(heading, description, matching, url, topicCross, crumb), 'utf8');
    topicArchiveUrls.push(url);
    topicArchiveLastmod[url] = latestDate(matching);
    console.log(`Topic archive: topics/${topicCode}.html (${matching.length} lessons)`);
});

const levelArchiveUrls = [];
const levelArchiveLastmod = {};
LEVEL_CODES.forEach(levelCode => {
    const matching = lessons.filter(l => (l.level||'').split('-').includes(levelCode));
    if (matching.length === 0) return;
    const heading = `${LEVEL_NAMES[levelCode]} ESL Lesson Plans for Adults`;
    const description = (levelDescriptions[levelCode] || (n => `Browse ${n} ${LEVEL_NAMES[levelCode]}-level ESL lesson plans for adult learners — conversation-driven, zero-prep materials for online ESL tutors.`))(matching.length);
    const url = levelUrl(levelCode);
    const crumb = `<nav class="crumb" aria-label="Breadcrumb"><a href="${SITE}/">Home</a> &rsaquo; <span>${LEVEL_NAMES[levelCode]} lesson plans</span></nav>`;
    const prose = levelProse[levelCode] || '';
    fs.writeFileSync(`levels/${levelCode}.html`, renderArchivePage(heading, description, matching, url, topicCrossLinks, crumb, prose), 'utf8');
    levelArchiveUrls.push(url);
    levelArchiveLastmod[url] = latestDate(matching);
    console.log(`Level archive: levels/${levelCode}.html (${matching.length} lessons)`);
});

// ── GENERATE /questions/ — FREE CONVERSATION-QUESTION PAGES ──
// These target the biggest free-intent query family in the niche
// ("ESL conversation questions about X"). They cost the reader nothing, need no
// account, and hand off to the matching lessons at the bottom.
if (!fs.existsSync('questions')) fs.mkdirSync('questions');

const questionUrl = slug => `${SITE}/questions/${slug}`;
const questionPageUrls = [];

function renderQuestionPage(q) {
    const url = questionUrl(q.slug);
    const qMeta = String(q.meta || q.intro || '').replace(/\s+/g, ' ').trim();
    const topicLessons = lessons.filter(l => (l.topics || []).includes(q.topic));
    const freePicks = topicLessons.filter(l => l.isFree === true).slice(0, 2);
    const paidPicks = topicLessons.filter(l => l.isFree !== true).slice(0, 2);
    const picks = [...freePicks, ...paidPicks];
    const total = q.groups.reduce((n, g) => n + g.items.length, 0);
    const others = conversationQuestions.filter(o => o.slug !== q.slug);

    const groupsHtml = q.groups.map(g => `
        <section>
            <h2>${g.heading}</h2>
            <ol class="qlist">
                ${g.items.map(item => `<li>${item}</li>`).join('')}
            </ol>
        </section>`).join('');

    const picksHtml = picks.length ? `
        <div class="cta">
            <h2>Want the full lesson on this?</h2>
            <p>These questions come out of real lesson plans — with the reading, audio, video and vocabulary already built around them.</p>
            <div class="picks">
                ${picks.map(l => `<a href="${lessonUrl(slugify(l.title))}">
                    <strong>${l.title}</strong>
                    <span>${l.levelLabel} &middot; ${l.duration}${l.isFree === true ? ' &middot; free' : ''}</span>
                </a>`).join('')}
            </div>
            <a class="all" href="${topicUrl(q.topic)}">All ${topicLabels[q.topic] || q.topic} lesson plans &rarr;</a>
        </div>` : '';

    const schemaArticle = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: q.heading,
        description: q.intro,
        url: url,
        inLanguage: 'en',
        isAccessibleForFree: true,
        author: { '@type': 'Person', name: AUTHOR_NAME },
        publisher: { '@type': 'Organization', name: 'ESL-plans.com', url: `${SITE}/` },
        about: { '@type': 'Thing', name: `ESL conversation questions: ${q.topic}` }
    });
    const schemaCrumb = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
            { '@type': 'ListItem', position: 2, name: 'Conversation questions', item: `${SITE}/questions/` },
            { '@type': 'ListItem', position: 3, name: q.title, item: url }
        ]
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${q.title} | ESL-plans.com</title>
    <meta name="description" content="${escapeAttr(qMeta.slice(0, 300))}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${escapeAttr(q.title)}">
    <meta property="og:description" content="${escapeAttr(qMeta.slice(0, 200))}">
    <meta property="og:image" content="${SITE}/images/og-image.jpg">
    <meta property="og:site_name" content="ESL-plans.com">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(q.title)}">
    <meta name="twitter:description" content="${escapeAttr(qMeta.slice(0, 200))}">
    <meta name="twitter:image" content="${SITE}/images/og-image.jpg">
    <script type="application/ld+json">${schemaArticle}</script>
    <script type="application/ld+json">${schemaCrumb}</script>
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}
        .container{max-width:760px;margin:0 auto;padding:40px 20px}
        .logo{font-size:22px;margin-bottom:18px;text-decoration:none;display:block;}
        .logo .esl{font-weight:900;font-style:italic;color:#a9440c;}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif;}
        .crumb{font-size:13px;color:#6b6b6b;margin-bottom:10px;}
        .crumb a{color:#a9440c;text-decoration:underline;}
        h1{color:#a9440c;font-size:28px;margin-bottom:8px;line-height:1.3;}
        p.intro{color:#666;font-size:15px;margin-bottom:6px;line-height:1.65;}
        p.note{color:#6b6b6b;font-size:13px;margin-bottom:26px;}
        h2{color:#333;font-size:17px;margin:32px 0 10px;}
        ol.qlist{margin:0;padding-left:22px;color:#444;font-size:16px;line-height:1.75;}
        ol.qlist li{margin-bottom:10px;}
        .cta{background:white;border:1px solid #f0e0d0;border-radius:14px;padding:22px;margin-top:36px;}
        .cta h2{margin-top:0;}
        .cta p{color:#666;font-size:15px;line-height:1.6;}
        .picks{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0;}
        .picks a{flex:1;min-width:210px;background:#fff8f2;border:1px solid #f0e0d0;border-radius:12px;padding:12px 14px;text-decoration:none;display:block;}
        .picks strong{display:block;color:#333;font-size:14px;margin-bottom:3px;}
        .picks span{color:#6b6b6b;font-size:12px;}
        .all{color:#a9440c;text-decoration:none;font-weight:700;font-size:14px;}
        .more{margin-top:34px;font-size:14px;line-height:2.1;}
        .more a{color:#a9440c;text-decoration:none;font-weight:600;margin-right:14px;white-space:nowrap;}
        .back{display:inline-block;margin-top:26px;color:#a9440c;text-decoration:none;font-weight:600;font-size:14px;}
    </style>
</head>
<body>
    <main class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>
        <nav class="crumb" aria-label="Breadcrumb"><a href="${SITE}/">Home</a> &rsaquo; <a href="${SITE}/questions/">Conversation questions</a> &rsaquo; <span>${topicLabels[q.topic] || q.topic}</span></nav>
        <h1>${q.heading}</h1>
        <p class="intro">${q.intro}</p>
        <p class="note">${total} questions &middot; free to use, no signup &middot; B1-C1</p>
        ${groupsHtml}
        ${picksHtml}
        <div class="more">
            <strong>More conversation questions:</strong><br>
            ${others.map(o => `<a href="${questionUrl(o.slug)}">${topicLabels[o.topic] || o.topic}</a>`).join('')}
            <a href="${ALL_LESSONS_URL}">All lesson plans</a>
        </div>
        <a class="back" href="${SITE}/">&larr; Back to ESL-plans.com</a>
    </main>
    ${renderSiteFooter()}
</body>
</html>`;
}

conversationQuestions.forEach(q => {
    const url = questionUrl(q.slug);
    fs.writeFileSync(`questions/${q.slug}.html`, renderQuestionPage(q), 'utf8');
    questionPageUrls.push(url);
    console.log(`Question page: questions/${q.slug}.html (${q.groups.reduce((n, g) => n + g.items.length, 0)} questions)`);
});

// A plain index at /questions/ so the group is crawlable from one URL.
if (conversationQuestions.length) {
    const listItems = conversationQuestions.map(q => {
        const total = q.groups.reduce((n, g) => n + g.items.length, 0);
        return `<a class="card" href="${questionUrl(q.slug)}">
            <span class="card-title">${q.title}</span>
            <span class="card-meta">${total} questions &middot; ${topicLabels[q.topic] || q.topic} &middot; free</span>
        </a>`;
    }).join('');
    const idxHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Free ESL Conversation Questions for Adults | ESL-plans.com</title>
    <meta name="description" content="Free ESL conversation questions for adult learners, grouped by topic: psychology, work, travel, food, technology, society, relationships and media. No signup.">
    <link rel="canonical" href="${SITE}/questions/">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${SITE}/questions/">
    <meta property="og:title" content="Free ESL Conversation Questions for Adults">
    <meta property="og:description" content="Free ESL conversation questions for adult learners, grouped by topic: psychology, work, travel, food, technology, society, relationships and media. No signup.">
    <meta property="og:image" content="${SITE}/images/og-image.jpg">
    <meta property="og:site_name" content="ESL-plans.com">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Free ESL Conversation Questions for Adults">
    <meta name="twitter:description" content="Free ESL conversation questions for adult learners, grouped by topic: psychology, work, travel, food, technology, society, relationships and media. No signup.">
    <meta name="twitter:image" content="${SITE}/images/og-image.jpg">
    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Free ESL Conversation Questions for Adults', url: `${SITE}/questions/`, isPartOf: { '@type': 'WebSite', name: 'ESL-plans.com', url: `${SITE}/` } })}</script>
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}
        .container{max-width:760px;margin:0 auto;padding:40px 20px}
        .logo{font-size:22px;margin-bottom:18px;text-decoration:none;display:block;}
        .logo .esl{font-weight:900;font-style:italic;color:#a9440c;}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif;}
        .crumb{font-size:13px;color:#6b6b6b;margin-bottom:10px;}
        .crumb a{color:#a9440c;text-decoration:underline;}
        h1{color:#a9440c;font-size:28px;margin-bottom:8px;}
        p.intro{color:#666;font-size:15px;margin-bottom:26px;line-height:1.6;}
        .card{display:block;background:white;border-radius:12px;padding:16px;text-decoration:none;border:1px solid #eee;margin-bottom:10px;}
        .card-title{font-size:15px;font-weight:700;color:#333;}
        .card-meta{display:block;font-size:12px;color:#6b6b6b;margin-top:4px;}
        .back{display:inline-block;margin-top:26px;color:#a9440c;text-decoration:none;font-weight:600;font-size:14px;}
    </style>
</head>
<body>
    <main class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>
        <nav class="crumb" aria-label="Breadcrumb"><a href="${SITE}/">Home</a> &rsaquo; <span>Conversation questions</span></nav>
        <h1>Free ESL Conversation Questions for Adults</h1>
        <p class="intro">Discussion questions you can use tomorrow, grouped by topic. Free, no account, no download. Each set is drawn from real lessons in the library — the full versions add the reading, audio and vocabulary.</p>
        ${listItems}
        <a class="back" href="${ALL_LESSONS_URL}">&larr; Browse all lesson plans</a>
    </main>
    ${renderSiteFooter()}
</body>
</html>`;
    fs.writeFileSync('questions/index.html', idxHtml, 'utf8');
    console.log(`Question index: questions/index.html (${conversationQuestions.length} pages)`);
}

// ── GENERATE /lessons/ — THE CRAWLABLE DIRECTORY ──
// The homepage is a JavaScript app: its raw HTML links to no lesson at all.
// This page is plain HTML with a direct link to every lesson, grouped by
// level, plus a topic grid. It is the crawl hub the site never had.
function renderDirectoryPage() {
    const freeCount = lessons.filter(l => l.isFree === true).length;
    const grouped = LEVEL_CODES.map(code => ({ code, items: lessons.filter(l => primaryLevelCode(l) === code) }))
        .filter(g => g.items.length > 0);
    const assigned = new Set(grouped.flatMap(g => g.items));
    const unassigned = lessons.filter(l => !assigned.has(l));

    const sections = grouped.map(g => `
        <section>
            <h2>${LEVEL_NAMES[g.code]} ESL lesson plans</h2>
            <p class="count">${g.items.length} plans${g.items.some(l => l.isFree === true) ? `, ${g.items.filter(l => l.isFree === true).length} free` : ''}</p>
            ${g.items.map(l => `<a class="card" href="${lessonUrl(slugify(l.title))}">
                <span class="card-title">${l.title}${l.isFree === true ? '<span class="free">FREE</span>' : ''}</span>
                <span class="card-meta">${l.categoryLabel} &middot; ${l.duration} &middot; ${l.mediaType}</span>
            </a>`).join('')}
        </section>`).join('');

    const extra = unassigned.length ? `
        <section>
            <h2>More lesson plans</h2>
            <p class="count">${unassigned.length} plans</p>
            ${unassigned.map(l => `<a class="card" href="${lessonUrl(slugify(l.title))}">
                <span class="card-title">${l.title}</span>
                <span class="card-meta">${l.levelLabel} &middot; ${l.duration}</span>
            </a>`).join('')}
        </section>` : '';

    const title = `All ESL Lesson Plans for Adults — ${lessons.length} Plans by Level | ESL-plans.com`;
    const description = `Browse all ${lessons.length} conversation-driven ESL lesson plans for adult learners, sorted by level (A2 to C1). ${freeCount} free plans, zero prep, ready to download.`;
    const schema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `All ESL Lesson Plans for Adults`,
        description: description,
        url: ALL_LESSONS_URL,
        isPartOf: { '@type': 'WebSite', name: 'ESL-plans.com', url: `${SITE}/` },
        hasPart: lessons.map(l => ({ '@type': 'Course', name: l.title, url: lessonUrl(slugify(l.title)) }))
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${escapeAttr(description)}">
    <link rel="canonical" href="${ALL_LESSONS_URL}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${ALL_LESSONS_URL}">
    <meta property="og:title" content="All ESL Lesson Plans for Adults | ESL-plans.com">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:image" content="${SITE}/images/og-image.jpg">
    <meta property="og:site_name" content="ESL-plans.com">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="All ESL Lesson Plans for Adults | ESL-plans.com">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${SITE}/images/og-image.jpg">
    <script type="application/ld+json">${schema}</script>
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}
        .container{max-width:820px;margin:0 auto;padding:40px 20px}
        .logo{font-size:22px;margin-bottom:18px;text-decoration:none;display:block;}
        .logo .esl{font-weight:900;font-style:italic;color:#a9440c;}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif;}
        .crumb{font-size:13px;color:#6b6b6b;margin-bottom:10px;}
        .crumb a{color:#a9440c;text-decoration:underline;}
        h1{color:#a9440c;font-size:28px;margin-bottom:8px;line-height:1.3;}
        p.intro{color:#666;font-size:15px;margin-bottom:24px;line-height:1.6;}
        .topics{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;}
        .topic-tag{background:#fff3e0;color:#a9440c;border-radius:20px;padding:5px 14px;font-size:13px;font-weight:600;text-decoration:none;}
        h2{color:#333;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:34px 0 4px;}
        p.count{color:#6b6b6b;font-size:13px;margin-bottom:12px;}
        .card{display:block;background:white;border-radius:12px;padding:14px 16px;text-decoration:none;border:1px solid #eee;margin-bottom:10px;}
        .card-title{font-size:15px;font-weight:700;color:#333;}
        .free{font-size:11px;color:#2e7d32;font-weight:700;margin-left:8px;}
        .card-meta{display:block;font-size:12px;color:#6b6b6b;margin-top:4px;}
        .back{display:inline-block;margin-top:26px;color:#a9440c;text-decoration:none;font-weight:600;font-size:14px;}
    </style>
</head>
<body>
    <main class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>
        <nav class="crumb" aria-label="Breadcrumb"><a href="${SITE}/">Home</a> &rsaquo; <span>All lesson plans</span></nav>
        <h1>All ESL Lesson Plans for Adults</h1>
        <p class="intro">${description} Every plan is conversation-driven, zero-prep, and built for online tutors working with adult learners.</p>
        <div class="topics">
            ${Object.keys(topicLabels).map(t => `<a class="topic-tag" href="${topicUrl(t)}">${topicLabels[t]}</a>`).join('')}
        </div>
        <div class="topics">
            ${LEVEL_CODES.map(c => `<a class="topic-tag" href="${levelUrl(c)}">${LEVEL_NAMES[c]} lesson plans</a>`).join('')}
            ${conversationQuestions.length ? `<a class="topic-tag" href="${SITE}/questions/">Conversation questions</a>` : ''}
        </div>
        ${sections}
        ${extra}
        <a class="back" href="${SITE}/">&larr; Back to ESL-plans.com</a>
    </main>
    ${renderSiteFooter()}
</body>
</html>`;
}

if (lessons.some(l => slugify(l.title) === 'index')) {
    console.log('⚠️ A lesson slug collides with lessons/index.html — directory page skipped.');
} else {
    fs.writeFileSync('lessons/index.html', renderDirectoryPage(), 'utf8');
    console.log(`Directory: lessons/index.html (${lessons.length} lessons)`);
}

// ── STATIC /about/ ──
// The About copy only lived inside the SPA, so /about/ was a 404. Anyone
// checking who is behind the site (a teacher deciding to pay, a journalist,
// an AI answer engine building a citation) had no page to land on.
if (!fs.existsSync('about')) fs.mkdirSync('about');
{
    const aboutDesc = `${AUTHOR_NAME} is a practising online ESL tutor with 15 years of experience teaching adults. The teacher behind the ${TOTAL_PLUS} lesson plans on ESL-plans.com.`;
    const aboutSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        url: `${SITE}/about/`,
        name: `About ${AUTHOR_NAME} — ESL-plans.com`,
        description: aboutDesc,
        mainEntity: { '@type': 'Person', name: AUTHOR_NAME, url: AUTHOR_URL, sameAs: AUTHOR_SAMEAS, jobTitle: 'Online ESL tutor', knowsLanguage: ['en', 'ru'], worksFor: { '@type': 'Organization', name: 'ESL-plans.com', url: `${SITE}/` } }
    });
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About ${AUTHOR_NAME} — ESL Lesson Plans for Adults | ESL-plans.com</title>
    <meta name="description" content="${escapeAttr(aboutDesc)}">
    <link rel="canonical" href="${SITE}/about/">
    <meta property="og:type" content="profile">
    <meta property="og:url" content="${SITE}/about/">
    <meta property="og:title" content="About ${AUTHOR_NAME} — ESL-plans.com">
    <meta property="og:description" content="${escapeAttr(aboutDesc)}">
    <meta property="og:image" content="${SITE}/images/alex.jpg">
    <meta property="og:site_name" content="ESL-plans.com">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">${aboutSchema}</script>
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0;color:#333;}
        .container{max-width:820px;margin:0 auto;padding:40px 20px;}
        a.logo{font-size:22px;margin-bottom:28px;text-decoration:none;display:block;}
        .logo .esl{font-weight:900;font-style:italic;color:#a9440c;}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif;}
        h1{color:#a9440c;font-size:30px;line-height:1.25;margin:0 0 8px;}
        .standfirst{color:#5f5f5f;font-size:15px;margin:0 0 28px;}
        .bio{display:grid;grid-template-columns:180px 1fr;gap:26px;align-items:start;background:white;border-radius:18px;padding:24px;border:1px solid #f0e6dd;}
        .bio img{width:100%;border-radius:14px;display:block;}
        .bio p{line-height:1.75;margin:0 0 14px;font-size:15px;}
        .bio p:last-child{margin-bottom:0;}
        h2{font-size:16px;text-transform:uppercase;letter-spacing:0.6px;color:#333;margin:36px 0 12px;}
        ul.facts{color:#444;line-height:1.9;padding-left:20px;}
        .links a{display:inline-block;margin:0 12px 10px 0;color:#a9440c;text-decoration:none;font-weight:600;font-size:14px;}
        .cta{margin-top:32px;background:white;border-radius:18px;padding:24px;text-align:center;border:1px solid #f0e6dd;}
        .cta a{display:inline-block;background:#b8480d;color:white;padding:13px 30px;border-radius:26px;text-decoration:none;font-weight:800;}
        @media(max-width:600px){.bio{grid-template-columns:1fr}.bio img{max-width:200px}}
    </style>
</head>
<body>
    <main class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>
        <h1>About ${AUTHOR_NAME}</h1>
        <p class="standfirst">One teacher, 15 years of adult learners online, and every lesson plan on this site written by the same person.</p>

        <div class="bio">
            <img src="${SITE}/images/alex.jpg" alt="${AUTHOR_NAME}, online ESL tutor and founder of ESL-plans.com" width="180" height="176">
            <div>
                <p>Hi there, I'm <strong>Alex!</strong> Back when I was a student, a teacher of mine used to scribble on the board: <em>"Learn without learning!"</em> It completely flipped my perspective on education. I followed in those footsteps and became an English tutor myself — until I thought, why not turn the tables? <em>"Teach without teaching!"</em> I've spent the last <strong>15 years</strong> "not teaching" and having a blast instead.</p>
                <p>I specialise in teaching <strong>adult learners online</strong> — professionals, executives, and curious minds aged 25-55 who want real conversations, not textbook drills. My students have ranged from Russian IT engineers to French marketing directors to Brazilian entrepreneurs. What they all have in common: they're smart, busy, and bored of <em>Spotlight</em> and <em>English File.</em> So I build my own <strong>ESL lesson plans for adults</strong> filled with original topics and a healthy spoonful of weirdness and quirks.</p>
                <p><strong>My goal is to help online ESL tutors break out of that rigid routine</strong> and inspire them to create their own worlds. Our profession offers unmatched freedom and the chance to build genuine bonds with our students — no, wait, I call them <strong><em>"friends!"</em></strong></p>
                <p>Everything here is tested on real students before it is published. Each plan takes up to <strong>6 hours</strong> to build: the topic, the reading, the audio, the questions, the vocabulary, the answer key.</p>
            </div>
        </div>

        <h2>What I actually do</h2>
        <ul class="facts">
            <li>Teach adults online, one to one and in small groups — still taking students.</li>
            <li>Write every lesson plan in the library myself. No committee, no freelancers, no AI-generated filler.</li>
            <li>Build each plan around a real article, video or podcast, so the conversation has something concrete to stand on.</li>
            <li>Keep ${FREE_LESSONS_COUNT} plans completely free, no account required.</li>
        </ul>

        <h2>Find me</h2>
        <p class="links">
            <a href="https://t.me/eslplans" target="_blank" rel="noopener">Telegram</a>
            <a href="https://www.linkedin.com/in/alex-esl-plans-8a3451235/" target="_blank" rel="noopener">LinkedIn</a>
            <a href="https://www.instagram.com/eslplans" target="_blank" rel="noopener">Instagram</a>
            <a href="https://www.threads.com/@eslplans" target="_blank" rel="noopener">Threads</a>
            <a href="https://bsky.app/profile/esl-plans.com" target="_blank" rel="noopener">Bluesky</a>
            <a href="https://medium.com/@esl-plans" target="_blank" rel="noopener">Medium</a>
            <a href="https://www.reddit.com/r/FreeESLLessonPlans/" target="_blank" rel="noopener">Reddit</a>
            <a href="https://au.pinterest.com/alexeslplans/esl-lesson-plans/" target="_blank" rel="noopener">Pinterest</a>
            <a href="https://eslplanscomconversationdriveneslplans.quora.com/" target="_blank" rel="noopener">Quora</a>
            <a href="https://www.freeed.com/users/551959" target="_blank" rel="noopener">Freeed</a>
            <a href="https://en.islcollective.com/portfolio/12970284" target="_blank" rel="noopener">iSLCollective</a>
        </p>
        <p style="font-size:14px;color:#5f5f5f;">Or email: <a href="mailto:esl-plans@proton.me" style="color:#a9440c;">esl-plans@proton.me</a></p>

        <div class="cta">
            <p style="margin:0 0 14px;font-weight:700;">Want the whole library?</p>
            <a href="${SITE}/#pricing">See plans and pricing →</a>
        </div>

        <p style="margin-top:24px;"><a class="back" href="${ALL_LESSONS_URL}" style="color:#a9440c;text-decoration:none;font-weight:600;font-size:14px;">&larr; Browse all lesson plans</a></p>
    </main>
    ${renderSiteFooter()}
</body>
</html>`;
    fs.writeFileSync('about/index.html', html, 'utf8');
    console.log('About page: about/index.html');
}

// ── STATIC /free/ ──
// "Free ESL lesson plans for adults" is the highest-intent query a teacher can
// type, and the only answer used to be a JS filter inside the app. This is a
// real, static page listing all free plans.
if (!fs.existsSync('free')) fs.mkdirSync('free');
{
    const freeLessons = lessons.filter(l => l.isFree === true);
    const freeDesc = `${freeLessons.length} free ESL lesson plans for adult learners. PDF, audio and video included, no account and no signup. A2 to C1.`;
    const freeList = LEVEL_CODES.map(code => {
        const items = freeLessons.filter(l => primaryLevelCode(l) === code);
        if (!items.length) return '';
        return `<h2>${LEVEL_NAMES[code]} free lesson plans</h2>
        <ul class="lesson-list">
            ${items.map(l => `<li><a href="${lessonUrl(slugify(l.title))}">${l.title}</a><span class="li-meta">${l.levelLabel} &middot; ${l.duration} &middot; ${l.mediaType}</span></li>`).join('\n            ')}
        </ul>`;
    }).join('\n        ');
    const freeSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        url: `${SITE}/free/`,
        name: 'Free ESL Lesson Plans for Adults',
        description: freeDesc,
        mainEntity: { '@type': 'ItemList', numberOfItems: freeLessons.length, itemListElement: freeLessons.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: lessonUrl(slugify(l.title)), name: l.title })) }
    });
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Free ESL Lesson Plans for Adults — ${freeLessons.length} Complete Plans | ESL-plans.com</title>
    <meta name="description" content="${escapeAttr(freeDesc)}">
    <link rel="canonical" href="${SITE}/free/">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${SITE}/free/">
    <meta property="og:title" content="Free ESL Lesson Plans for Adults">
    <meta property="og:description" content="${escapeAttr(freeDesc)}">
    <meta property="og:image" content="${SITE}/images/og-image.jpg">
    <meta property="og:site_name" content="ESL-plans.com">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">${freeSchema}</script>
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0;color:#333;}
        .container{max-width:820px;margin:0 auto;padding:40px 20px;}
        a.logo{font-size:22px;margin-bottom:28px;text-decoration:none;display:block;}
        .logo .esl{font-weight:900;font-style:italic;color:#a9440c;}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif;}
        h1{color:#a9440c;font-size:30px;line-height:1.25;margin:0 0 10px;}
        .intro{color:#555;font-size:16px;line-height:1.7;margin:0 0 18px;}
        h2{font-size:15px;text-transform:uppercase;letter-spacing:0.6px;color:#333;margin:34px 0 10px;}
        .lesson-list{list-style:none;padding:0;margin:0;}
        .lesson-list li{background:white;border:1px solid #f0e6dd;border-radius:12px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;}
        .lesson-list a{color:#a9440c;text-decoration:none;font-weight:700;font-size:15px;}
        .lesson-list a:hover{text-decoration:underline;}
        .li-meta{color:#6b6b6b;font-size:12px;white-space:nowrap;}
        .note{background:white;border-left:4px solid #c95210;border-radius:14px;padding:16px 20px;margin:28px 0;line-height:1.7;font-size:15px;}
        .cta{text-align:center;margin-top:30px;}
        .cta a{display:inline-block;background:#b8480d;color:white;padding:13px 30px;border-radius:26px;text-decoration:none;font-weight:800;}
    </style>
</head>
<body>
    <main class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>
        <h1>Free ESL Lesson Plans for Adults</h1>
        <p class="intro">${freeLessons.length} complete lesson plans you can download and teach today. Each one includes the PDF handout, the audio or video, the vocabulary and the discussion questions. No account, no signup, no card.</p>
        <p class="intro">These are full lessons, not samples or worksheets. They are the same format as the paid library, just older plans I have made free.</p>

        ${freeList}

        <div class="note">
            <strong>Want the rest?</strong> The paid library has ${lessons.length - freeLessons.length} more plans across A2 to C1, and new ones appear every week. One teacher writes all of them. <a href="${SITE}/#pricing" style="color:#a9440c;font-weight:700;">See pricing →</a>
        </div>

        <div class="cta"><a href="${ALL_LESSONS_URL}">Browse all ${lessons.length} lesson plans →</a></div>

        <p style="margin-top:24px;font-size:14px;color:#5f5f5f;">Also free: <a href="${SITE}/questions/" style="color:#a9440c;font-weight:600;">${conversationQuestions.length || 8} sets of ESL conversation questions</a> &middot; <a href="${SITE}/articles/" style="color:#a9440c;font-weight:600;">Teacher's Corner articles</a></p>
    </main>
    ${renderSiteFooter()}
</body>
</html>`;
    fs.writeFileSync('free/index.html', html, 'utf8');
    console.log(`Free page: free/index.html (${freeLessons.length} free lessons)`);
}

// ── RSS FEED ──
// Articles and new lessons in one feed, so teachers can subscribe and so
// aggregators/LLM crawlers get a dated, ordered list of what changed.
{
    const xmlEscape = s => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const feedItems = [
        ...lessons.map(l => ({
            title: l.title,
            url: lessonUrl(slugify(l.title)),
            desc: String(lessonDescriptions[l.title] || l.description || '').replace(/\s+/g, ' ').slice(0, 320),
            date: l.dateAdded || today
        })),
        ...articles.map(a => ({
            title: a.title,
            url: articleUrl(slugify(a.title)),
            desc: String(articleDescriptions[a.title] || (a.intro || a.body || '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 320),
            date: toISODate(a.date)
        }))
    ]
        .filter(i => i.date)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 50);

    const itemXml = feedItems.map(i => `    <item>
        <title>${xmlEscape(i.title)}</title>
        <link>${i.url}</link>
        <guid isPermaLink="true">${i.url}</guid>
        <pubDate>${new Date(`${i.date}T00:00:00Z`).toUTCString()}</pubDate>
        <description>${xmlEscape(i.desc)}</description>
    </item>`).join('\n');

    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>ESL-plans.com — new lesson plans for adults</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>New ESL lesson plans and articles for teachers of adult learners. One teacher, ${TOTAL_PLUS} plans, A2-C1.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemXml}
</channel>
</rss>`;
    fs.writeFileSync('feed.xml', feed, 'utf8');
    console.log(`RSS feed: feed.xml (${feedItems.length} items)`);
}

// ── GENERATE SITEMAP ──
// One <loc> per page, in the same extensionless form used by canonical tags
// and internal links. lastmod is each page's real date instead of "today",
// so Google can tell what actually changed. /docs/terms.html is omitted:
// robots.txt blocks it, so listing it was contradictory.

const lessonUrls = lessons.map(l => `    <url>
        <loc>${lessonUrl(slugify(l.title))}</loc>
        <lastmod>${l.dateAdded || today}</lastmod>
    </url>`).join('\n');

const articleUrls = articles.map(a => `    <url>
        <loc>${articleUrl(slugify(a.title))}</loc>
        <lastmod>${toISODate(a.date)}</lastmod>
    </url>`).join('\n');

// The /articles/ hub only exists when at least one article does.
const articleIndexUrls = articles.length ? `    <url>
        <loc>${SITE}/articles/</loc>
        <lastmod>${articles.map(a => toISODate(a.date)).sort().pop() || today}</lastmod>
    </url>` : '';

const archiveUrls = [...topicArchiveUrls, ...levelArchiveUrls].map(u => `    <url>
        <loc>${u}</loc>
        <lastmod>${topicArchiveLastmod[u] || levelArchiveLastmod[u] || today}</lastmod>
    </url>`).join('\n');

const questionSitemapUrls = [...(conversationQuestions.length ? [`${SITE}/questions/`] : []), ...questionPageUrls].map(u => `    <url>
        <loc>${u}</loc>
        <lastmod>${today}</lastmod>
    </url>`).join('\n');

const hubUrls = [`${SITE}/free/`, `${SITE}/about/`].map(u => `    <url>
        <loc>${u}</loc>
        <lastmod>${today}</lastmod>
    </url>`).join('\n');

// ── llms.txt ──
// Generated rather than hand-maintained: the library size and the free count
// used to live in this file as literals, which is exactly the kind of number
// that goes stale silently. An LLM reading a stale count is worse than reading
// no count at all.
{
    const llms = `# ESL-plans.com

> Ready-made ESL lesson plans for adult learners. Conversation-driven topics covering psychology, business, technology and society. PDF, audio and video included, A2–C1 levels, built for online ESL tutors.

## About
ESL-plans.com is run by ${AUTHOR_NAME}, a practising online ESL tutor with 15 years of experience teaching adults. Every lesson is written by him, tested on real students, and designed for adult learners rather than children — topics include psychology, workplace culture, technology and society.

- Author page: ${SITE}/about/
- Library size: ${TOTAL_LESSONS} lesson plans, ${FREE_LESSONS_COUNT} of them free
- Levels: A2, B1, B2, C1 (CEFR)
- Every lesson includes: PDF handout, answer key, discussion questions, and audio and/or video

## Pricing
- Guest: Free — access to the ${FREE_LESSONS_COUNT} free lesson plans, no account
- Contributor: $19/month — the full library
- Friend: $99/year — the full library + planner app + mentoring + private chat

## Key Links
- [Homepage](${SITE})
- [All ${TOTAL_LESSONS} Lesson Plans](${ALL_LESSONS_URL})
- [Free Lesson Plans](${SITE}/free/)
- [Free Conversation Questions](${SITE}/questions/)
- [Teacher's Corner articles](${SITE}/articles/)
- [About ${AUTHOR_NAME}](${SITE}/about/)
- [How to Pay](${SITE}/how-to-pay.html)
- [Terms of Service](${SITE}/docs/terms.html)
- [Sitemap](${SITE}/sitemap.xml)
- [RSS feed](${SITE}/feed.xml)

## Browse by level
- [A2 lesson plans](${SITE}/levels/a2)
- [B1 lesson plans](${SITE}/levels/b1)
- [B2 lesson plans](${SITE}/levels/b2)
- [C1 lesson plans](${SITE}/levels/c1)

## Browse by topic
- [Psychology](${SITE}/topics/psychology)
- [Society](${SITE}/topics/society)
- [Technology](${SITE}/topics/technology)
- [Work & Career](${SITE}/topics/work)
- [Business](${SITE}/topics/business)
- [Life & Relationships](${SITE}/topics/life)
- [Travel](${SITE}/topics/travel)
- [Media & Fame](${SITE}/topics/media)

## Citation
If you cite this site, please attribute it to "ESL-plans.com (${AUTHOR_NAME})" and link to the specific lesson page. Every lesson page lists its CEFR level, duration, and the materials included.

## Contact
- Telegram community: https://t.me/eslplans
- Email: esl-plans@proton.me
`;
    fs.writeFileSync('llms.txt', llms, 'utf8');
    console.log(`llms.txt: ${TOTAL_LESSONS} lessons, ${FREE_LESSONS_COUNT} free`);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://esl-plans.com</loc>
        <lastmod>${today}</lastmod>
    </url>
    <url>
        <loc>${ALL_LESSONS_URL}</loc>
        <lastmod>${latestDate(lessons)}</lastmod>
    </url>
${lessonUrls}
${articleIndexUrls}
${articleUrls}
${archiveUrls}
${questionSitemapUrls}
${hubUrls}
</urlset>`;

fs.writeFileSync('sitemap.xml', sitemap, 'utf8');
console.log(`Sitemap: ${lessons.length + articles.length + topicArchiveUrls.length + levelArchiveUrls.length + questionPageUrls.length + (conversationQuestions.length ? 1 : 0) + (articles.length ? 1 : 0) + 2 + 2} URLs`);
console.log('All done!');

// ── TELEGRAM AUTO-POST ──
async function postToTelegram(lesson) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
    const CHAT_ID = '@eslplans';
    console.log('Telegram token present:', BOT_TOKEN ? `yes (${BOT_TOKEN.length} chars)` : 'NO');
    if (!BOT_TOKEN) { console.log('No Telegram token — skipping post'); return; }

    const slug = lesson.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
    const mediaLine = [
        lesson.categoryIcon ? `${lesson.categoryIcon} ${lesson.categoryLabel}` : null,
        lesson.mediaIcon ? `${lesson.mediaIcon} ${lesson.mediaType.replace(' & ', '&')}` : null,
        lesson.levelLabel ? `🥉 ${lesson.levelLabel}` : null,
        lesson.duration ? `⏱ ${lesson.duration}` : null
    ].filter(Boolean).join(' · ');

    const recap = lesson.telegramRecap ||
        (lesson.description || '').replace(/\n/g, ' ').split(/[.!?]/)[0].trim() + '.';

    const hashtags = '#ESL #ELT #TEFL #EnglishTeaching #LessonPlan #AdultLearners #OnlineTutor #ESLteacher #ELTcommunity';
    const freeTag = lesson.isFree ? '\n⭐ FREE lesson — no subscription needed!' : '';
    const link = `https://esl-plans.com/#lesson-${slug}`;
    const caption = `📚 ESL Plan — ${lesson.title}\n${mediaLine}\n<b>${recap}</b>${freeTag}\n🔗 ${link}\n\n${hashtags}`;

    const imgBase = `https://raw.githubusercontent.com/neomich/esl-plans/main/${lesson.visualSource}`;
    const imgUpper = imgBase.endsWith('.jpg') ? imgBase.slice(0,-4)+'.JPG' : imgBase;
    const imgLower = imgBase.endsWith('.JPG') ? imgBase.slice(0,-4)+'.jpg' : imgBase;

    function checkImage(url) {
        return httpGetWithTimeout(url).then(res => res.statusCode === 200 ? url : null);
    }

    let foundImageUrl = await checkImage(imgUpper);
    if (!foundImageUrl) foundImageUrl = await checkImage(imgLower);
    console.log('Found image URL:', foundImageUrl || 'none');

    async function sendTelegram(path, payload) {
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${BOT_TOKEN}/${path}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        };
        const { statusCode, body, timedOut } = await httpsRequestWithTimeout(options, payload);
        if (timedOut) { console.log('⚠️ Telegram request timed out'); return false; }
        try {
            const result = JSON.parse(body);
            if (result.ok) console.log(`✅ Telegram: posted "${lesson.title}"`);
            else console.log(`⚠️ Telegram error: ${result.description}`);
            return result.ok;
        } catch (e) {
            console.log('⚠️ Telegram: could not parse response');
            return false;
        }
    }

    if (foundImageUrl) {
        const photoPayload = JSON.stringify({ chat_id: CHAT_ID, photo: foundImageUrl, caption, parse_mode: 'HTML' });
        await sendTelegram('sendPhoto', photoPayload);
    } else {
        const textPayload = JSON.stringify({ chat_id: CHAT_ID, text: caption, parse_mode: 'HTML', disable_web_page_preview: true });
        await sendTelegram('sendMessage', textPayload);
    }
}

// ── BLUESKY AUTO-POST ──
async function postToBluesky(lesson) {
    const BSKY_IDENTIFIER = 'esl-plans.com';
    const BSKY_PASSWORD = process.env.BLUESKY_APP_PASSWORD || '';
    if (!BSKY_PASSWORD) { console.log('No Bluesky password — skipping'); return; }

    const slug = lesson.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
    const recap = lesson.telegramRecap ||
        (lesson.description || '').replace(/\n/g, ' ').split(/[.!?]/)[0].trim() + '.';
    const link = `https://esl-plans.com/#lesson-${slug}`;
    const freeTag = lesson.isFree ? '\n⭐ FREE — no subscription needed!' : '';
    const bskyHeader = `📚 ESL Plan — ${lesson.title}\n🎓 ${lesson.categoryLabel} · ${lesson.mediaIcon} ${lesson.mediaType} · 🥉 ${lesson.levelLabel} · ⏱ ${lesson.duration}\n`;
    const bskyFooter = `${freeTag}\n🔗 ${link}`;
    let bskyRecap = recap;
    while ([...bskyHeader + bskyRecap + bskyFooter].length > 299 && bskyRecap.length > 10) {
        bskyRecap = bskyRecap.slice(0, -3).trim();
    }
    const postText = bskyHeader + bskyRecap + (bskyRecap !== recap ? '...' : '') + bskyFooter;
    console.log(`Bluesky post: ${[...postText].length} graphemes`);

    try {
        const loginResp = await fetchWithTimeout('https://bsky.social/xrpc/com.atproto.server.createSession', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: BSKY_IDENTIFIER, password: BSKY_PASSWORD })
        });
        const session = await loginResp.json();
        if (!session.accessJwt) { console.log('⚠️ Bluesky login failed:', session.message); return; }

        // Upload image
        let imageEmbed = null;
        const imgBase = `https://raw.githubusercontent.com/neomich/esl-plans/main/${lesson.visualSource}`;
        const imgUpper = imgBase.endsWith('.jpg') ? imgBase.slice(0,-4)+'.JPG' : imgBase;
        const imgLower = imgBase.endsWith('.JPG') ? imgBase.slice(0,-4)+'.jpg' : imgBase;

        async function checkImg(url) {
            const res = await httpGetWithTimeout(url);
            return res.statusCode === 200 ? url : null;
        }
        let imageUrl = await checkImg(imgUpper);
        if (!imageUrl) imageUrl = await checkImg(imgLower);

        if (imageUrl) {
            try {
                const imgData = await new Promise((resolve) => {
                    const req = https.get(imageUrl, res => {
                        const chunks = [];
                        res.on('data', chunk => chunks.push(chunk));
                        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), type: res.headers['content-type'] || 'image/jpeg' }));
                        res.on('error', () => resolve(null));
                    });
                    req.setTimeout(DEFAULT_TIMEOUT_MS, () => { req.destroy(); resolve(null); });
                    req.on('error', () => resolve(null));
                });
                if (imgData) {
                    const blobResp = await fetchWithTimeout('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
                        method: 'POST',
                        headers: { 'Content-Type': imgData.type, 'Authorization': `Bearer ${session.accessJwt}` },
                        body: imgData.buffer
                    });
                    const blobResult = await blobResp.json();
                    if (blobResult.blob) {
                        imageEmbed = { $type: 'app.bsky.embed.images', images: [{ image: blobResult.blob, alt: `ESL Lesson Plan — ${lesson.title}` }] };
                        console.log('Bluesky image uploaded ✅');
                    }
                } else {
                    console.log('Bluesky image download timed out or failed — posting without image');
                }
            } catch(e) { console.log('Bluesky image upload failed:', e.message); }
        }

        const postResp = await fetchWithTimeout('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.accessJwt}` },
            body: JSON.stringify({
                repo: session.did,
                collection: 'app.bsky.feed.post',
                record: {
                    $type: 'app.bsky.feed.post',
                    text: postText,
                    createdAt: new Date().toISOString(),
                    ...(imageEmbed ? { embed: imageEmbed } : {}),
                    facets: [{
                        index: {
                            byteStart: Buffer.byteLength(postText.slice(0, postText.lastIndexOf(link))),
                            byteEnd: Buffer.byteLength(postText.slice(0, postText.lastIndexOf(link))) + Buffer.byteLength(link)
                        },
                        features: [{ $type: 'app.bsky.richtext.facet#link', uri: link }]
                    }]
                }
            })
        });
        const postResult = await postResp.json();
        if (postResult.uri) console.log(`✅ Bluesky: posted "${lesson.title}"`);
        else console.log('⚠️ Bluesky post error:', JSON.stringify(postResult));
    } catch(e) { console.log('Bluesky error:', e.message); }
}

// ── INDEXNOW — notify Bing/Yandex of all URLs ──
async function pingIndexNow() {
    const INDEXNOW_KEY = 'e95877c9-a948-4766-b0e0-5ed2c2dc31a3';
    const allUrls = [
        'https://esl-plans.com',
        ALL_LESSONS_URL,
        ...lessons.map(l => lessonUrl(slugify(l.title))),
        ...articles.map(a => articleUrl(slugify(a.title))),
        ...topicArchiveUrls,
        ...levelArchiveUrls
    ];

    const indexNowPayload = JSON.stringify({
        host: 'esl-plans.com',
        key: INDEXNOW_KEY,
        keyLocation: `https://esl-plans.com/${INDEXNOW_KEY}.txt`,
        urlList: allUrls
    });

    const options = {
        hostname: 'api.indexnow.org',
        path: '/indexnow',
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(indexNowPayload) }
    };

    const { statusCode, timedOut } = await httpsRequestWithTimeout(options, indexNowPayload);
    if (timedOut) {
        console.log('⚠️ IndexNow request timed out');
        return;
    }
    console.log(`IndexNow response: ${statusCode}`);
    if (statusCode === 200 || statusCode === 202) {
        console.log(`✅ IndexNow: ${allUrls.length} URLs submitted to Bing/Yandex`);
    }
}

// ── DUPLICATE SOCIAL POST GUARD ──
// The workflow can run more than once for the same catalog state (a manual
// re-run, or a commit that only touches articles.js). Without this, the same
// newest lesson gets posted to Telegram and Bluesky every single time.
// We remember which lesson was last announced and refuse to announce it twice.
const POSTED_STATE_FILE = 'last-posted.json';

function readLastPosted() {
    try {
        const data = JSON.parse(fs.readFileSync(POSTED_STATE_FILE, 'utf8'));
        return data && data.lastSlug ? data.lastSlug : null;
    } catch (e) {
        return null; // no state file yet — treat as "nothing posted"
    }
}

function writeLastPosted(slug) {
    try {
        fs.writeFileSync(POSTED_STATE_FILE, JSON.stringify({ lastSlug: slug }, null, 2) + '\n', 'utf8');
    } catch (e) {
        console.log('⚠️ Could not write last-posted.json:', e.message);
    }
}

// ── MAIN — runs every network step with a timeout, then guarantees the
//     process exits no matter what happens above. This is the safety net
//     that makes an indefinitely-hung GitHub Action structurally impossible. ──
async function main() {
    if (lessons.length > 0) {
        const newestSlug = slugify(lessons[0].title);
        if (newestSlug === readLastPosted()) {
            console.log(`Social posts skipped — "${lessons[0].title}" was already announced.`);
        } else {
            await Promise.allSettled([
                postToTelegram(lessons[0]),
                postToBluesky(lessons[0])
            ]);
            writeLastPosted(newestSlug);
        }
    }
    await pingIndexNow().catch(err => console.log('IndexNow error:', err.message));
}

// Local/preview runs: SKIP_NETWORK=1 rebuilds every page and the sitemap but
// never posts to Telegram/Bluesky or pings IndexNow. The GitHub Action never
// sets this, so production behaviour is unchanged.
if (process.env.SKIP_NETWORK === '1') {
    console.log('SKIP_NETWORK=1 — social posts and IndexNow skipped.');
    process.exit(0);
}

main()
    .catch(err => console.log('Unexpected error in main():', err.message))
    .finally(() => {
        console.log('Script finished — exiting.');
        process.exit(0);
    });