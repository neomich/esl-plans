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
        if (paren >= 90) {
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

lessons.forEach(lesson => {
    const slug = slugify(lesson.title);
    const firstObjective = (lesson.objectives || [])[0] || '';    // Prefer the hand-written SERP description. Auto-generation from PDF text
    // is only a safety net for lessons added before their description is written.
    const handWritten = String(lessonDescriptions[lesson.title] || '').trim();
    if (handWritten) handWrittenCount++;
    else autoCount++;
    const descPlain = handWritten || makeFittingDescription(
        lesson.description,
        `${lesson.title} — a ${lesson.levelLabel} ESL lesson plan for adult learners. ${firstObjective}`
    );
    const descMeta = escapeAttr(descPlain);
    const descSafe = (lesson.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const objList = (lesson.objectives || []).map(o => `<li>${o.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('\n');

    // Preview image: the lesson's own cover when it exists on disk, otherwise
    // the site-wide card. Missing/renamed covers fall back instead of 404ing.
    const coverRel = lesson.visualSource && fs.existsSync(lesson.visualSource)
        ? lesson.visualSource
        : 'images/og-image.png';
    const ogImage = `${SITE}/${coverRel.replace(/\\/g, '/').replace(/^\.?\//, '')}`;

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
            <h3 style="font-size:14px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">You may also like</h3>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                ${related.map(r => `<a href="${lessonUrl(slugify(r.title))}" style="flex:1;min-width:180px;background:white;border-radius:12px;padding:14px;text-decoration:none;border:1px solid #eee;display:block;">
                    <div style="font-size:14px;font-weight:700;color:#333;margin-bottom:4px;">${r.title}</div>
                    <div style="font-size:12px;color:#aaa;">${r.levelLabel} &middot; ${r.duration}</div>
                    <div style="font-size:12px;color:#c95210;font-weight:700;margin-top:8px;">View Lesson &rarr;</div>
                </a>`).join('')}
            </div>
        </div>` : '';

    // Build topics tags
    const topicTags = (lesson.topics || []).map(t => topicLabels[t] || t).join(' · ');

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
    const breadcrumbHtml = `<nav aria-label="Breadcrumb" style="font-size:13px;color:#aaa;margin-bottom:16px;">
        <a href="${SITE}/" style="color:#c95210;text-decoration:none;">Home</a> &rsaquo;
        ${lessonLevel ? `<a href="${levelUrl(lessonLevel)}" style="color:#c95210;text-decoration:none;">${LEVEL_NAMES[lessonLevel]} lesson plans</a> &rsaquo; ` : ''}<span>${lesson.title}</span>
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
            <a href="${levelUrl(lessonLevel)}" style="color:#c95210;font-weight:600;text-decoration:none;font-size:14px;">Browse all ${LEVEL_NAMES[lessonLevel]} ESL lesson plans &rarr;</a>
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
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Course","name":"${jsonSafe(lesson.title)}","description":"${jsonSafe(descPlain)}","provider":{"@type":"Organization","name":"ESL-plans.com","url":"https://esl-plans.com"},"educationalLevel":"${jsonSafe(lesson.levelLabel)}","inLanguage":"en","url":"${lessonUrl(slug)}"}</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What level is the ${jsonSafe(lesson.title)} ESL lesson plan?","acceptedAnswer":{"@type":"Answer","text":"The ${jsonSafe(lesson.title)} lesson plan is designed for ${jsonSafe(lesson.levelLabel)} level adult learners. It takes approximately ${jsonSafe(lesson.duration)} to complete."}},{"@type":"Question","name":"What materials are included in the ${jsonSafe(lesson.title)} lesson?","acceptedAnswer":{"@type":"Answer","text":"The ${jsonSafe(lesson.title)} lesson includes ${jsonSafe(materialsText)}."}},{"@type":"Question","name":"Is the ${jsonSafe(lesson.title)} lesson plan suitable for online ESL tutors?","acceptedAnswer":{"@type":"Answer","text":"Yes, the ${jsonSafe(lesson.title)} lesson is specifically designed for online ESL tutors working with adult learners at ${jsonSafe(lesson.levelLabel)} level. It is zero-prep and conversation-driven, covering the topic of ${jsonSafe(topicTags)}."}}]}</script>
    ${breadcrumbSchema}
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}
        .container{max-width:820px;margin:0 auto;padding:40px 20px}
        .logo{font-size:22px;margin-bottom:28px;text-decoration:none;display:block;}
        .logo .esl{font-weight:900;font-style:italic;color:#c95210;}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif;}
        h1{color:#c95210;font-size:28px;margin-bottom:8px;line-height:1.3;}
        .meta{color:#888;font-size:14px;margin-bottom:24px;display:flex;flex-wrap:wrap;gap:12px;}
        .meta-badge{background:white;border-radius:20px;padding:4px 12px;font-size:13px;color:#555;border:1px solid #eee;}
        h2{color:#333;font-size:17px;font-weight:700;margin:28px 0 12px;text-transform:uppercase;letter-spacing:0.5px;}
        h3{color:#333;font-size:15px;font-weight:700;margin:20px 0 10px;text-transform:uppercase;letter-spacing:0.5px;}
        ul{color:#444;line-height:1.8;padding-left:20px;margin-bottom:16px;}
        li{margin-bottom:4px;}
        .desc{color:#444;line-height:1.8;white-space:pre-line;margin-bottom:24px;}
        .info-box{background:white;border-radius:16px;padding:20px 24px;margin:24px 0;border-left:4px solid #c95210;}
        .info-box h3{font-size:14px;font-weight:700;color:#c95210;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;}
        .info-box p{font-size:14px;color:#555;line-height:1.7;margin:0;}
        .topics{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;}
        .topic-tag{background:#fff3e0;color:#c95210;border-radius:20px;padding:5px 14px;font-size:13px;font-weight:600;text-decoration:none;}
        .cta-box{background:#c95210;border-radius:16px;padding:24px;text-align:center;margin:32px 0;color:white;}
        .cta-box p{margin-bottom:14px;font-size:15px;opacity:0.9;}
        .cta-btn{display:inline-block;background:white;color:#c95210;padding:12px 28px;border-radius:25px;text-decoration:none;font-weight:700;font-size:15px;}
        .back{display:inline-block;margin-top:20px;color:#c95210;text-decoration:none;font-weight:600;font-size:14px;}
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
    <div class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>

        ${breadcrumbHtml}

        <h1>${lesson.title}</h1>
        <div class="meta">
            <span class="meta-badge">🎓 ${lesson.categoryLabel}</span>
            <span class="meta-badge">🥉 ${lessonLevel ? `<a href="${levelUrl(lessonLevel)}" style="color:inherit;text-decoration:none;">${lesson.levelLabel}</a>` : lesson.levelLabel}</span>
            <span class="meta-badge">⏱ ${lesson.duration}</span>
            <span class="meta-badge">${lesson.mediaIcon} ${lesson.mediaType}</span>
            ${lesson.isFree ? '<span class="meta-badge" style="background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7;">⭐ Free Lesson</span>' : ''}
        </div>

        ${topicTags ? `<div class="topics">${(lesson.topics||[]).map(t => `<a href="${topicUrl(t)}" class="topic-tag">${topicLabels[t]||t}</a>`).join('')}</div>` : ''}

        <table style="width:100%;border-collapse:collapse;margin:16px 0 24px;font-size:13px;background:white;border-radius:12px;overflow:hidden;border:1px solid #eee;">
            <thead>
                <tr style="background:#faf6f2;">
                    <th style="padding:10px 14px;text-align:left;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-size:11px;">Level</th>
                    <th style="padding:10px 14px;text-align:left;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-size:11px;">Category</th>
                    <th style="padding:10px 14px;text-align:left;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-size:11px;">Format</th>
                    <th style="padding:10px 14px;text-align:left;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-size:11px;">Duration</th>
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

        <h2>What's the "${lesson.title}" ESL Lesson About?</h2>
        <p style="color:#888;font-size:13px;margin-bottom:20px;">${lesson.levelLabel} · ${lesson.categoryLabel}</p>

        <h3>Main Objectives</h3>
        <ul>${objList}</ul>

        <h3>About This Lesson</h3>
        <p class="desc">${descSafe}</p>
        <p style="color:#777;font-size:13px;margin-top:-10px;margin-bottom:20px;font-style:italic;">${buildLogisticsSentence(lesson)}</p>

        ${(lesson.links || []).filter(l => l && l.url).length ? `<h3>Watch the Video</h3>
        ${(lesson.links || []).filter(l => l && l.url).map(l => {
            const ytId = getYouTubeId(l.url);
            if (ytId) {
                return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><iframe src="https://www.youtube.com/embed/${ytId}" title="${lesson.title.replace(/"/g,'&quot;')} — video" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
            }
            return `<a href="${l.url}" target="_blank" rel="noopener" style="display:block;color:#c95210;font-weight:700;text-decoration:none;margin-bottom:10px;">▶️ ${(l.label||'Watch Video').replace(/</g,'&lt;')} &rarr;</a>`;
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
            <p>Looking for more ESL lesson plans for adult learners? Browse our full library of 100+ conversation-driven plans.</p>
            <a href="${ALL_LESSONS_URL}" class="cta-btn">Browse All Lesson Plans →</a>
        </div>

        <div style="text-align:center; margin:32px 0;">
            <a id="view-on-site-btn" href="${SITE}/#lesson-${slug}"
               style="display:inline-block; background:#c95210; color:white; padding:16px 36px; border-radius:50px; text-decoration:none; font-size:18px; font-weight:800; box-shadow:0 4px 16px rgba(201,82,16,0.3); transition:transform 0.2s;">
                🎓 View &amp; Download This Lesson →
            </a>
            <p style="margin-top:12px; font-size:13px; color:#aaa;">Free PDF, audio and video included for free lessons</p>
            ${levelMoreHtml}
        </div>
        <a class="back" href="${ALL_LESSONS_URL}">&larr; Browse all lesson plans</a>
    </div>
</body>
</html>`;
    fs.writeFileSync(`lessons/${slug}.html`, html, 'utf8');
    console.log(`Lesson: lessons/${slug}.html`);
});

console.log(`Descriptions: ${handWrittenCount} hand-written, ${autoCount} auto-generated${autoCount ? ' ⚠️ add those to meta-descriptions.js' : ''}`);

// ── GENERATE ARTICLE PAGES ──
let articles = [];
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
    const articleImage = `${SITE}/images/og-image.png`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} | ESL-plans.com Teacher's Corner</title>
    <meta name="description" content="${bodyMeta}">
    <meta name="keywords" content="ESL teaching tips, online ESL tutor, adult ESL learners, ${slugify(article.title).replace(/-/g,' ')}">
    <link rel="canonical" href="${articleUrl(slug)}">
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
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"${jsonSafe(article.title)}","description":"${jsonSafe(bodyPlain)}","author":{"@type":"Person","name":"Alex Selivanov"},"publisher":{"@type":"Organization","name":"ESL-plans.com","url":"https://esl-plans.com"},"datePublished":"${articleISO}","dateModified":"${articleISO}","url":"${articleUrl(slug)}"}</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"${jsonSafe(article.title)}","acceptedAnswer":{"@type":"Answer","text":"${jsonSafe(bodyPlain)}"}}]}</script>
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}
        .container{max-width:760px;margin:0 auto;padding:40px 20px}
        .logo{font-size:24px;margin-bottom:32px;cursor:pointer}
        .logo .esl{font-weight:900;font-style:italic;color:#c95210;font-family:'Segoe UI',sans-serif}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif}
        h1{color:#333;font-size:28px;line-height:1.3;margin-bottom:8px}
        .meta{color:#aaa;font-size:13px;margin-bottom:32px}
        .body{color:#444;font-size:16px;line-height:1.8;}
        .cta{margin-top:40px;padding:24px;background:white;border-radius:16px;border-left:4px solid #c95210;text-align:center}
        .cta p{color:#555;margin-bottom:16px}
        .cta a{display:inline-block;background:#c95210;color:white;padding:12px 28px;border-radius:25px;text-decoration:none;font-weight:700}
        .back{display:inline-block;margin-top:24px;color:#c95210;text-decoration:none;font-weight:600;font-size:14px}
    </style>
</head>
<body>
    <div class="container">
        <div class="logo" onclick="window.location='https://esl-plans.com'">
            <span class="esl">ESL</span>-<span class="plans">plans</span>
        </div>
        <h1>${article.title}</h1>
        <p class="meta">${article.date || ''} &middot; ESL-plans Teacher's Corner</p>
        ${introSafe ? `<p style="font-style:italic; color:#666; border-left:3px solid #c95210; padding-left:14px; margin-bottom:24px; line-height:1.7;">${introSafe}</p>` : ''}
        <div class="body">${bodySafe}</div>
        <div class="cta">
            <p>Looking for ready-made ESL lesson plans for adult learners?</p>
            <a href="${ALL_LESSONS_URL}">Browse 100+ Lesson Plans →</a>
        </div>
        <a class="back" href="${SITE}/">&larr; Back to ESL-plans.com</a>
    </div>
</body>
</html>`;
    fs.writeFileSync(`articles/${slug}.html`, html, 'utf8');
    console.log(`Article: articles/${slug}.html`);
});

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
        .footer-nav h3{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#8a8a8a;margin-bottom:10px;font-weight:700}
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
        <a class="all" href="${ALL_LESSONS_URL}">Browse all ${lessons.length} plans &rarr;</a>
        <a href="#articles-grid">Teacher's Corner articles</a>
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

// ── GENERATE TOPIC & LEVEL ARCHIVE PAGES ──
if (!fs.existsSync('topics')) fs.mkdirSync('topics');
if (!fs.existsSync('levels')) fs.mkdirSync('levels');

function renderLessonCard(l) {
    return `<a href="${lessonUrl(slugify(l.title))}" style="display:block;background:white;border-radius:12px;padding:16px;text-decoration:none;border:1px solid #eee;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:700;color:#333;margin-bottom:6px;">${l.title}</div>
        <div style="font-size:12px;color:#aaa;">${l.levelLabel} &middot; ${l.categoryLabel} &middot; ${l.duration}</div>
    </a>`;
}

function renderArchivePage(heading, description, matchingLessons, canonicalUrl, crossLinksHtml, crumbHtml) {
    const image = `${SITE}/images/og-image.png`;
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
        .logo .esl{font-weight:900;font-style:italic;color:#c95210;}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif;}
        .crumb{font-size:13px;color:#aaa;margin-bottom:10px;}
        .crumb a{color:#c95210;text-decoration:none;}
        h1{color:#c95210;font-size:26px;margin-bottom:8px;line-height:1.3;}
        p.intro{color:#666;font-size:15px;margin-bottom:20px;line-height:1.6;}
        .cross{background:#fff3e0;border-radius:12px;padding:12px 16px;margin-bottom:24px;font-size:14px;color:#555;line-height:2;}
        .cross a{color:#c95210;text-decoration:none;font-weight:600;margin-right:12px;white-space:nowrap;}
        .back{display:inline-block;margin-top:24px;color:#c95210;text-decoration:none;font-weight:600;font-size:14px;}
    </style>
</head>
<body>
    <div class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>
        ${crumbHtml}
        <h1>${heading}</h1>
        <p class="intro">${description}</p>
        ${crossLinksHtml}
        ${matchingLessons.map(renderLessonCard).join('')}
        <a class="back" href="${ALL_LESSONS_URL}">&larr; Browse all lesson plans</a>
    </div>
</body>
</html>`;
}

const levelCrossLinks = `<div class="cross"><strong>Browse by level:</strong>${LEVEL_CODES.map(c => `<a href="${levelUrl(c)}">${LEVEL_NAMES[c]} lesson plans</a>`).join('')}<a href="${ALL_LESSONS_URL}">All lesson plans</a></div>`;

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
    fs.writeFileSync(`topics/${topicCode}.html`, renderArchivePage(heading, description, matching, url, levelCrossLinks, crumb), 'utf8');
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
    const description = `Browse ${matching.length} ${LEVEL_NAMES[levelCode]}-level ESL lesson plan${matching.length===1?'':'s'} for adult learners — conversation-driven, zero-prep materials for online ESL tutors.`;
    const url = levelUrl(levelCode);
    const crumb = `<nav class="crumb" aria-label="Breadcrumb"><a href="${SITE}/">Home</a> &rsaquo; <span>${LEVEL_NAMES[levelCode]} lesson plans</span></nav>`;
    fs.writeFileSync(`levels/${levelCode}.html`, renderArchivePage(heading, description, matching, url, topicCrossLinks, crumb), 'utf8');
    levelArchiveUrls.push(url);
    levelArchiveLastmod[url] = latestDate(matching);
    console.log(`Level archive: levels/${levelCode}.html (${matching.length} lessons)`);
});

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
    <meta property="og:image" content="${SITE}/images/og-image.png">
    <meta property="og:site_name" content="ESL-plans.com">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="All ESL Lesson Plans for Adults | ESL-plans.com">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${SITE}/images/og-image.png">
    <script type="application/ld+json">${schema}</script>
    <style>
        body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}
        .container{max-width:820px;margin:0 auto;padding:40px 20px}
        .logo{font-size:22px;margin-bottom:18px;text-decoration:none;display:block;}
        .logo .esl{font-weight:900;font-style:italic;color:#c95210;}
        .logo .plans{font-weight:300;color:#222;font-family:Georgia,serif;}
        .crumb{font-size:13px;color:#aaa;margin-bottom:10px;}
        .crumb a{color:#c95210;text-decoration:none;}
        h1{color:#c95210;font-size:28px;margin-bottom:8px;line-height:1.3;}
        p.intro{color:#666;font-size:15px;margin-bottom:24px;line-height:1.6;}
        .topics{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;}
        .topic-tag{background:#fff3e0;color:#c95210;border-radius:20px;padding:5px 14px;font-size:13px;font-weight:600;text-decoration:none;}
        h2{color:#333;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:34px 0 4px;}
        p.count{color:#999;font-size:13px;margin-bottom:12px;}
        .card{display:block;background:white;border-radius:12px;padding:14px 16px;text-decoration:none;border:1px solid #eee;margin-bottom:10px;}
        .card-title{font-size:15px;font-weight:700;color:#333;}
        .free{font-size:11px;color:#2e7d32;font-weight:700;margin-left:8px;}
        .card-meta{display:block;font-size:12px;color:#aaa;margin-top:4px;}
        .back{display:inline-block;margin-top:26px;color:#c95210;text-decoration:none;font-weight:600;font-size:14px;}
    </style>
</head>
<body>
    <div class="container">
        <a class="logo" href="${SITE}/"><span class="esl">ESL</span>-<span class="plans">plans</span></a>
        <nav class="crumb" aria-label="Breadcrumb"><a href="${SITE}/">Home</a> &rsaquo; <span>All lesson plans</span></nav>
        <h1>All ESL Lesson Plans for Adults</h1>
        <p class="intro">${description} Every plan is conversation-driven, zero-prep, and built for online tutors working with adult learners.</p>
        <div class="topics">
            ${Object.keys(topicLabels).map(t => `<a class="topic-tag" href="${topicUrl(t)}">${topicLabels[t]}</a>`).join('')}
        </div>
        <div class="topics">
            ${LEVEL_CODES.map(c => `<a class="topic-tag" href="${levelUrl(c)}">${LEVEL_NAMES[c]} lesson plans</a>`).join('')}
        </div>
        ${sections}
        ${extra}
        <a class="back" href="${SITE}/">&larr; Back to ESL-plans.com</a>
    </div>
</body>
</html>`;
}

if (lessons.some(l => slugify(l.title) === 'index')) {
    console.log('⚠️ A lesson slug collides with lessons/index.html — directory page skipped.');
} else {
    fs.writeFileSync('lessons/index.html', renderDirectoryPage(), 'utf8');
    console.log(`Directory: lessons/index.html (${lessons.length} lessons)`);
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

const archiveUrls = [...topicArchiveUrls, ...levelArchiveUrls].map(u => `    <url>
        <loc>${u}</loc>
        <lastmod>${topicArchiveLastmod[u] || levelArchiveLastmod[u] || today}</lastmod>
    </url>`).join('\n');

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
${articleUrls}
${archiveUrls}
</urlset>`;

fs.writeFileSync('sitemap.xml', sitemap, 'utf8');
console.log(`Sitemap: ${lessons.length + articles.length + topicArchiveUrls.length + levelArchiveUrls.length + 2} URLs`);
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