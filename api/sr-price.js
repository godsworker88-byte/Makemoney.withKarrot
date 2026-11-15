// 시크릿루트 로그인 세션으로 '사입가(회원가)'까지 수집하는 API
// POST { url, uid, passwd }  →  { ok, salePrice, origPrice }
// 비밀번호는 로그인에만 사용하고 절대 로그/저장하지 않음.

const LOGIN_URL = 'https://secretroot.imweb.me/backpg/login.cm';

function addSetCookies(jar, res) {
  // undici/Node18+: getSetCookie() 로 개별 Set-Cookie 배열 획득
  let arr = [];
  try { if (typeof res.headers.getSetCookie === 'function') arr = res.headers.getSetCookie(); } catch (e) {}
  if (!arr.length) {
    const raw = res.headers.get('set-cookie');
    if (raw) arr = raw.split(/,(?=[^;]+?=)/);
  }
  for (const c of arr) {
    const nv = c.split(';')[0].trim();
    const eq = nv.indexOf('=');
    if (eq > 0) { const name = nv.slice(0, eq); const val = nv.slice(eq + 1);
      if (/deleted|^""?$/.test(val)) continue; // 삭제 쿠키 무시
      jar[name] = val;
    }
  }
}
function jarToHeader(jar) { return Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'POST 요청만 지원해요.' });

  try {
    // body 파싱 (문자열로 올 수도 있음)
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const url = (body.url || '').toString();
    const uid = (body.uid || '').toString();
    const passwd = (body.passwd || '').toString();

    if (!uid || !passwd) return res.status(400).json({ ok: false, reason: '시크릿루트 아이디/비밀번호가 설정되지 않았어요.' });

    let u;
    try { u = new URL(url); } catch { return res.status(400).json({ ok: false, reason: 'URL 형식이 올바르지 않아요.' }); }
    if (u.hostname !== 'secretroot.imweb.me' || !u.searchParams.has('idx'))
      return res.status(400).json({ ok: false, reason: '시크릿루트 상품(?idx=) 링크가 아니에요.' });

    // 1) 로그인
    const form = new URLSearchParams({
      back_url: 'Lw==', back_url_auth: '', used_login_btn: 'Y',
      uid, passwd, auto_login: 'Y'
    });
    const UA = 'Mozilla/5.0 (Linux; Android 14) DainmarketCollector';
    const jar = {};
    let loginRes = await fetch(LOGIN_URL, {
      method: 'POST', redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA, 'Accept-Language': 'ko'
      },
      body: form
    });
    const loginBody = await loginRes.text();
    addSetCookies(jar, loginRes);
    // 로그인 성공이 리다이렉트로 마무리되는 경우, 쿠키를 들고 한 번 따라가 세션 쿠키를 더 모음
    let hops = 0;
    while (loginRes.status >= 300 && loginRes.status < 400 && hops < 3) {
      const loc = loginRes.headers.get('location'); if (!loc) break;
      loginRes = await fetch(new URL(loc, LOGIN_URL).href, {
        method: 'GET', redirect: 'manual',
        headers: { 'Cookie': jarToHeader(jar), 'User-Agent': UA, 'Accept-Language': 'ko' }
      });
      addSetCookies(jar, loginRes); hops++;
    }
    // 실패 문구(정확히): "잘못된 아이디..." (평문 또는 유니코드 이스케이프). '비밀번호' 단독은 성공 페이지에도 흔해서 제외.
    const loginFailed = /잘못된 아이디|\\uc798\\ubabb\\ub41c/.test(loginBody);
    const cookie = jarToHeader(jar);
    if (!cookie)
      return res.status(200).json({ ok: false, reason: loginFailed ? '로그인 실패 — 아이디/비밀번호를 확인해주세요.' : '로그인 세션을 받지 못했어요. (' + loginRes.status + ')' });

    // 2) 로그인 세션으로 상품 페이지 가져오기
    const pr = await fetch(u.href, {
      headers: {
        'Cookie': cookie,
        'User-Agent': UA, 'Accept-Language': 'ko'
      }
    });
    if (!pr.ok) return res.status(502).json({ ok: false, reason: '상품 페이지를 불러오지 못했어요. (' + pr.status + ')' });
    const html = await pr.text();

    // 3) 가격 파싱 — 이 상품 전용 commerce 블록. (가격이 긁히면 = 로그인 성공)
    const m = html.match(/"commerce"\s*:\s*\{\s*"orig_price"\s*:\s*(\d+)\s*,\s*"sale_price"\s*:\s*(\d+)\s*\}/);
    if (!m) {
      if (loginFailed) return res.status(200).json({ ok: false, reason: '로그인 실패 — 아이디/비밀번호를 확인해주세요.' });
      const gated = /회원공개/.test(html);
      return res.status(200).json({ ok: false, reason: gated ? '가격이 아직 회원공개로 보여요. 로그인 승인 상태를 확인해주세요.' : '가격 정보를 찾지 못했어요.' });
    }
    const origPrice = Number(m[1]);
    const salePrice = Number(m[2]);
    return res.status(200).json({ ok: true, salePrice, origPrice, source: 'secretroot' });
  } catch (e) {
    return res.status(500).json({ ok: false, reason: '가격 수집 중 오류: ' + (e && e.message || e) });
  }
};
