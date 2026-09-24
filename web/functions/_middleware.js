// Beží pred servírovaním statických súborov (aj `public/index.html`).
// Ak má admin v D1 uložené SEO nastavenia (settings.seo), prepíše nimi
// <title>, meta description a og:* priamo v HTML odpovedi cez HTMLRewriter –
// vyhľadávače a social crawlery (ktoré JS nespúšťajú) tak dostanú správne meta tagy
// bez nutnosti nového deployu.

function absoluteUrl(path, origin) {
  if (!path) return null
  return /^https?:\/\//i.test(path) ? path : new URL(path, origin).toString()
}

function setAttr(name) {
  return { element(el) { el.setAttribute('content', name) } }
}

export async function onRequest(context) {
  const { request, next, env } = context
  const res = await next()

  const url = new URL(request.url)
  const isDoc = url.pathname === '/' || url.pathname === '/index.html'
  if (!isDoc || !(res.headers.get('content-type') || '').includes('text/html')) return res

  let seo = {}
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'seo'").first()
    if (row && row.value) seo = JSON.parse(row.value)
  } catch {
    return res // DB/parse zlyhalo -> necháme statické defaulty z index.html
  }

  const title = String(seo.title || '').trim()
  const description = String(seo.description || '').trim()
  const ogImage = absoluteUrl(String(seo.ogImage || '').trim(), url.origin)
  const noindex = !!seo.noindex
  if (!title && !description && !ogImage && !noindex) return res

  let rw = new HTMLRewriter()
  if (title) {
    rw = rw
      .on('title', { element(el) { el.setInnerContent(title) } })
      .on('meta[property="og:title"]', setAttr(title))
  }
  if (description) {
    rw = rw
      .on('meta[name="description"]', setAttr(description))
      .on('meta[property="og:description"]', setAttr(description))
  }
  if (ogImage) rw = rw.on('meta[property="og:image"]', setAttr(ogImage))
  if (noindex) {
    rw = rw.on('head', { element(el) { el.append('<meta name="robots" content="noindex, nofollow">', { html: true }) } })
  }
  return rw.transform(res)
}
