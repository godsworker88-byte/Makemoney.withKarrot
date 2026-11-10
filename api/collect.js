// 다인마켓 상품 수집 API (Vercel 서버리스 · 브라우저/Playwright 불필요)
// GET /api/collect?url=https://secretroot.imweb.me/shop/?idx=1605
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const raw = (req.query.url || '').toString();
    let u;
    try { u = new URL(raw); } catch { return res.status(400).json({ error: 'URL 형식이 올바르지 않아요.' }); }
    if (u.protocol !== 'https:' || u.hostname !== 'secretroot.imweb.me' || !u.pathname.startsWith('/shop/'))
      return res.status(400).json({ error: '시크릿루트 상품 URL(secretroot.imweb.me/shop/...)만 가능해요.' });

    const r = await fetch(u.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) DainmarketCollector', 'Accept-Language': 'ko' }
    });
    if (!r.ok) return res.status(502).json({ error: '공급처 페이지를 불러오지 못했어요. (' + r.status + ')' });
    const html = await r.text();

    const meta = (p) => {
      const m = html.match(new RegExp('<meta[^>]+property=["\\\']' + p + '["\\\'][^>]+content=["\\\']([^"\\\']+)', 'i'));
      return m ? m[1] : '';
    };
    const name = (meta('og:title') || '').replace(/\s*:\s*시크릿루트\s*$/, '').trim();
    const ogImage = meta('og:image');
    const siteName = meta('og:site_name') || '시크릿루트';

    // --- 로고·파비콘 등 상품 외 이미지 제외 ---
    const exclude = new Set();
    // 파비콘/터치아이콘
    for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["'](https:\/\/cdn\.imweb\.me\/[^"']+)/gi)) exclude.add(m[1]);
    // 로고: alt 값이 쇼핑몰명인 <img>
    const nameRe = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const altMatcher = new RegExp('alt=["\'][\\s]*' + nameRe + '[\\s]*["\']', 'i');
    for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
      const t = tag[0];
      if (altMatcher.test(t)) {
        for (const m of t.matchAll(/(?:src|data-src|currentSrc)=["'](https:\/\/cdn\.imweb\.me\/[^"']+)/gi)) exclude.add(m[1]);
      }
    }

    const all = [...new Set((html.match(/https?:\/\/cdn\.imweb\.me\/[^"'\s)\\]+\.(?:jpe?g|png|webp|gif)/gi) || []))]
      .filter((x) => !exclude.has(x));
    const detail = all.filter((x) => /\/upload\//.test(x));
    const thumbnail = all.filter((x) => /\/thumbnail\//.test(x));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      source: u.href,
      name,
      ogImage: exclude.has(ogImage) ? (detail[0] || thumbnail[0] || '') : ogImage,
      priceGated: true,
      images: { detail, thumbnail, all },
      counts: { detail: detail.length, thumbnail: thumbnail.length, total: all.length },
      excludedCount: exclude.size,
      notice: '이미지 사용·가공 권한은 공급처에 확인하세요. 가격은 회원 로그인에서 확인됩니다.'
    });
  } catch (e) {
    return res.status(500).json({ error: '수집 중 오류: ' + (e && e.message ? e.message : String(e)) });
  }
};
