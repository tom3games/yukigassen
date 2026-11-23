// 難しさごとの勝率を数える（ブラウザ不要）。node tools/sim.mjs [回数]
import { createSim, DIFF } from '../js/sim.js'
import { createBot } from '../js/bot.js'
import { mulberry } from '../js/sim.js'
const N = +process.argv[2] || 40
for (const kind of ['human', 'idle']) for (const team of [1, 2, 3]) {
  const row = []
  for (let d = 0; d < 3; d++) {
    let win = 0, rounds = 0, frames = 0
    for (let k = 0; k < N; k++) {
      const rng = mulberry(1000 + k * 7 + d * 131 + team * 17)
      const S = createSim({ team, diff: d, rng }); const bot = createBot(S, { rng: mulberry(9 + k), kind })
      S.start(team, d); let f = 0
      while (S.phase !== 'over' && f < 60 * 60 * 8) { bot(); S.step(); S.events.length = 0; f++ }
      if (S.winner === 0) win++; rounds += S.round; frames += f
    }
    row.push(`${DIFF[d].id} ${Math.round(win / N * 100)}% (${(frames / N / 60).toFixed(0)}秒・${(rounds / N).toFixed(1)}R)`)
  }
  console.log(kind.padEnd(5), `${team}v${team}`, row.join(' | '))
}
