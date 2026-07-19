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

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${lesson.title} — ESL Lesson Plan | ESL-plans.com</title>
    <meta name="description" content="${descMeta}">
    <meta name="keywords" content="${(lesson.keywords||'')}, ESL lesson plan, English lesson plan, ${lesson.levelLabel} English">
    <link rel="canonical" href="https://esl-plans.com/lessons/${slug}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://esl-plans.com/lessons/${slug}">
    <meta property="og:title" content="${lesson.title} — ESL Lesson Plan">
    <meta property="og:description" content="${descMeta}">
    <meta property="og:site_name" content="ESL-plans.com">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Course","name":"${lesson.title.replace(/"/g,'\\"')}","description":"${descMeta.replace(/"/g,'\\"')}","provider":{"@type":"Organization","name":"ESL-plans.com","url":"https://esl-plans.com"},"educationalLevel":"${lesson.levelLabel}","inLanguage":"en","url":"https://esl-plans.com/lessons/${slug}"}</script>
    <style>body{font-family:'Segoe UI',sans-serif;background:#fff5ee;margin:0;padding:0}.container{max-width:800px;margin:0 auto;padding:40px 20px}h1{color:#c95210;font-size:28px;margin-bottom:8px}.meta{color:#888;font-size:14px;margin-bottom:24px}h2{color:#333;font-size:18px;margin:24px 0 12px}ul{color:#444;line-height:1.8;padding-left:20px}.desc{color:#444;line-height:1.7;white-space:pre-line}.back{display:inline-block;margin-top:30px;color:#c95210;text-decoration:none;font-weight:600}</style>
    <script>setTimeout(function(){ window.location.href='https://esl-plans.com/#lesson-${slug}'; }, 500);</script>
</head>
<body>
    <div class="container">
        <h1>${lesson.title}</h1>
        <p class="meta">${lesson.levelLabel} &middot; ${lesson.categoryLabel} &middot; ${lesson.duration}</p>
        <h2>Main Objectives</h2>
        <ul>${objList}</ul>
        <h2>About This Lesson</h2>
        <p class="desc">${descSafe}</p>
        ${relatedHtml}
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
    const bodyMeta = (article.body || '').substring(0, 160).replace(/\n/g, ' ').replace(/"/g, '&quot;');

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
