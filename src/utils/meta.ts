export type MetaParams = {
  title?: string
  description?: string
  url?: string
  image?: string
  siteName?: string
  twitterHandle?: string
}

export function setMeta(params: MetaParams) {
  const { title, description, url, image, siteName, twitterHandle } = params

  if (title) {
    const full = siteName ? `${title} • ${siteName}` : title
    document.title = full
    setTag({ name: 'title', content: full })
    setTag({ property: 'og:title', content: title })
    setTag({ name: 'twitter:title', content: title })
  }

  if (description) {
    setTag({ name: 'description', content: description })
    setTag({ property: 'og:description', content: description })
    setTag({ name: 'twitter:description', content: description })
  }

  if (url) {
    setTag({ property: 'og:url', content: url })
  }

  if (image) {
    setTag({ property: 'og:image', content: image })
    setTag({ name: 'twitter:image', content: image })
  }

  setTag({ property: 'og:type', content: 'website' })
  if (siteName) setTag({ property: 'og:site_name', content: siteName })

  setTag({ name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' })
  if (twitterHandle) setTag({ name: 'twitter:site', content: twitterHandle })
}

type MetaTag = {
  name?: string
  property?: string
  content: string
}

function setTag(tag: MetaTag) {
  const selector = tag.name ? `meta[name="${cssEscape(tag.name)}"]` : `meta[property="${cssEscape(tag.property ?? '')}"]`

  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    if (tag.name) el.setAttribute('name', tag.name)
    if (tag.property) el.setAttribute('property', tag.property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', tag.content)
}

function cssEscape(value: string) {
  return value.replace(/"/g, '\\"')
}
