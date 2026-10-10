import './foliate/view.js'
import { EPUB } from './foliate/epub.js'
import { configure, ZipReader, BlobReader, TextWriter, BlobWriter } from './foliate/vendor/zip.js'

configure({ useWebWorkers: false })
const view = document.querySelector('foliate-view')
const motion = matchMedia('(prefers-reduced-motion: reduce)')
let book, archive, callbacks, preferences, active, closed = false

const configureView = value => {
    preferences = value
    const { theme, readingMode, animation, fontSize, lineHeight } = value
    const palette = {
        paper: ['#f8f3e9', '#3b332c'],
        green: ['#e3eddd', '#293b2c'],
        night: ['#242726', '#d2d5ca'],
    }[theme]
    document.body.style.background = palette[0]
    document.body.style.color = palette[1]
    if (!view.renderer) return
    view.renderer.setAttribute('flow', readingMode === 'scroll' ? 'scrolled' : 'paginated')
    view.renderer.setAttribute('margin', '24px')
    view.renderer.setAttribute('gap', '6%')
    view.renderer.setAttribute('max-inline-size', '720px')
    view.renderer.setAttribute('max-column-count', '2')
    view.renderer.toggleAttribute('animated', animation === 'slide' && !motion.matches)
    if (!view.isFixedLayout) view.renderer.setStyles(`
        html, body { color: ${palette[1]} !important; background: ${palette[0]} !important; }
        body {
            font-family: "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", SimSun, serif !important;
            font-size: ${fontSize}px !important;
            line-height: ${lineHeight} !important;
        }
        h1, h2, h3, h4, h5, h6 {
            color: inherit !important;
            font-family: inherit !important;
            font-weight: 600 !important;
            line-height: 1.6 !important;
            border: 0 !important;
            text-align: center !important;
            margin-block: 1.5em 1.2em !important;
        }
        h1 { font-size: 1.35em !important; }
        h2 { font-size: 1.2em !important; }
        h3, h4, h5, h6 { font-size: 1.05em !important; }
        p { margin-block: .9em !important; }
        a { color: inherit !important; text-decoration: underline; text-underline-offset: .2em; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
    `)
}
const updateMotion = () => configureView(preferences)
motion.addEventListener('change', updateMotion)

const navigate = action => {
    if (!active) return
    void action().catch(error => callbacks.onError(error.message))
}
const onKey = event => {
    if (!active || event.target.closest('input,textarea,select,button,[contenteditable="true"]')) return
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault()
        navigate(() => view.goRight())
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        navigate(() => view.goLeft())
    }
}
document.addEventListener('keydown', onKey)
view.addEventListener('load', ({ detail: { doc, index } }) => {
    doc.addEventListener('keydown', onKey)
    doc.addEventListener('selectionchange', () => {
        const selection = doc.getSelection()
        const text = selection.toString().trim()
        if (!text || selection.isCollapsed) { callbacks.onSelection(null); return }
        callbacks.onSelection({
            text,
            cfi: view.getCFI(index, selection.getRangeAt(0)),
            chapterTitle: view.lastLocation?.tocItem?.label ?? '',
        })
    })
    let start
    doc.addEventListener('pointerdown', event => { start = { x: event.clientX, y: event.clientY } })
    doc.addEventListener('pointerup', event => {
        if (!start) return
        const dx = event.clientX - start.x, dy = event.clientY - start.y
        start = null
        if (preferences.readingMode !== 'page' || doc.getSelection().toString()
            || event.target.closest('a,button,input,select,textarea')) return
        if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy)) {
            navigate(() => dx < 0 ? view.goRight() : view.goLeft())
        }
    })
    doc.addEventListener('pointercancel', () => { start = null })
})
view.addEventListener('relocate', ({ detail }) => {
    callbacks.onLocation({
        format: 'epub', cfi: detail.cfi, fraction: detail.fraction,
        chapterTitle: detail.tocItem?.label ?? '', href: detail.tocItem?.href ?? null,
        excerpt: detail.range?.toString().trim().slice(0, 72) ?? '',
    })
})

window.novaEpub = {
    async open(options) {
        callbacks = options
        active = options.active
        archive = new ZipReader(new BlobReader(new Blob([options.bytes], { type: 'application/epub+zip' })))
        const entries = new Map((await archive.getEntries()).map(entry => [entry.filename, entry]))
        book = await new EPUB({
            loadText: name => entries.get(name)?.getData(new TextWriter()),
            loadBlob: name => entries.get(name)?.getData(new BlobWriter()),
            getSize: name => entries.get(name)?.uncompressedSize,
        }).init()
        if (closed) { book.destroy(); await archive.close(); return }
        await view.open(book)
        configureView(options.preferences)
        await view.init({ lastLocation: options.cfi })
        return { toc: book.toc ?? [], fixedLayout: view.isFixedLayout }
    },
    configure: configureView,
    setActive(value) { active = value },
    goTo: target => view.goTo(target),
    prev: () => view.goLeft(),
    next: () => view.goRight(),
    async search(query) {
        const results = []
        for await (const result of view.search({ query })) {
            if (result.subitems) for (const item of result.subitems) {
                results.push({ cfi: item.cfi, label: result.label,
                    excerpt: item.excerpt.pre + item.excerpt.match + item.excerpt.post })
            }
        }
        return results
    },
    clearSelection: () => view.deselect(),
    close() {
        closed = true
        motion.removeEventListener('change', updateMotion)
        if (view.renderer?.getContents().length) view.close()
        book?.destroy()
        void archive?.close()
    },
}
