const fs = require('fs');
const path = require('path');

// Read and parse lessons.js by extracting the array directly
const lessonsContent = fs.readFileSync('lessons.js', 'utf8');

// Extract lessonsCatalog array by replacing const declaration
const modified = lessonsContent
    .replace('const lessonsCatalog', 'var lessonsCatalog')
    .replace('module.exports', '//')  ;

// Use Function constructor to evaluate
const getLessons = new Function(modified + '\nreturn lessonsCatalog;');
const lessons = getLessons();

console.log(`Found ${lessons.length} lessons`);

// Create /lessons/ directory
if (!fs.existsSync('lessons')) fs.mkdirSync('lessons');

// Generate slug from title
function slugify(title) {
    return title.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

// Generate HTML for each lesson
lessons.forEach(lesson => {
    const slug = slugify(lesson.title);
    const objectivesList = (lesson.objectives || [])
        .map(o => `<li>${o.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`)
        .join('\n');
    const descSafe = (lesson.description || '')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const descMeta = (lesson.description || '')
        .substring(0, 160)
        .replace(/\n/g, ' ')
        .replace(/"/g, '&quot;');
    const keywordsMeta = (lesson.keywords || '') + `, ESL lesson plan, English lesson plan, ${lesson.levelLabel} English`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${lesson.title} — ESL Lesson Plan | ESL-plans.com</title>
    <meta name="description" content="${descMeta}">
    <meta name="keywords" content="${keywordsMeta}">
    <link rel="canonical" href="https://esl-plans.com/lessons/${slug}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://esl-plans.com/lessons/${slug}">
    <meta property="og:title" content="${lesson.title} — ESL Lesson Plan">
    <meta property="og:description" content="${descMeta}">
    <meta property="og:site_name" content="ESL-plans.com">
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Course",
        "name": "${lesson.title.replace(/"/g, '\\"')}",
        "description": "${descMeta.replace(/"/g, '\\"')}",
        "provider": {
            "@type": "Organization",
            "name": "ESL-plans.com",
            "url": "https://esl-plans.com"
        },
        "educationalLevel": "${lesson.levelLabel}",
        "inLanguage": "en",
        "url": "https://esl-plans.com/lessons/${slug}"
    }
    </script>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #fff5ee; margin: 0; padding: 0; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { color: #c95210; font-size: 28px; margin-bottom: 8px; }
        .meta { color: #888; font-size: 14px; margin-bottom: 24px; }
        h2 { color: #333; font-size: 18px; margin: 24px 0 12px; }
        ul { color: #444; line-height: 1.8; padding-left: 20px; }
        .desc { color: #444; line-height: 1.7; white-space: pre-line; }
        .back { display: inline-block; margin-top: 30px; color: #c95210; text-decoration: none; font-weight: 600; }
    </style>
    <script>window.location.href = 'https://esl-plans.com/#lesson-${slug}';</script>
</head>
<body>
    <div class="container">
        <h1>${lesson.title}</h1>
        <p class="meta">${lesson.levelLabel} &middot; ${lesson.categoryLabel} &middot; ${lesson.duration}</p>
        <h2>Main Objectives</h2>
        <ul>${objectivesList}</ul>
        <h2>About This Lesson</h2>
        <p class="desc">${descSafe}</p>
        <a class="back" href="https://esl-plans.com">&larr; Back to ESL-plans.com</a>
    </div>
</body>
</html>`;

    fs.writeFileSync(`lessons/${slug}.html`, html, 'utf8');
    console.log(`Generated: lessons/${slug}.html`);
});

// Generate sitemap.xml
const today = new Date().toISOString().split('T')[0];
const lessonUrls = lessons.map(lesson => {
    const slug = slugify(lesson.title);
    return `    <url>
        <loc>https://esl-plans.com/lessons/${slug}</loc>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
        <lastmod>${today}</lastmod>
    </url>`;
}).join('\n');

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
</urlset>`;

fs.writeFileSync('sitemap.xml', sitemap, 'utf8');
console.log(`Generated sitemap.xml with ${lessons.length + 2} URLs`);
console.log('All done!');
