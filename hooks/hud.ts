import { SPRITES } from './sprites.ts'

export type Piece = { key: string; source: string; alt: string; w: number; h: number; tip?: string }
export type Reading = { contextPercent?: number; contextTokens?: number; contextWindow?: number; fiveHourUsed?: number; sevenDayUsed?: number; turns: number }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const left = (used: number) => Math.round(100 - used)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---- pure math (spec "Rows") ----
export const halvesOf = (percent: number) => clamp(Math.round((100 - percent) / 5), 0, 20)
export const heartState = (halves: number, i: number) => {
  const n = halves - 2 * i
  return n >= 2 ? 'heart' : n === 1 ? 'heart-half' : 'heart-empty'
}
export const tenthsOf = (percentUsed: number) => clamp(Math.round((100 - percentUsed) / 10), 0, 10)
export const fmtTokens = (n: number) =>
  n >= 1e6 ? `${Math.round(n / 1e5) / 10}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
export const levelOf = (turns: number) => Math.floor(turns / 5)
export const barOf = (turns: number) => (turns % 5) / 5

const ITEMS: Record<string, string> = {
  Grep: 'pickaxe', Glob: 'pickaxe', Read: 'book', Edit: 'bricks', Write: 'bricks', NotebookEdit: 'bricks',
  Bash: 'redstone', WebSearch: 'compass', WebFetch: 'compass', Agent: 'emerald', Task: 'emerald',
  Skill: 'enchanted', TodoWrite: 'paper',
}
export const itemOf = (tool: string) => ITEMS[tool] ?? (tool.startsWith('mcp__') ? 'chest' : 'stone')

// ---- svg building ----
const symbols = (names: Iterable<string>) =>
  [...new Set(names)]
    .map(id => {
      const s = SPRITES[id]
      return s ? `<symbol id="${id}" viewBox="0 0 ${s.w} ${s.h}">${s.body}</symbol>` : ''
    })
    .join('')
const wrap = (w: number, h: number, defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"><defs>${defs}</defs>${body}</svg>`

const PX = 2.4, ICON = 9 * PX, STEP = ICON + 1, ROW_W = 10 * STEP - 1, GAP = 26
const W = 2 * ROW_W + GAP

const row = (title: string, x: number, y: number, names: string[]) =>
  `<g><title>${esc(title)}</title>${names.map((n, i) => `<use href="#${n}" x="${x + i * STEP}" y="${y}" width="${ICON}" height="${ICON}"/>`).join('')}</g>`

function xpBar(x: number, y: number, frac: number) {
  const bw = 182, bh = 5, px = 2.2
  const fill = Math.round((bw - 2) * frac)
  let r = `<rect width="${bw}" height="${bh}" fill="#000"/><rect x="1" y="1" width="${bw - 2}" height="${bh - 2}" fill="#1d3a07"/>`
  r += `<rect x="1" y="1" width="${fill}" height="${bh - 2}" fill="#80ff20"/><rect x="1" y="1" width="${fill}" height="1" fill="#b8ff70"/>`
  for (let i = 1; i < 18; i++) r += `<rect x="${Math.round((i * bw) / 18)}" y="1" width="1" height="${bh - 2}" fill="#000" opacity=".55"/>`
  return { w: bw * px, h: bh * px, svg: `<g transform="translate(${x} ${y}) scale(${px})">${r}</g>` }
}

const piece = (key: string, w: number, h: number, names: string[], body: string, tip: string, alt = tip): Piece => ({
  key, w, h, tip, alt, source: wrap(w, h, symbols(names), body),
})

