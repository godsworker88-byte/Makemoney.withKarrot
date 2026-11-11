// 다인마켓 상품 수집 API (Vercel 서버리스 · 브라우저/Playwright 불필요)
// 지원: secretroot.imweb.me (/shop/), jycompany.co (/products/)
const SITES = {
  'secretroot.imweb.me': { path: '/shop/', kind: 'imweb' },
  'jycompany.co':        { path: '/products/', kind: 'jycompany' }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const raw = (req.query.url || '').toString();
    let u;
    try { u = new URL(raw); } catch { return res.status(400).json({ error: 'URL 형식이 올바르지 않아요.' }); }
    const site = SITES[u.hostname];
    if (u.protocol !== 'https:' || !site || !u.pathname.startsWith(site.path))
      return res.status(400).json({ error: '지원하는 공급처 상품 URL이 아니에요 (시크릿루트 /shop/, JYCompany /products/).' });

    const r = await fetch(u.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) DainmarketCollector', 'Accept-Language': 'ko' }
    });
    if (!r.ok) return res.status(502).json({ error: '공급처 페이지를 불러오지 못했어요. (' + r.status + ')' });
    const html = await r.text();

    const meta = (p) => {
      const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\\\']' + p + '["\\\'][^>]+content=["\\\']([^"\\\']+)', 'i'));
      return m ? m[1] : '';
    };
    let name = (meta('og:title') || '').replace(/\s*[:|\-]\s*(시크릿루트|JYCompany|제이와이컴퍼니)\s*$/i, '').trim();
    const ogImage = meta('og:image');

    let detail = [], thumbnail = [], all = [];
    if (site.kind === 'imweb') {
      const siteName = meta('og:site_name') || '시크릿루트';
      const exclude = new Set();
      for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["'](https:\/\/cdn\.imweb\.me\/[^"']+)/gi)) exclude.add(m[1]);
      const nameRe = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const altMatcher = new RegExp('alt=["\'][\\s]*' + nameRe + '[\\s]*["\']', 'i');
      for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
        if (altMatcher.test(tag[0])) for (const m of tag[0].matchAll(/(?:src|data-src|currentSrc)=["'](https:\/\/cdn\.imweb\.me\/[^"']+)/gi)) exclude.add(m[1]);
      }
      all = [...new Set((html.match(/https?:\/\/cdn\.imweb\.me\/[^"'\s)\\]+\.(?:jpe?g|png|webp|gif)/gi) || []))].filter((x) => !exclude.has(x));
      detail = all.filter((x) => /\/upload\//.test(x));
      thumbnail = all.filter((x) => /\/thumbnail\//.test(x));
    } else if (site.kind === 'jycompany') {
      // 상품 이미지는 CloudFront의 /products/ 경로 — 로고/배너는 그 경로가 아니므로 자연히 제외됨
      all = [...new Set((html.match(/https?:\/\/[a-z0-9.\-]*cloudfront\.net\/products\/[^"'\s)\\]+\.(?:jpe?g|png|webp|gif)/gi) || []))];
      detail = all.slice();
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      source: u.href, site: site.kind, name, ogImage,
      priceGated: true,
      images: { detail, thumbnail, all },
      counts: { detail: detail.length, thumbnail: thumbnail.length, total: all.length },
      notice: '이미지 사용·가공 권한은 공급처에 확인하세요. 가격은 회원 로그인에서 확인됩니다.'
    });
  } catch (e) {
    return res.status(500).json({ error: '수집 중 오류: ' + (e && e.message ? e.message : String(e)) });
  }
};
