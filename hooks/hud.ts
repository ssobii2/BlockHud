import { SPRITES } from './sprites.ts'

export type Hud = { source: string; alt: string; w: number; h: number; lines: string[] }
export type Reading = { contextPercent?: number; fiveHourUsed?: number; sevenDayUsed?: number; turns: number }

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

/** Armor, hearts, food and the XP bar. A row without data is left out. */
export function statsSvg(r: Reading): Hud {
  const used: string[] = []
  let body = ''
  let y = 0
  const alt: string[] = []
  const lines: string[] = []

  if (r.sevenDayUsed !== undefined) {
    const n = tenthsOf(r.sevenDayUsed)
    const names = Array.from({ length: 10 }, (_, i) => (i < n ? 'armor' : 'armor-empty'))
    used.push(...names)
    const t = `Armor: weekly limit left ${left(r.sevenDayUsed)}%`
    lines.push(t)
    body += row(t, 0, y, names)
    alt.push(`weekly limit left ${left(r.sevenDayUsed)}%`)
    y += ICON + 3
  }
  const hasHearts = r.contextPercent !== undefined
  if (hasHearts) {
    const halves = halvesOf(r.contextPercent!)
    const names = Array.from({ length: 10 }, (_, i) => heartState(halves, i))
    used.push(...names)
    const t = `Hearts: context left ${left(r.contextPercent!)}%`
    lines.push(t)
    body += row(t, 0, y, names)
    alt.push(`context left ${left(r.contextPercent!)}%`)
  }
  if (r.fiveHourUsed !== undefined) {
    const n = tenthsOf(r.fiveHourUsed)
    // filled drumsticks are the rightmost ones
    const names = Array.from({ length: 10 }, (_, i) => (i >= 10 - n ? 'food' : 'food-empty'))
    used.push(...names)
    const t = `Food: 5-hour limit left ${left(r.fiveHourUsed)}%`
    lines.push(t)
    body += row(t, W - ROW_W, y, names)
    alt.push(`5-hour limit left ${left(r.fiveHourUsed)}%`)
  }
  if (hasHearts || r.fiveHourUsed !== undefined) y += ICON + 6
  else if (y > 0) y += 3

  const level = levelOf(r.turns)
  const into = r.turns % 5
  const bar = xpBar((W - 182 * 2.2) / 2, y + 17, barOf(r.turns))
  const title = `Level ${level}: ${into} of 5 turns to next level`
  lines.push(title)
  const text = (extra: string) =>
    `<text x="${W / 2}" y="${y + 14}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="15"${extra}>${level}</text>`
  body +=
    `<g><title>${title}</title>${bar.svg}` +
    text(' fill="#80ff20" stroke="#000" stroke-width="4" stroke-linejoin="round" paint-order="stroke"') +
    `</g>`
  alt.push(`level ${level}, ${into} of 5 turns to next level`)

  const h = y + 17 + bar.h
  return { source: wrap(W, h, symbols(used), body), w: W, h, lines, alt: `HUD: ${alt.join(', ')}` }
}

const SLOT = 52, SLOTS = 9

/** Up to nine slots, first-used first; the running tool's slot is "held". Empty slots are drawn when unused; `dim` fades it (idle). */
export function hotbarSvg(hotbar: [string, number][], running?: string, dim = false): Hud {
  const slots = hotbar.slice(0, SLOTS)
  const names = slots.map(([tool]) => `slot-${itemOf(tool)}${tool === running ? '-held' : ''}`)
  let body = ''
  const lines: string[] = []
  for (let i = 0; i < SLOTS; i++) {
    const x = i * SLOT
    const s = slots[i]
    if (!s) {
      body += `<rect x="${x}" y="0" width="${SLOT}" height="${SLOT}" fill="#8b8b8b"/><rect x="${x + 2.6}" y="2.6" width="${SLOT - 5.2}" height="${SLOT - 5.2}" fill="#2b2b2b"/>`
      continue
    }
    const [tool, count] = s
    const label = `<text x="${x + SLOT - 5}" y="${SLOT - 4}" text-anchor="end" font-family="monospace" font-weight="bold" font-size="13"`
    const t = `${tool} (${itemOf(tool)}): used ${count} ${count === 1 ? 'time' : 'times'} this turn`
    lines.push(t)
    body +=
      `<g><title>${esc(t)}</title>` +
      `<use href="#${names[i]}" x="${x}" y="0" width="${SLOT}" height="${SLOT}"/>` +
      `${label} dx="1" dy="1" fill="#3f3f3f">${count}</text>${label} fill="#fff">${count}</text></g>`
  }
  if (dim) body = `<g opacity=".45">${body}</g>`
  const none = slots.length === 0
  const alt = none ? 'Hotbar: no tools used yet' : `Hotbar, tools used this turn: ${slots.map(([t, c]) => `${t} x${c}`).join(', ')}`
  return { source: wrap(SLOTS * SLOT, SLOT, symbols(names), body), w: SLOTS * SLOT, h: SLOT, lines: none ? ['Hotbar: no tools used yet'] : lines, alt }
}
