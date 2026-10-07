import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { type Piece, hotbarSvg, statsSvg } from './hud.ts'

const SCALE = 0.8 // fraction of the art's natural size

const turns = atom({ plugin: 'blockhud', key: 'turns' } as const, 0)
const contextPercent = atom({ plugin: 'blockhud', key: 'contextPercent' } as const, null)
const contextTokens = atom({ plugin: 'blockhud', key: 'contextTokens' } as const, null)
const contextWindow = atom({ plugin: 'blockhud', key: 'contextWindow' } as const, null)
const fiveHourUsed = atom({ plugin: 'blockhud', key: 'fiveHourUsed' } as const, null)
const sevenDayUsed = atom({ plugin: 'blockhud', key: 'sevenDayUsed' } as const, null)
const hotbar = atom({ plugin: 'blockhud', key: 'hotbar' } as const, [])
const pending = atom({ plugin: 'blockhud', key: 'pending' } as const, [])

async function apply($: EngineInterface) {
  const usage = await $.session.usage()
  await update($, contextPercent, () => usage.context.percent ?? null)
  await update($, contextTokens, () => usage.context.tokens ?? null)
  await update($, contextWindow, () => usage.context.window ?? null)
  await update($, fiveHourUsed, () => usage.rateLimits.find(l => l.kind === 'five_hour')?.percentUsed ?? null)
  await update($, sevenDayUsed, () => usage.rateLimits.find(l => l.kind === 'seven_day')?.percentUsed ?? null)
}

// State lives in $.state, so a hot reload (register + session.start again) keeps it
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await apply($)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await update($, hotbar, () => [])
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await update($, turns, n => (n ?? 0) + 1) // a subagent's turn is not the session's
    await apply($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const id = e.tool_use_id ?? `${e.tool}:${Date.now()}:${Math.random()}`
    await update($, hotbar, (h): [string, number][] => {
      const rows = h ?? []
      return rows.some(([t]) => t === e.tool) ? rows.map(([t, n]) => [t, t === e.tool ? n + 1 : n]) : [...rows, [e.tool, 1]]
    })
    await update($, pending, p => [...(p ?? []), { id, tool: e.tool }])
    try {
      return await next(e)
    } finally {
      await update($, pending, p => (p ?? []).filter(c => c.id !== id))
    }
  }).catch(($, e, next) => next(e)) // a HUD failure must never block a tool

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const elements = $.ui.resolve(e)
    if (!('Svg' in elements)) return next(e)
    const { Box, Svg, Text } = elements

    // Svg drawn as an image has no <title> tooltip, so each piece's keyed Box reveals its own hover card above it
    const cell = (p: Piece) => (
      <Box key={p.key}>
        <Svg source={p.source} alt={p.alt} width={p.w * SCALE} height={p.h * SCALE} />
        {p.tip && (
          <Box position="absolute" top={-3} left={0} display="none" hover={{ display: 'flex' }} borderStyle="round" paddingX={1}>
            <Text>{p.tip}</Text>
          </Box>
        )}
      </Box>
    )

    const stats = statsSvg({
      contextPercent: (await read($, contextPercent)) ?? undefined,
      contextTokens: (await read($, contextTokens)) ?? undefined,
      contextWindow: (await read($, contextWindow)) ?? undefined,
      fiveHourUsed: (await read($, fiveHourUsed)) ?? undefined,
      sevenDayUsed: (await read($, sevenDayUsed)) ?? undefined,
      turns: (await read($, turns)) ?? 0,
    })
    // Idle: last turn's tools, dimmed, nothing held
    const working = e.props.isWorking
    const bar = hotbarSvg((await read($, hotbar)) ?? [], working ? (await read($, pending))?.at(-1)?.tool : undefined, !working)

    // columnGap is in character cells (Ink); BoxProps gives no unit, but its position props are cells (~8px each), so 5 = ~40px
    return (
      <Box flexDirection="row" alignItems="flex-end" columnGap={5}>
        <Box flexDirection="column">
          {stats.map(r => <Box key={r[0]!.key} flexDirection="row">{r.map(cell)}</Box>)}
        </Box>
        <Box flexDirection="row">{bar.map(cell)}</Box>
      </Box>
    )
  })
}
