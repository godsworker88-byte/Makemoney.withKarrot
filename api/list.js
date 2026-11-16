// 시크릿루트 상품 목록(카탈로그) 수집 — 앱 '둘러보기' 탭용
// GET ?url=<목록페이지>  (기본: 시크릿루트 홈)  →  { items:[{idx,url,name,thumb}] }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const q = (req.query && req.query.url) || 'https://secretroot.imweb.me/';
    let u;
    try { u = new URL(q); } catch { return res.status(400).json({ error: 'URL 오류' }); }
    if (u.hostname !== 'secretroot.imweb.me')
      return res.status(400).json({ error: '시크릿루트 목록만 지원해요.' });

    const r = await fetch(u.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) DainmarketCollector', 'Accept-Language': 'ko' }
    });
    if (!r.ok) return res.status(502).json({ error: '목록을 불러오지 못했어요 (' + r.status + ')' });
    const html = await r.text();

    const re = /href="\/(?:shop\/)?\?idx=(\d+)"[^>]*shop-item-thumb[\s\S]{0,600}?<img\b[^>]*\bsrc="([^"]+)"/gi;
    const seen = new Set(); const items = [];
    let m;
    while ((m = re.exec(html)) && items.length < 60) {
      const idx = m[1];
      if (seen.has(idx)) continue;
      let thumb = m[2];
      if (/\/(?:no_image|noimage|blank|loading)/i.test(thumb)) continue;
      const tail = html.slice(m.index, m.index + 1800);
      const nm = tail.match(/class="[^"]*(?:prod[-_]?name|item[-_]?name|shop[-_]?item[-_]?name|product[-_]?name|name|title|subject)[^"]*"[^>]*>\s*([^<][^<]{1,90}?)\s*</i);
      seen.add(idx);
      items.push({
        idx,
        url: 'https://secretroot.imweb.me/?idx=' + idx,
        thumb,
        name: nm ? nm[1].replace(/\s+/g, ' ').trim() : ''
      });
    }
    return res.status(200).json({ site: 'secretroot', count: items.length, items });
  } catch (e) {
    return res.status(500).json({ error: '목록 수집 오류: ' + (e && e.message || e) });
  }
};
