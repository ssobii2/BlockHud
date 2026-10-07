import type { Register, SessionUsage } from 'claude-code'

import { type Hud, hotbarSvg, statsSvg } from './hud.ts'

const SCALE = 0.8 // fraction of the art's natural size

// Session-only state; a reload re-runs register and starts fresh
let turns = 0
let contextPercent: number | undefined
let fiveHourUsed: number | undefined
let sevenDayUsed: number | undefined
const hotbar = new Map<string, number>()
const pending: { tool: string }[] = [] // tool calls whose result has not come back

function apply(usage: SessionUsage) {
  contextPercent = usage.context.percent
  fiveHourUsed = usage.rateLimits.find(l => l.kind === 'five_hour')?.percentUsed
  sevenDayUsed = usage.rateLimits.find(l => l.kind === 'seven_day')?.percentUsed
}

export const register: Register = on => {
  turns = 0
  hotbar.clear()
  pending.length = 0

  on('session.start', async ($, e, next) => {
    apply(await $.session.usage())
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.start', ($, e, next) => {
    hotbar.clear()
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) turns += 1 // a subagent's turn is not the session's
    apply(await $.session.usage())
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const call = { tool: e.tool }
    hotbar.set(e.tool, (hotbar.get(e.tool) ?? 0) + 1)
    pending.push(call)
    $.ui.invalidate('ui.render')
    try {
      return await next(e)
    } finally {
      const i = pending.indexOf(call)
      if (i >= 0) pending.splice(i, 1)
      $.ui.invalidate('ui.render')
    }
  }).catch(($, e, next) => next(e)) // a HUD failure must never block a tool

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const elements = $.ui.resolve(e)
    if (!('Svg' in elements)) return next(e)
    const { Box, Svg, Text } = elements

    // Svg drawn as an image has no <title> tooltip, so a keyed Box reveals a hover card beside it
    const card = (key: string, hud: Hud) => {
      const w = hud.w * SCALE
      return (
        <Box key={key}>
          <Svg source={hud.source} alt={hud.alt} width={w} height={hud.h * SCALE} />
          <Box position="absolute" top={0} left={Math.ceil(w / 8) + 2} display="none" hover={{ display: 'flex' }} flexDirection="column" borderStyle="round" paddingX={1}>
            {hud.lines.map(l => <Text key={l}>{l}</Text>)}
          </Box>
        </Box>
      )
    }

    const stats = statsSvg({ contextPercent, fiveHourUsed, sevenDayUsed, turns })
    // Idle: last turn's tools, dimmed, nothing held
    const working = e.props.isWorking
    const bar = hotbarSvg([...hotbar], working ? pending.at(-1)?.tool : undefined, !working)

    // columnGap is in character cells (Ink); BoxProps gives no unit, but its position props are cells (~8px each), so 5 = ~40px
    return (
      <Box flexDirection="row" alignItems="flex-end" columnGap={5}>
        {card('stats', stats)}
        {card('hotbar', bar)}
      </Box>
    )
  })
}
