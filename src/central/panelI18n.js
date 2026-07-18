// i18n bridge for the vendored "More Freally apps" panel.
//
// Studio's own i18n uses dotted JSON keys with {{double-brace}} interpolation,
// which can't resolve the panel's Fluent fcp-* keys ({ $var } placeables, with
// plural selectors). So the panel gets its OWN tiny Fluent runtime here, built
// from the vendored fcp-*.ftl catalogs (same 18 locale codes Studio ships),
// keyed to Studio's active language with an English fallback. Studio's own
// translation system is untouched.
import { FluentBundle, FluentResource } from '@fluent/bundle'

const FTL = import.meta.glob(
    '../../vendor/freally-central/ui/src/panel/locales/*.ftl',
    { query: '?raw', import: 'default', eager: true }
)

const SOURCES = new Map()
for (const [path, src] of Object.entries(FTL)) {
    const m = path.match(/locales\/([^/]+)\.ftl$/)
    if (m) SOURCES.set(m[1], src)
}

const cache = new Map()

function bundleFor(locale) {
    const key = SOURCES.has(locale) ? locale : 'en'
    const cached = cache.get(key)
    if (cached) return cached
    const bundle = new FluentBundle([key, 'en'])
    const src = SOURCES.get(key)
    if (src) bundle.addResource(new FluentResource(src))
    if (key !== 'en') {
        const en = SOURCES.get('en')
        if (en) bundle.addResource(new FluentResource(en), { allowOverrides: false })
    }
    cache.set(key, bundle)
    return bundle
}

/** Build a `t(key, args?) => string` for the panel, bound to one locale. */
export function makePanelT(locale) {
    return (key, args) => {
        const bundle = bundleFor(locale)
        const msg = bundle.getMessage(key)
        if (msg && msg.value) {
            const errs = []
            const out = bundle.formatPattern(msg.value, args, errs)
            if (errs.length === 0) return out
        }
        return key
    }
}
