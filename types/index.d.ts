declare module 'claude-code' {
  interface PluginState {
    blockhud: {
      turns: number
      contextPercent: number | null
      contextTokens: number | null
      contextWindow: number | null
      fiveHourUsed: number | null
      sevenDayUsed: number | null
      hotbar: [tool: string, count: number][]
      pending: { id: string; tool: string }[] // in-flight tool calls; the last is the held slot
    }
  }
}
