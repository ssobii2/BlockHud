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
