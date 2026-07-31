const fs = require('fs');

// ── GENERATE LESSON PAGES ──
const lessonsContent = fs.readFileSync('lessons.js', 'utf8');
const getLessons = new Function(lessonsContent.replace('const lessonsCatalog', 'var lessonsCatalog') + '\nreturn lessonsCatalog;');
const lessons = getLessons();
console.log(`Found ${lessons.length} lessons`);

if (!fs.existsSync('lessons')) fs.mkdirSync('lessons');

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

lessons.forEach(lesson => {
    const slug = slugify(lesson.title);
    const descMeta = (lesson.description || '').substring(0, 160).replace(/\n/g, ' ').replace(/"/g, '&quot;');
    const descSafe = (lesson.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const objList = (lesson.objectives || []).map(o => `<li>${o.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('\n');

    // Find 3 related lessons by shared topics
    const currentIdx = lessons.indexOf(lesson);
    const related = lessons
        .filter((l, i) => i !== currentIdx && l.topics && lesson.topics && l.topics.some(t => (lesson.topics || []).includes(t)))
        .slice(0, 3);

    const relatedHtml = related.length > 0 ? `
        <div style="margin-top:32px;border-top:1px dashed #ddd;padding-top:24px;">
            <h3 style="font-size:14px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">You may also like</h3>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                ${related.map(r => `<a href="https://esl-plans.com/lessons/${slugify(r.title)}" style="flex:1;min-width:180px;background:white;border-radius:12px;padding:14px;text-decoration:none;border:1px solid #eee;display:block;">
                    <div style="font-size:14px;font-weight:700;color:#333;margin-bottom:4px;">${r.title}</div>
                    <div style="font-size:12px;color:#aaa;">${r.levelLabel} &middot; ${r.duration}</div>
                    <div style="font-size:12px;color:#c95210;font-weight:700;margin-top:8px;">View Lesson &rarr;</div>
                </a>`).join('')}
            </div>
        </div>` : '';

    // Build topics tags
    const topicLabels = {
        psychology: 'Psychology', society: 'Society', technology: 'Technology',
        work: 'Work & Career', business: 'Business', life: 'Life & Relationships',
        travel: 'Travel', media: 'Media & Fame', art: 'Art & Culture',
        grammar: 'Grammar', food: 'Food & Drink'
    };
    const topicTags = (lesson.topics || []).map(t => topicLabels[t] || t).join(' · ');

    // Materials list
    const materials = [];
    if (lesson.pdfUrl) materials.push('PDF handout');
    if (lesson.audioUrl || lesson.audioUrls) materials.push('audio materials (MP3)');
    if (lesson.links && lesson.links.length) materials.push('video links');
    if (lesson.rarUrl) materials.push('full downloadable package (RAR)');
    const materialsText = materials.join(', ');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${lesson.title} — ESL Lesson Plan for Adults | ESL-plans.com</title>
    <meta name="description" content="${descMeta}">
    <meta name="keywords" content="${(lesson.keywords||'')}, ESL lesson plan for adults, adult English lesson plan, online ESL tutor resources, ${lesson.levelLabel} ESL adults, conversation ESL lesson, ${topicTags.toLowerCase()}">
    <link rel="canonical" href="https://esl-plans.com/lessons/${slug}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://esl-plans.com/lessons/${slug}">
    <meta property="og:title" content="${lesson.title} — ESL Lesson Plan for Adults">
    <meta property="og:description" content="${descMeta}">
    <meta property="og:site_name" content="ESL-plans.com">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Course","name":"${lesson.title.replace(/"/g,'\\"')}","description":"${descMeta.replace(/"/g,'\\"')}","provider":{"@type":"Organization","name":"ESL-plans.com","url":"https://esl-plans.com"},"educationalLevel":"${lesson.levelLabel}","inLanguage":"en","url":"https://esl-plans.com/lessons/${slug}"}</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What level is the ${lesson.title} ESL lesson plan?","acceptedAnswer":{"@type":"Answer","text":"The ${lesson.title} lesson plan is designed for ${lesson.levelLabel} level adult learners. It takes approximately ${lesson.duration} to complete."}},{"@type":"Question","name":"What materials are included in the ${lesson.title} lesson?","acceptedAnswer":{"@type":"Answer","text":"The ${lesson.title} lesson includes ${materialsText}."}},{"@type":"Question","name":"Is the ${lesson.title} lesson plan suitable for online ESL tutors?","acceptedAnswer":{"@type":"Answer","text":"Yes, the ${lesson.title} lesson is specifically designed for online ESL tutors working with adult learners at ${lesson.levelLabel} level. It is zero-prep and conversation-driven, covering the topic of ${topicTags}."}}]}</script>
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
        ul{color:#444;line-height:1.8;padding-left:20px;margin-bottom:16px;}
        li{margin-bottom:4px;}
        .desc{color:#444;line-height:1.8;white-space:pre-line;margin-bottom:24px;}
        .info-box{background:white;border-radius:16px;padding:20px 24px;margin:24px 0;border-left:4px solid #c95210;}
        .info-box h3{font-size:14px;font-weight:700;color:#c95210;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;}
        .info-box p{font-size:14px;color:#555;line-height:1.7;margin:0;}
        .topics{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;}
        .topic-tag{background:#fff3e0;color:#c95210;border-radius:20px;padding:5px 14px;font-size:13px;font-weight:600;}
        .cta-box{background:#c95210;border-radius:16px;padding:24px;text-align:center;margin:32px 0;color:white;}
        .cta-box p{margin-bottom:14px;font-size:15px;opacity:0.9;}
        .cta-btn{display:inline-block;background:white;color:#c95210;padding:12px 28px;border-radius:25px;text-decoration:none;font-weight:700;font-size:15px;}
        .back{display:inline-block;margin-top:20px;color:#c95210;text-decoration:none;font-weight:600;font-size:14px;}
    </style>
    <script>setTimeout(function(){ window.location.href='https://esl-plans.com/#lesson-${slug}'; }, 500);</script>
</head>
<body>
    <div class="container">
        <a class="logo" href="https://esl-plans.com"><span class="esl">ESL</span>-<span class="plans">plans</span></a>

        <h1>${lesson.title}</h1>
        <div class="meta">
            <span class="meta-badge">🎓 ${lesson.categoryLabel}</span>
            <span class="meta-badge">🥉 ${lesson.levelLabel}</span>
            <span class="meta-badge">⏱ ${lesson.duration}</span>
            <span class="meta-badge">${lesson.mediaIcon} ${lesson.mediaType}</span>
            ${lesson.isFree ? '<span class="meta-badge" style="background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7;">⭐ Free Lesson</span>' : ''}
        </div>

        ${topicTags ? `<div class="topics">${(lesson.topics||[]).map(t => `<span class="topic-tag">${topicLabels[t]||t}</span>`).join('')}</div>` : ''}

        <h2>Main Objectives</h2>
        <ul>${objList}</ul>

        <h2>About This Lesson</h2>
        <p class="desc">${descSafe}</p>

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
            <p>Looking for more ESL lesson plans for adult learners? Browse our full library of 55+ conversation-driven plans.</p>
            <a href="https://esl-plans.com" class="cta-btn">Browse All Lesson Plans →</a>
        </div>

        <a class="back" href="https://esl-plans.com">&larr; Back to ESL-plans.com</a>
    </div>
</body>
</html>`;
    fs.writeFileSync(`lessons/${slug}.html`, html, 'utf8');
    console.log(`Lesson: lessons/${slug}.html`);
});

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
    const bodyMeta = (article.intro || article.body || '').replace(/<[^>]+>/g, '').substring(0, 160).replace(/\n/g, ' ').replace(/"/g, '&quot;');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} | ESL-plans.com Teacher's Corner</title>
    <meta name="description" content="${bodyMeta}">
    <meta name="keywords" content="ESL teaching tips, online ESL tutor, adult ESL learners, ${slugify(article.title).replace(/-/g,' ')}">
    <link rel="canonical" href="https://esl-plans.com/articles/${slug}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://esl-plans.com/articles/${slug}">
    <meta property="og:title" content="${article.title}">
    <meta property="og:description" content="${bodyMeta}">
    <meta property="og:site_name" content="ESL-plans.com">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"${article.title.replace(/"/g,'\\"')}","description":"${bodyMeta.replace(/"/g,'\\"')}","author":{"@type":"Person","name":"Alex Selivanov"},"publisher":{"@type":"Organization","name":"ESL-plans.com","url":"https://esl-plans.com"},"datePublished":"${article.date||''}","url":"https://esl-plans.com/articles/${slug}"}</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"${article.title.replace(/"/g,'\\"')}","acceptedAnswer":{"@type":"Answer","text":"${bodyMeta.replace(/"/g,'\\"')}"}}]}</script>
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
            <a href="https://esl-plans.com">Browse 55+ Lesson Plans →</a>
        </div>
        <a class="back" href="https://esl-plans.com">&larr; Back to ESL-plans.com</a>
    </div>
</body>
</html>`;
    fs.writeFileSync(`articles/${slug}.html`, html, 'utf8');
    console.log(`Article: articles/${slug}.html`);
});

// ── GENERATE SITEMAP ──
const today = new Date().toISOString().split('T')[0];

const lessonUrls = lessons.map(l => `    <url>
        <loc>https://esl-plans.com/lessons/${slugify(l.title)}</loc>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
        <lastmod>${today}</lastmod>
    </url>`).join('\n');

const articleUrls = articles.map(a => `    <url>
        <loc>https://esl-plans.com/articles/${slugify(a.title)}</loc>
        <changefreq>monthly</changefreq>
        <priority>0.9</priority>
        <lastmod>${today}</lastmod>
    </url>`).join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://esl-plans.com</loc>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
        <lastmod>${today}</lastmod>
    </url>
    <url>
        <loc>https://esl-plans.com/docs/terms.html</loc>
        <changefreq>monthly</changefreq>
        <priority>0.3</priority>
    </url>
${lessonUrls}
${articleUrls}
</urlset>`;

fs.writeFileSync('sitemap.xml', sitemap, 'utf8');
console.log(`Sitemap: ${lessons.length + articles.length + 2} URLs`);
console.log('All done!');

// ── TELEGRAM AUTO-POST for new lessons ──
async function postToTelegram(lesson) {
    const slug = slugify(lesson.title);
    const BOT_TOKEN = '8032943426:AAEfA7S5TRaY_6ITAmmoVGPuE7XlVg09luE';
    const CHAT_ID = '2652006770';

    // Build media line
    const mediaLine = [
        lesson.categoryIcon ? `${lesson.categoryIcon} ${lesson.categoryLabel}` : null,
        lesson.mediaIcon ? `${lesson.mediaIcon} ${lesson.mediaType.replace(' & ', '&')}` : null,
        lesson.levelLabel ? `🥉 ${lesson.levelLabel}` : null,
        lesson.duration ? `⏱ ${lesson.duration}` : null
    ].filter(Boolean).join(' · ');

    // Use telegramRecap field if available, otherwise first sentence of description
    let recap = '';
    if (lesson.telegramRecap) {
        recap = lesson.telegramRecap.substring(0, 150);
    } else {
        const firstSentence = (lesson.description || '').replace(/\n/g, ' ').split(/[.!?]/)[0].trim();
        recap = firstSentence.length > 10 ? firstSentence + '.' : (lesson.description || '').replace(/\n/g, ' ').substring(0, 150).trim();
    }

    const freeTag = lesson.isFree ? '\n⭐ FREE lesson — no subscription needed!' : '';
    const link = `https://esl-plans.com/#lesson-${slug}`;
    const caption = `📚 ESL Plan — ${lesson.title}\n${mediaLine}\n${recap}${freeTag}\n🔗 ${link}`;

    // Send photo with caption
    const imageUrl = `https://esl-plans.com/${lesson.visualSource}`;

    const payload = JSON.stringify({
        chat_id: `@eslplans`,
        photo: imageUrl,
        caption: caption,
        parse_mode: 'HTML'
    });

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${BOT_TOKEN}/sendPhoto`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const result = JSON.parse(data);
                if (result.ok) {
                    console.log(`✅ Telegram: posted "${lesson.title}"`);
                } else {
                    console.log(`⚠️ Telegram error: ${result.description}`);
                }
                resolve();
            });
        });
        req.on('error', err => {
            console.log('Telegram error:', err.message);
            resolve();
        });
        req.write(payload);
        req.end();
    });
}

// Only post the NEWEST lesson (first in catalog = most recently added)
if (lessons.length > 0) {
    postToTelegram(lessons[0]).catch(console.error);
}
const https = require('https');

const INDEXNOW_KEY = 'e95877c9-a948-4766-b0e0-5ed2c2dc31a3';
const allUrls = [
    'https://esl-plans.com',
    'https://esl-plans.com/docs/terms.html',
    ...lessons.map(l => `https://esl-plans.com/lessons/${slugify(l.title)}.html`),
    ...articles.map(a => `https://esl-plans.com/articles/${slugify(a.title)}.html`)
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
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(indexNowPayload)
    }
};

const req = https.request(options, res => {
    console.log(`IndexNow response: ${res.statusCode}`);
    if (res.statusCode === 200 || res.statusCode === 202) {
        console.log(`✅ IndexNow: ${allUrls.length} URLs submitted to Bing/Yandex`);
    } else {
        console.log(`⚠️ IndexNow returned status ${res.statusCode}`);
    }
});

req.on('error', err => console.log('IndexNow error:', err.message));
req.write(indexNowPayload);
req.end();
