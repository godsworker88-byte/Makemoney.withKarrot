// 시크릿루트 상품 목록(카탈로그) 수집 — 앱 '둘러보기' 탭용
// GET ?url=<목록페이지>  (기본: 시크릿루트 홈)  →  { items:[{idx,url,name,thumb}] }

const UA = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) DainmarketCollector', 'Accept-Language': 'ko' };
const HOME = 'https://secretroot.imweb.me/';

async function fetchHome() {
  const r = await fetch(HOME, { headers: UA });
  if (!r.ok) throw new Error('홈 ' + r.status);
  return r.text();
}

// 홈(신상) 위젯 상품 파싱
function parseHome(html) {
  const re = /href="\/(?:shop\/)?\?idx=(\d+)"[^>]*shop-item-thumb[\s\S]{0,600}?<img\b[^>]*\bsrc="([^"]+)"/gi;
  const seen = new Set(); const items = []; let m;
  while ((m = re.exec(html)) && items.length < 60) {
    const idx = m[1];
    if (seen.has(idx)) continue;
    const thumb = m[2];
    if (/\/(?:no_image|noimage|blank|loading)/i.test(thumb)) continue;
    const tail = html.slice(m.index, m.index + 1800);
    const nm = tail.match(/class="[^"]*(?:prod[-_]?name|item[-_]?name|shop[-_]?item[-_]?name|product[-_]?name|name|title|subject)[^"]*"[^>]*>\s*([^<][^<]{1,90}?)\s*</i);
    seen.add(idx);
    items.push({ idx, url: HOME + '?idx=' + idx, thumb, name: nm ? nm[1].replace(/\s+/g, ' ').trim() : '' });
  }
  return items;
}

// 개별 상품 메타(이름/이미지) — 살아있으면 반환, 아니면 null
// (주의: og 태그가 작은따옴표라 <title>로 이름을 뽑는다)
async function prod(idx) {
  try {
    const r = await fetch(HOME + '?idx=' + idx, { headers: UA });
    if (r.status !== 200) return null;
    const h = await r.text();
    let name = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    name = name.replace(/\s*[:|\-]\s*시크릿루트\s*$/, '').trim();
    if (!name || name === '시크릿루트' || /페이지 없음|존재하지 않/.test(name)) return null;
    const img = (h.match(/property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/) || [])[1]
      || (h.match(/content=['"]([^'"]+)['"][^>]*property=['"]og:image['"]/) || [])[1] || '';
    if (!/cdn/.test(img)) return null;
    return { idx: String(idx), url: HOME + '?idx=' + idx, thumb: img, name };
  } catch (e) { return null; }
}

// 예전 상품 포함 랜덤 샘플 — 전 범위가 거의 살아있어 적중률이 높음
async function sampleOlder(maxIdx) {
  const hi = maxIdx - 1, lo = 1;
  const picks = new Set();
  while (picks.size < 20) picks.add(lo + Math.floor(Math.random() * (hi - lo + 1)));
  const pool = [...picks];
  const items = [];
  for (let k = 0; k < pool.length && items.length < 12; k += 8) {
    const got = await Promise.all(pool.slice(k, k + 8).map(prod));
    for (const g of got) if (g && items.length < 12) items.push(g);
  }
  items.sort((a, b) => Number(b.idx) - Number(a.idx));
  return items;
}

// ---- JYCompany (화장품) ----
const JY_HOME = 'https://jycompany.co/';
async function parseJY() {
  const r = await fetch(JY_HOME, { headers: UA });
  if (!r.ok) throw new Error('JY홈 ' + r.status);
  const h = await r.text();
  // 카드(article) 단위로 쪼개서 '카톤발주만 가능' 상품은 제외(소량 낱개발주만 노출)
  const cards = h.split(/<article[^>]*product-card[^>]*>/i).slice(1);
  const seen = new Set(); const items = [];
  for (const c of cards) {
    if (items.length >= 60) break;
    const body = c.split('</article>')[0];
    if (/카톤발주만/.test(body)) continue;           // 카톤(대량)만 가능 → 제외
    const slug = (body.match(/\/products\/([a-z0-9]{10,40})/) || [])[1];
    if (!slug || seen.has(slug)) continue;
    const img = (body.match(/<img[^>]*\bsrc="([^"]+)"/) || [])[1] || '';
    if (!/cloudfront/.test(img)) continue;
    const alt = (body.match(/\balt="([^"]*)"/) || [])[1] || '';
    seen.add(slug);
    const thumb = img.replace(/(-thumb)?\.jpg(\?|$)/i, '-thumb.jpg$2');
    items.push({ idx: slug, url: JY_HOME + 'products/' + slug, thumb, name: decodeEnt(alt).replace(/\s*\(낱개발주용\)\s*/, '').replace(/\s+/g, ' ').trim() });
  }
  return items;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function decodeEnt(s) { return (s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' '); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const site = (req.query && req.query.site) || 'secretroot';
    const mode = (req.query && req.query.mode) || 'new';

    if (site === 'jycompany') {
      let items = await parseJY();
      if (mode === 'random') items = shuffle(items).slice(0, 12);
      return res.status(200).json({ site, mode, count: items.length, items });
    }

    // secretroot
    const html = await fetchHome();
    const homeItems = parseHome(html);
    if (mode === 'random' || mode === 'older') {
      const maxIdx = homeItems.length ? Math.max(...homeItems.map(i => Number(i.idx))) : 1733;
      const items = await sampleOlder(maxIdx);
      return res.status(200).json({ site: 'secretroot', mode, count: items.length, items });
    }
    return res.status(200).json({ site: 'secretroot', mode: 'new', count: homeItems.length, items: homeItems });
  } catch (e) {
    return res.status(500).json({ error: '목록 수집 오류: ' + (e && e.message || e) });
  }
};
