// 이미지 프록시 (다운로드/ZIP용 · 핫링크/CORS 회피를 위해 referer 부여)
const ALLOW = [/(^|\.)cdn\.imweb\.me$/, /(^|\.)cdn-optimized\.imweb\.me$/, /cloudfront\.net$/];
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const src = (req.query.src || '').toString();
    let u; try { u = new URL(src); } catch { return res.status(400).send('bad src'); }
    if (u.protocol !== 'https:' || !ALLOW.some((re) => re.test(u.hostname)))
      return res.status(400).send('host not allowed');
    const referer = u.hostname.includes('imweb') ? 'https://secretroot.imweb.me/' : 'https://jycompany.co/';
    const r = await fetch(u.href, { headers: { referer, 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return res.status(502).send('fetch fail ' + r.status);
    const type = r.headers.get('content-type') || 'image/jpeg';
    if (!type.startsWith('image/')) return res.status(415).send('not an image');
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).send('error: ' + (e && e.message ? e.message : String(e)));
  }
};
