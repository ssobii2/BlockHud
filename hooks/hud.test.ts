import { expect, test } from 'claude-code/testing'

import { barOf, halvesOf, heartState, hotbarSvg, itemOf, levelOf, statsSvg, tenthsOf } from './hud.ts'

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

test('hotbar keeps first-used order, caps at 9, marks the held tool', () => {
  const tools = Array.from({ length: 12 }, (_, i) => [`T${i}`, i + 1] as [string, number])
  const bar = hotbarSvg(tools, 'T1')
  expect(bar.alt.startsWith('Hotbar, tools used this turn: T0 x1, T1 x2')).toBe(true)
  expect(bar.alt.includes('T9')).toBe(false)
  expect((bar.source.match(/<use /g) ?? []).length).toBe(9)
  expect(bar.source.includes('id="slot-stone-held"')).toBe(true)
})

test('empty hotbar draws 9 empty slots; dim fades it', () => {
  const empty = hotbarSvg([])
  expect((empty.source.match(/<rect x="[\d.]+" y="0" width="52" height="52" fill="#8b8b8b"\/>/g) ?? []).length).toBe(9)
  expect(empty.lines).toEqual(['Hotbar: no tools used yet'])
  expect(empty.alt).toBe('Hotbar: no tools used yet')
  expect(hotbarSvg([['Bash', 1]], undefined, true).source.includes('opacity=".45"')).toBe(true)
  expect(hotbarSvg([['Bash', 1]]).source.includes('opacity=".45"')).toBe(false)
  expect(hotbarSvg([['Bash', 1]], undefined, true).source.includes('-held')).toBe(false)
})

test('missing data hides its row', () => {
  const full = statsSvg({ contextPercent: 25, fiveHourUsed: 40, sevenDayUsed: 38, turns: 0 }).source
  expect(full.includes('Armor:') && full.includes('Hearts:') && full.includes('Food:')).toBe(true)
  const none = statsSvg({ contextPercent: 25, turns: 0 }).source
  expect(none.includes('Food:') || none.includes('Armor:')).toBe(false)
  expect(none.includes('Hearts:')).toBe(true)
  expect(statsSvg({ turns: 3 }).source.includes('Hearts:')).toBe(false)
  expect(statsSvg({ turns: 3 }).source.includes('Level 0: 3 of 5')).toBe(true)
})

test('tooltips match the spec', () => {
  const s = statsSvg({ contextPercent: 25, fiveHourUsed: 60, sevenDayUsed: 38, turns: 13 }).source
  for (const t of ['Armor: weekly limit left 62%', 'Hearts: context left 75%', 'Food: 5-hour limit left 40%', 'Level 2: 3 of 5 turns to next level'])
    expect(s.includes(`<title>${t}</title>`)).toBe(true)
  expect(hotbarSvg([['Bash', 4]]).source.includes('<title>Bash (redstone): used 4 times this turn</title>')).toBe(true)
})

test('each Svg source stays under 131072 characters, worst case', () => {
  expect(statsSvg({ contextPercent: 50, fiveHourUsed: 50, sevenDayUsed: 50, turns: 99 }).source.length).toBeLessThan(131072)
  const worst = ['Grep', 'Read', 'Edit', 'Bash', 'WebFetch', 'Agent', 'Skill', 'TodoWrite', 'mcp__a__b'].map(t => [t, 99] as [string, number])
  expect(hotbarSvg(worst, 'WebFetch').source.length).toBeLessThan(131072)
})

test('Hud carries its natural pixel size', () => {
  const s = statsSvg({ contextPercent: 25, turns: 0 })
  expect(s.w > 0 && s.h > 0).toBe(true)
  expect(s.source.includes(`width="${s.w}" height="${s.h}"`)).toBe(true)
  expect(statsSvg({ contextPercent: 25, fiveHourUsed: 60, sevenDayUsed: 38, turns: 13 }).lines).toEqual([
    'Armor: weekly limit left 62%', 'Hearts: context left 75%', 'Food: 5-hour limit left 40%', 'Level 2: 3 of 5 turns to next level',
  ])
  expect(hotbarSvg([['Bash', 4], ['Read', 1]]).lines).toEqual(['Bash (redstone): used 4 times this turn', 'Read (book): used 1 time this turn'])
})
