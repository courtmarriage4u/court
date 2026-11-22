// Court Marriage For U: site build.
// Copies the site into /dist and turns every article in content/insights into a web page.
// Uses only built-in Node features, so there is nothing to install.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const SITE = 'https://courtmarriage4u.com';
const SKIP = new Set(['dist', 'content', 'i18n', 'pages', 'layout.html', 'build.js', 'netlify.toml', 'DEPLOY-GUIDE.txt', 'NOTES-LANGUAGE-POPUP.txt', '.git', 'node_modules']);

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeUrl = u => (/^\s*(javascript|data|vbscript):/i.test(u) ? '#' : u);

// ---- front matter (the settings block at the top of each article file) ----
function unquote(s) {
  s = s.trim();
  if (s.length > 1 && s[0] === '"' && s[s.length - 1] === '"') return s.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  if (s.length > 1 && s[0] === "'" && s[s.length - 1] === "'") return s.slice(1, -1).replace(/''/g, "'");
  return s;
}
function parseFront(raw) {
  raw = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const rows = {}, mode = {};
  let key = null;
  for (const line of m[1].split('\n')) {
    const kv = /^\s/.test(line) ? null : line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
    if (kv) {
      key = kv[1];
      const v = (kv[2] || '').trim();
      if (/^[|>][-+]?$/.test(v)) { mode[key] = v[0]; rows[key] = []; } else { mode[key] = ''; rows[key] = [v]; }
    } else if (key && line.trim()) {
      rows[key].push(line.trim());
    }
  }
  const data = {};
  for (const k of Object.keys(rows)) {
    data[k] = mode[k] === '|' ? rows[k].join('\n') : mode[k] === '>' ? rows[k].join(' ') : unquote(rows[k].join(' '));
  }
  return { data, body: m[2] };
}

