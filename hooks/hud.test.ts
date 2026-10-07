import { expect, test } from 'claude-code/testing'

import { barOf, fmtTokens, halvesOf, heartState, hotbarSvg, itemOf, levelOf, statsSvg, tenthsOf } from './hud.ts'

test('hearts, food and armor counts at 0, 5, 50, 95, 100 percent used', () => {
  const halves = [0, 5, 50, 95, 100].map(halvesOf)
  expect(halves).toEqual([20, 19, 10, 1, 0])
  const tenths = [0, 5, 50, 95, 100].map(tenthsOf)
  expect(tenths).toEqual([10, 10, 5, 1, 0])
  const states = (h: number) => Array.from({ length: 10 }, (_, i) => heartState(h, i))
  expect(states(15).filter(s => s === 'heart').length).toBe(7)
  expect(states(15)[7]).toBe('heart-half')
  expect(states(0).every(s => s === 'heart-empty')).toBe(true)
  expect(states(20).every(s => s === 'heart')).toBe(true)
})

test('level and bar math', () => {
  expect([0, 4, 5, 13].map(levelOf)).toEqual([0, 0, 1, 2])
  expect([0, 4, 5, 13].map(barOf)).toEqual([0, 0.8, 0, 0.6])
})

test('tool to item', () => {
  const items = ['Grep', 'Glob', 'Read', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebSearch', 'WebFetch', 'Agent', 'Task', 'Skill', 'TodoWrite', 'mcp__x__y', 'Other'].map(itemOf)
  expect(items).toEqual(['pickaxe', 'pickaxe', 'book', 'bricks', 'bricks', 'bricks', 'redstone', 'compass', 'compass', 'emerald', 'emerald', 'enchanted', 'paper', 'chest', 'stone'])
})

const src = (rows: { source: string }[][]) => rows.flat().map(p => p.source).join('')
const near = (a: number, b: number) => expect(Math.abs(a - b) < 1e-6).toBe(true)
const tips = (rows: { tip?: string }[][]) => rows.flat().map(p => p.tip)

test('hotbar keeps first-used order, caps at 9, marks the held tool', () => {
  const tools = Array.from({ length: 12 }, (_, i) => [`T${i}`, i + 1] as [string, number])
  const bar = hotbarSvg(tools, 'T1')
  expect(bar.length).toBe(9)
  expect(bar[0]!.tip).toBe('T0 (stone): used 1 time this turn')
  expect(bar[1]!.tip).toBe('T1 (stone): used 2 times this turn')
  expect(bar.some(p => p.tip?.includes('T9'))).toBe(false)
  expect(bar.map(p => p.source).join('').includes('id="slot-stone-held"')).toBe(true)
  expect(bar[1]!.source.includes('id="slot-stone-held"')).toBe(true)
  expect(bar[0]!.source.includes('-held')).toBe(false)
})

test('empty hotbar draws 9 empty slots with a tip; dim fades each slot', () => {
  const empty = hotbarSvg([])
  expect(empty.length).toBe(9)
  expect(empty.every(p => p.tip === 'Hotbar: no tools used yet' && p.alt === 'Hotbar: no tools used yet' && p.w === 52 && p.h === 52)).toBe(true)
  expect(empty.every(p => p.source.includes('fill="#8b8b8b"'))).toBe(true)
  const some = hotbarSvg([['Bash', 1]])
  expect(some[1]!.tip).toBeUndefined()
  expect(some[1]!.alt.length > 0).toBe(true)
  expect(hotbarSvg([['Bash', 1]], undefined, true).every(p => p.source.includes('opacity=".45"'))).toBe(true)
  expect(some.some(p => p.source.includes('opacity=".45"'))).toBe(false)
  expect(hotbarSvg([['Bash', 1]], undefined, true)[0]!.source.includes('-held')).toBe(false)
})

test('missing data hides its row', () => {
  const full = statsSvg({ contextPercent: 25, fiveHourUsed: 40, sevenDayUsed: 38, turns: 0 })
  expect(full.map(r => r.map(p => p.key))).toEqual([['armor'], ['hearts', 'food'], ['xp']])
  expect(statsSvg({ contextPercent: 25, turns: 0 }).map(r => r.map(p => p.key))).toEqual([['hearts'], ['xp']])
  expect(statsSvg({ fiveHourUsed: 40, turns: 0 }).map(r => r.map(p => p.key))).toEqual([['food'], ['xp']])
  expect(statsSvg({ turns: 3 }).map(r => r.map(p => p.key))).toEqual([['xp']])
  expect(tips(statsSvg({ turns: 3 }))).toEqual(['Level 0: 3 of 5 turns to next level'])
})

test('token formatter', () => {
  expect([165432, 1000000, 1500000, 200000, 999].map(fmtTokens)).toEqual(['165k', '1M', '1.5M', '200k', '999'])
})

test('tooltips match the spec; every stats piece has a tip and alt', () => {
  const rows = statsSvg({ contextPercent: 25, fiveHourUsed: 60, sevenDayUsed: 38, turns: 13 })
  expect(tips(rows)).toEqual(['Armor: weekly limit left 62%', 'Hearts: context left 75%', 'Food: 5-hour limit left 40%', 'Level 2: 3 of 5 turns to next level'])
  expect(rows.flat().every(p => p.tip && p.alt)).toBe(true)
  expect(src(rows).includes('<title>Armor: weekly limit left 62%</title>')).toBe(true)
  expect(hotbarSvg([['Bash', 4]])[0]!.source.includes('<title>Bash (redstone): used 4 times this turn</title>')).toBe(true)
})

test('hearts tip shows tokens when known, else percent left', () => {
  const withTokens = statsSvg({ contextPercent: 16.5, contextTokens: 165432, contextWindow: 1000000, turns: 0 })
  expect(tips(withTokens)[0]).toBe('Hearts: context used 165k/1M (17%)')
  expect(statsSvg({ contextPercent: 62, turns: 0 }).flat()[0]!.tip).toBe('Hearts: context left 38%')
})

test('stacked piece heights equal the old single image', () => {
  const rows = statsSvg({ contextPercent: 25, fiveHourUsed: 60, sevenDayUsed: 38, turns: 13 })
  const ICON = 9 * 2.4, bar = 5 * 2.2
  const total = rows.map(r => Math.max(...r.map(p => p.h))).reduce((a, b) => a + b, 0)
  near(total, ICON + 3 + ICON + 6 + 17 + bar)
  expect(rows[1]!.reduce((a, p) => a + p.w, 0)).toBe(rows[0]![0]!.w)
  expect(rows[2]![0]!.w).toBe(rows[0]![0]!.w)
  // armor alone is followed by 6, matching the old y += 3 twice
  near(statsSvg({ sevenDayUsed: 10, turns: 0 })[0]![0]!.h, ICON + 6)
})

test('each Svg source stays under 131072 characters, worst case', () => {
  for (const p of statsSvg({ contextPercent: 50, fiveHourUsed: 50, sevenDayUsed: 50, turns: 99 }).flat()) expect(p.source.length).toBeLessThan(131072)
  const worst = ['Grep', 'Read', 'Edit', 'Bash', 'WebFetch', 'Agent', 'Skill', 'TodoWrite', 'mcp__a__b'].map(t => [t, 99] as [string, number])
  for (const p of hotbarSvg(worst, 'WebFetch')) expect(p.source.length).toBeLessThan(131072)
})

test('each piece carries its natural pixel size', () => {
  for (const p of statsSvg({ contextPercent: 25, turns: 0 }).flat()) expect(p.source.includes(`width="${p.w}" height="${p.h}"`)).toBe(true)
})