/** Rows of pieces: armor, hearts + food, XP bar. A row without data is left out. Stacked heights match the old single image. */
export function statsSvg(r: Reading): Piece[][] {
  const rows: Piece[][] = []

  if (r.sevenDayUsed !== undefined) {
    const n = tenthsOf(r.sevenDayUsed)
    const names = Array.from({ length: 10 }, (_, i) => (i < n ? 'armor' : 'armor-empty'))
    const t = `Armor: weekly limit left ${left(r.sevenDayUsed)}%`
    // trailing spacing: 3, plus 3 more when no hearts/food row follows
    const gap = r.contextPercent !== undefined || r.fiveHourUsed !== undefined ? 3 : 6
    rows.push([piece('armor', W, ICON + gap, names, row(t, 0, 0, names), t)])
  }

  const line: Piece[] = []
  if (r.contextPercent !== undefined) {
    const halves = halvesOf(r.contextPercent)
    const names = Array.from({ length: 10 }, (_, i) => heartState(halves, i))
    const t =
      r.contextTokens !== undefined && r.contextWindow !== undefined
        ? `Hearts: context used ${fmtTokens(r.contextTokens)}/${fmtTokens(r.contextWindow)} (${Math.round(r.contextPercent)}%)`
        : `Hearts: context left ${left(r.contextPercent)}%`
    line.push(piece('hearts', ROW_W, ICON + 6, names, row(t, 0, 0, names), t))
  }
  if (r.fiveHourUsed !== undefined) {
    const n = tenthsOf(r.fiveHourUsed)
    // filled drumsticks are the rightmost ones
    const names = Array.from({ length: 10 }, (_, i) => (i >= 10 - n ? 'food' : 'food-empty'))
    const t = `Food: 5-hour limit left ${left(r.fiveHourUsed)}%`
    // beside hearts the piece is the right-hand W-ROW_W; alone it spans W so the icons stay right-aligned
    const w = line.length ? W - ROW_W : W
    line.push(piece('food', w, ICON + 6, names, row(t, w - ROW_W, 0, names), t))
  }
  if (line.length) rows.push(line)

  const level = levelOf(r.turns)
  const into = r.turns % 5
  const bar = xpBar((W - 182 * 2.2) / 2, 17, barOf(r.turns))
  const title = `Level ${level}: ${into} of 5 turns to next level`
  const body =
    `<g><title>${title}</title>${bar.svg}` +
    `<text x="${W / 2}" y="14" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="15" fill="#80ff20" stroke="#000" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${level}</text>` +
    `</g>`
  rows.push([piece('xp', W, 17 + bar.h, [], body, title, `HUD: level ${level}, ${into} of 5 turns to next level`)])
  return rows
}

const SLOT = 52, SLOTS = 9

/** Nine slots, first-used first; the running tool's slot is "held". Empty slots are drawn when unused; `dim` fades them (idle). */
export function hotbarSvg(hotbar: [string, number][], running?: string, dim = false): Piece[] {
  const slots = hotbar.slice(0, SLOTS)
  const none = slots.length === 0
  return Array.from({ length: SLOTS }, (_, i) => {
    const key = `slot-${i}`
    const s = slots[i]
    let body: string, names: string[] = [], tip: string | undefined
    if (!s) {
      body = `<rect width="${SLOT}" height="${SLOT}" fill="#8b8b8b"/><rect x="2.6" y="2.6" width="${SLOT - 5.2}" height="${SLOT - 5.2}" fill="#2b2b2b"/>`
      if (none) tip = 'Hotbar: no tools used yet'
    } else {
      const [tool, count] = s
      names = [`slot-${itemOf(tool)}${tool === running ? '-held' : ''}`]
      tip = `${tool} (${itemOf(tool)}): used ${count} ${count === 1 ? 'time' : 'times'} this turn`
      const label = `<text x="${SLOT - 5}" y="${SLOT - 4}" text-anchor="end" font-family="monospace" font-weight="bold" font-size="13"`
      body =
        `<g><title>${esc(tip)}</title><use href="#${names[0]}" width="${SLOT}" height="${SLOT}"/>` +
        `${label} dx="1" dy="1" fill="#3f3f3f">${count}</text>${label} fill="#fff">${count}</text></g>`
    }
    if (dim) body = `<g opacity=".45">${body}</g>`
    return { key, w: SLOT, h: SLOT, tip, alt: s ? `Hotbar: ${s[0]} x${s[1]}` : tip ?? 'Empty hotbar slot', source: wrap(SLOT, SLOT, symbols(names), body) }
  })
}