// ---- markdown to HTML (headings, paragraphs, lists, links, images, quotes, tables) ----
function inline(s) {
  s = esc(s);
  const stash = [];
  const keep = h => '\u0000' + (stash.push(h) - 1) + '\u0000';
  s = s.replace(/`([^`]+)`/g, (m, c) => keep('<code>' + c + '</code>'));
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, a, u) => keep('<img src="' + safeUrl(u) + '" alt="' + a + '" loading="lazy">'));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, t, u) => keep('<a href="' + safeUrl(u) + '">') + t + keep('</a>'));
  s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
       .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
       .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
       .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
       .replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[i]);
}
const isBlockStart = l => /^(#{1,6}\s|>|\s*[-*+]\s+|\s*\d+[.)]\s+|(-{3,}|\*{3,})\s*$|\s*\|)/.test(l);
function md(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { const n = Math.min(Math.max(m[1].length, 2), 4); out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^>/.test(l)) { const q = []; while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, '')); out.push('<blockquote>' + md(q.join('\n')) + '</blockquote>'); continue; }
    if (/^\s*[-*+]\s+/.test(l)) { const it = []; while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) it.push(lines[i++].replace(/^\s*[-*+]\s+/, '')); out.push('<ul>' + it.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul>'); continue; }
    if (/^\s*\d+[.)]\s+/.test(l)) { const it = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) it.push(lines[i++].replace(/^\s*\d+[.)]\s+/, '')); out.push('<ol>' + it.map(x => '<li>' + inline(x) + '</li>').join('') + '</ol>'); continue; }
    if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push('<div class="tablewrap"><table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && (p.length === 0 || !isBlockStart(lines[i]))) p.push(lines[i++]);
    out.push('<p>' + inline(p.join('\n')).replace(/ {2,}\n|\\\n/g, '<br>').replace(/\n/g, ' ') + '</p>');
  }
  return out.join('\n');
}

const fmtDate = (d, lang) => {
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  try { return dt.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }); }
  catch (e) { return dt.toDateString(); }
};

// ---- 1. fresh dist folder with a copy of the static files ----
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'hi'), { recursive: true });
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const LAYOUT = read('layout.html');

// ---- 2. articles written in the console ----
const dir = path.join(ROOT, 'content', 'insights');
const posts = [];
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const { data, body } = parseFront(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (String(data.draft).toLowerCase() === 'true') continue;          // saved as draft
    const when = new Date(data.date);
    if (!isNaN(when) && when > new Date()) continue;                      // dated in the future
    posts.push({ slug: f.replace(/\.md$/, ''), title: data.title || f, category: data.category || 'General', lang: data.language === 'hi' ? 'hi' : 'en',
      summary: data.summary || '', cover: data.cover || '', coverAlt: data.cover_alt || '', date: data.date || '', html: md(body) });
  }
}
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

// ---- 3. languages (English and Hindi) ----
const I18N = JSON.parse(read('i18n/hi.json'));
const missing = new Set();
const CAT_HI = { 'Marriage Registration': 'विवाह पंजीकरण', 'Family and Matrimonial Law': 'पारिवारिक एवं वैवाहिक कानून', 'NRI Matters': 'एनआरआई मामले', 'Wills and Succession': 'वसीयत और उत्तराधिकार', 'General': 'सामान्य' };
const decode = t => t.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&rsquo;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
  .replace(/&ldquo;/g, '\u201C').replace(/&rdquo;/g, '\u201D').replace(/&larr;/g, '\u2190').replace(/&rarr;/g, '\u2192').replace(/&middot;/g, '\u00B7')
  .replace(/&times;/g, '\u00D7').replace(/&copy;/g, '\u00A9').replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).replace(/&amp;/g, '&');
const norm = t => decode(t).replace(/\s+/g, ' ').trim();
function tr(text, report) {
  const k = norm(text);
  if (!k) return null;
  if (Object.prototype.hasOwnProperty.call(I18N, k)) return I18N[k];
  if (report && !k.includes('{{') && /[A-Za-z]{3,}/.test(k)) missing.add(k);
  return null;
}
function translateHtml(html, report) {
  return html.replace(/(<script[\s\S]*?<\/script>)|(<style[\s\S]*?<\/style>)|(<!--[\s\S]*?-->)|(<[^>]+>)|([^<]+)/g, (m, sc, st, cm, tag, text) => {
    if (sc || st || cm) return m;
    if (tag) {
      const isDesc = /name="description"/.test(tag);
      return tag.replace(/(\s)(alt|title|aria-label|placeholder|content)="([^"]*)"/g, (mm, sp, attr, v) => {
        if (attr === 'content' && !isDesc) return mm;
        const h = tr(v, report);
        return h === null ? mm : sp + attr + '="' + esc(h) + '"';
      });
    }
    const h = tr(text, report);
    if (h === null) return m;
    return text.match(/^\s*/)[0] + esc(h).replace(/&quot;/g, '"') + text.match(/\s*$/)[0];
  });
}
function toHindi(html) {
  let h = html.replace('<html lang="en">', '<html lang="hi">');
  h = translateHtml(h, false);
  h = h.replace('family=Hind:wght@400;500;600', 'family=Hind:wght@400;500;600&family=Noto+Serif+Devanagari:wght@600;700');
  h = h.replace(/href="\/([a-z0-9-]+\.html)(#[^"]*)?"/g, (m, p, hash) => 'href="/hi/' + p + (hash || '') + '"');
  h = h.replace(/href="\/"/g, 'href="/hi/"');
  return h;
}
const NAVS = ['home', 'about', 'marriage', 'family', 'nri', 'wills', 'insights', 'contact'];
function fill(html, o) {
  let h = html.split('{{EN_URL}}').join(o.en).split('{{HI_URL}}').join(o.hi).split('{{ALT_URL}}').join(o.alt || '')
    .split('{{EN_CUR}}').join(o.lang === 'en' ? ' aria-current="true"' : '').split('{{HI_CUR}}').join(o.lang === 'hi' ? ' aria-current="true"' : '')
    .split('{{THANKS}}').join(o.lang === 'hi' ? '/hi/thank-you.html' : '/thank-you.html');
  for (const k of NAVS) h = h.split('{{CUR_' + k + '}}').join(o.nav === k ? ' aria-current="page"' : '');
  return h;
}

// disclaimer pop-up: the text comes from pages/disclaimer.html, so it is written once
const discSrc = read('pages/disclaimer.html');
const DISC_SNIPPET = discSrc.split('<!--DISC-START-->')[1].split('<!--DISC-END-->')[0].trim();
const DISC_HEAD = "<script>(function(){try{var t=parseInt(localStorage.getItem('cmfu_disclaimer'),10);if(t&&Date.now()-t<15552000000)return;}catch(e){}document.documentElement.className+=' disc';})();</script>";
const MODAL = '<div id="disc-modal" class="disc-modal" role="dialog" aria-modal="true" aria-labelledby="disc-title"><div class="disc-box"><h2 id="disc-title">Disclaimer &amp; Confirmation</h2><div class="disc-text" tabindex="0">' + DISC_SNIPPET + '</div><div class="disc-actions"><button type="button" class="btn btn-brass" id="disc-yes">I Agree</button><button type="button" class="btn btn-out" id="disc-no">I Disagree</button></div></div></div>';
function inject(html, o) {
  let h = html;
  if (!o.nomodal) {
    h = h.replace('</head>', () => DISC_HEAD + '</head>');
    h = h.replace(/<script src="\/?script\.js">/, m => MODAL + '\n' + m);
  }
  if (o.head) h = h.replace('</head>', () => o.head + '</head>');
  return h;
}

// ---- 4. cards and lists of articles ----
const cardHtml = (p, lang) => {
  const extra = p.lang === lang ? '' : (lang === 'en' ? ' &middot; Available in Hindi' : ' &middot; \u0905\u0902\u0917\u094D\u0930\u0947\u091C\u093C\u0940 \u092E\u0947\u0902 \u0909\u092A\u0932\u092C\u094D\u0927');
  const cat = lang === 'hi' ? (CAT_HI[p.category] || p.category) : p.category;
  return '<article class="post"><a href="/insights/' + encodeURIComponent(p.slug) + '/">' +
    (p.cover ? '<div class="ph r169"><img src="' + esc(safeUrl(p.cover)) + '" alt="' + esc(p.coverAlt) + '" loading="lazy"></div>' : '<div class="ph r169"></div>') +
    '<p class="tag">' + esc(cat) + ' &middot; ' + esc(fmtDate(p.date, lang)) + extra + '</p><h3>' + esc(p.title) + '</h3><p>' + esc(p.summary) + '</p></a></article>';
};
const listing = lang => posts.length ? posts.map(p => cardHtml(p, lang)).join('\n') : '<p class="note" style="grid-column:1/-1">New articles will appear here soon.</p>';
const latest = lang => posts.length ? '<section class="stone"><div class="wrap"><p class="eyebrow">Insights</p><h2 class="t">Latest insights</h2><div class="cards">' + posts.slice(0, 3).map(p => cardHtml(p, lang)).join('') + '</div><a class="more" href="/insights.html">View all insights &rarr;</a></div></section>' : '';

// ---- 5. put a page together from the layout ----
function compose(frag, o) {
  const main = frag.replace(/<!--(title|desc|nav):[\s\S]*?-->\n?/g, '').replace(/<!--(noindex|single|nomodal|noreport)-->\n?/g, '')
    .replace('<!--ARTICLES-->', () => listing(o.lang)).replace('<!--LATEST-->', () => latest(o.lang));
  let h = LAYOUT.replace('{{TITLE}}', () => o.title).replace('{{DESC}}', () => o.desc)
    .replace('{{ROBOTS}}', () => (o.noindex ? '<meta name="robots" content="noindex">\n' : '')).replace('{{MAIN}}', () => main);
  h = inject(h, { nomodal: o.nomodal, head: o.head });
  return h;
}
const meta = (frag, k) => ((frag.match(new RegExp('<!--' + k + ':\\s*([\\s\\S]*?)-->')) || [])[1] || '').trim();

const pageFiles = fs.readdirSync(path.join(ROOT, 'pages')).filter(f => f.endsWith('.html') && !f.startsWith('_'));
const sitemap = [];
for (const f of pageFiles) {
  const frag = read('pages/' + f);
  const flag = k => frag.includes('<!--' + k + '-->');
  const home = f === 'index.html';
  const enUrl = home ? '/' : '/' + f, hiUrl = home ? '/hi/' : '/hi/' + f;
  const o = { title: meta(frag, 'title'), desc: meta(frag, 'desc'), nav: meta(frag, 'nav'), noindex: flag('noindex'), nomodal: flag('nomodal') };
  if (!flag('noreport')) translateHtml(compose(frag, Object.assign({ lang: 'en', head: '' }, o)), true);   // strings without a Hindi version
  for (const lang of (flag('single') ? ['en'] : ['en', 'hi'])) {
    const own = lang === 'en' ? enUrl : hiUrl;
    const head = (o.noindex || flag('single')) ? '' : '<link rel="canonical" href="' + SITE + own + '"><link rel="alternate" hreflang="en" href="' + SITE + enUrl + '"><link rel="alternate" hreflang="hi" href="' + SITE + hiUrl + '"><link rel="alternate" hreflang="x-default" href="' + SITE + enUrl + '">';
    let h = compose(frag, Object.assign({ lang, head }, o));
    if (lang === 'hi') h = toHindi(h);
    h = fill(h, { lang, en: flag('single') ? '/' : enUrl, hi: flag('single') ? '/hi/' : hiUrl, alt: flag('single') ? '' : (lang === 'en' ? hiUrl : enUrl), nav: o.nav });
    fs.writeFileSync(path.join(OUT, lang === 'en' ? f : path.join('hi', f)), h);
    if (!o.noindex && !flag('single')) sitemap.push(SITE + own);
  }
}

// ---- 6. one page per article (English or Hindi, depending on the article) ----
const artFrag = read('pages/_article.html');
for (const p of posts) {
  const url = SITE + '/insights/' + encodeURIComponent(p.slug) + '/';
  let h = compose(artFrag, { lang: p.lang, title: '{{TITLE}} | Insights | Court Marriage For U', desc: '{{DESC}}', nav: 'insights', head: '<link rel="canonical" href="{{CANON}}">' });
  if (p.lang === 'hi') h = toHindi(h);
  h = fill(h, { lang: p.lang, en: '/insights.html', hi: '/hi/insights.html', alt: '', nav: 'insights' });
  const cover = p.cover ? '<img class="cover" src="' + esc(safeUrl(p.cover)) + '" alt="' + esc(p.coverAlt) + '">' : '';
  h = h.split('{{TITLE}}').join(esc(p.title)).split('{{DESC}}').join(esc(p.summary)).split('{{CATEGORY}}').join(esc(p.lang === 'hi' ? (CAT_HI[p.category] || p.category) : p.category))
    .split('{{DATE}}').join(esc(fmtDate(p.date, p.lang))).split('{{CANON}}').join(url).split('{{COVER}}').join(cover).split('{{CONTENT}}').join(p.html);
  fs.mkdirSync(path.join(OUT, 'insights', p.slug), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'insights', p.slug, 'index.html'), h);
  sitemap.push(url);
}

// ---- 7. sitemap and robots ----
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + sitemap.map(u => '<url><loc>' + u + '</loc></url>').join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ' + SITE + '/sitemap.xml\n');

const ignore = /^(images\/|Dak Bunglow|Patna 800001|3rd Floor)/;
const todo = [...missing].filter(k => !ignore.test(k));
console.log('Built site: ' + posts.length + ' article(s), ' + pageFiles.length + ' pages in English and Hindi.');
if (todo.length) {
  console.log(todo.length + ' strings without a Hindi version (add them to i18n/hi.json).');
  if (process.env.SHOW_MISSING) fs.writeFileSync(path.join(ROOT, 'i18n', '_missing.json'), JSON.stringify(todo, null, 1));
}
