import { expect, test } from 'claude-code/testing'

// Subagent loops raise their own turn.complete (with agentId); only the main loop's earns XP.
test('only main-loop turns count toward XP', async ($, on) => {
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1000 }, rateLimits: [] } }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  const done = { answer: '', durationMs: 1, isAborted: false, turnId: 't' } as never
  await $.turn.complete({ ...(done as object) } as never)
  await $.turn.complete({ ...(done as object), agentId: 'sub1' } as never)
  const ui = await $.ui.mount({
    plugin: 'blockhud',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, columns: 100 } as never,
  })
  const tree = JSON.stringify(await ui.drawn())
  expect(tree.match(/level \d+, \d of 5/)?.[0]).toBe('level 0, 1 of 5')
})

// Tool counts live in $.state (not module variables), so they survive a reload; two calls of one tool count 2.
test('hotbar counts come from $.state', async ($, on) => {
  on('tool.call', () => ({ result: {}, text: '' }) as never)
  const call = (id: string) => $.tool.call({ tool: 'Read', tool_use_id: id, file_path: '/x' } as never)
  await call('a')
  await call('b')
  const ui = await $.ui.mount({
    plugin: 'blockhud',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, columns: 100 } as never,
  })
  expect(JSON.stringify(await ui.drawn())).toContain("Read x2")
})

// Each hotbar slot and the hearts get their own hover card; hearts show tokens like Claude does.
test('one hover card per slot, hearts show tokens', async ($, on) => {
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1000000, tokens: 165432, percent: 16.5 }, rateLimits: [] } }) as never)
  on('tool.call', () => ({ result: {}, text: '' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't' } as never)
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x' } as never)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b', command: 'ls' } as never)
  const ui = await $.ui.mount({
    plugin: 'blockhud',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, columns: 100 } as never,
  })
  const tree = JSON.stringify(await ui.drawn())
  expect(tree).toContain('Read (book): used 1 time this turn')
  expect(tree).toContain('Bash (redstone): used 1 time this turn')
  expect(tree).toContain('Hearts: context used 165k/1M (17%)')
})
