// 文言（日英）と、恐竜の色。色は絵の水色（色相 195°）を回して作る（js/tint.js）
export const SKINS = [
  { id: 'aqua', hue: 195, s: 1, v: 1, cost: 0 },
  { id: 'yuzu', hue: 46, s: 0.95, v: 1.06, cost: 120 },
  { id: 'coral', hue: 14, s: 0.82, v: 1.03, cost: 160 },
  { id: 'mint', hue: 162, s: 0.78, v: 1.03, cost: 180 },
  { id: 'sakura', hue: 334, s: 0.62, v: 1.04, cost: 200 },
  { id: 'grape', hue: 262, s: 0.55, v: 0.98, cost: 240 },
  { id: 'yuki', hue: 205, s: 0.14, v: 1.12, cost: 300 }
]
// 相手チームの色。自分が暖かい色の時は水色にして見分けをつける
export const ENEMY = { hue: 350, s: 0.78, v: 1.0 }
export const ENEMY_ALT = { hue: 200, s: 1, v: 0.95 }
export const WARM = ['yuzu', 'coral', 'sakura']

export const T = {
  ja: {
    title: 'ゆきがっせん', sub: 'SNOW FRIENDS', loading: 'ゆきだま にぎり中',
    skin: { aqua: 'アクア', yuzu: 'ゆず', coral: 'コーラル', mint: 'ミント', sakura: 'さくら', grape: 'ぶどう', yuki: 'ゆき' },
    diffL: 'つよさ', diff: ['やさしい', 'ふつう', 'つよい'], teamL: 'にんずう', team: n => `${n}たい${n}`,
    play: 'あそぶ', howto: 'あそびかた', lang: 'English', use: 'つかう', using: 'つかってる', buy: n => `${n}で もらう`, need: n => `あと ${n}`,
    howTitle: 'あそびかた', close: 'とじる',
    howTouch: [
      ['move', '左がわを なぞって うごく'],
      ['aim', '右がわを 投げたい方へ なぞって はなす。ちょんと押すと 近い相手へ'],
      ['pack', '雪玉が切れたら ためる。もう一度押すか うごくと やめる'],
      ['revive', '2回当たると たおれる。なかまの上に しばらく立つと 起きる'],
      ['win', '相手を全員たおすと 1本。先に3本で かち']
    ],
    howPC: [
      ['move', 'WASD か 矢印キーで うごく'],
      ['aim', '投げたい所を クリック'],
      ['pack', 'スペースで ためる（もう一度で やめる）'],
      ['revive', '2回当たると たおれる。なかまの上に しばらく立つと 起きる'],
      ['win', '相手を全員たおすと 1本。先に3本で かち']
    ],
    credit: '効果音の一部: Gravity Sound（CC BY 4.0）',
    round: n => `ラウンド ${n}`, go: 'スタート!', roundWin: 'とった!', roundLose: 'とられた…',
    downMe: 'なかまが 起こしに来るよ', downSolo: 'やられた…',
    tutMove: 'ここで うごく', tutAim: 'なぞって はなす', tutPack: '玉が切れたら',
    win: 'かち!', lose: 'まけ…', coins: n => `+${n}`, again: 'もう一回', toTitle: 'タイトル', post: 'Xでポスト', save: '画像を保存',
    postText: (w, a, b) => `ゆきがっせんで ${a}-${b} で${w ? '勝った' : '負けた'}! #ゆきがっせん #ひまつぶし横丁`,
    newSkin: 'あたらしい色が もらえる', quit: 'やめる'
  },
  en: {
    title: 'ゆきがっせん', sub: 'SNOW FRIENDS', loading: 'Packing snow',
    skin: { aqua: 'Aqua', yuzu: 'Yuzu', coral: 'Coral', mint: 'Mint', sakura: 'Sakura', grape: 'Grape', yuki: 'Snow' },
    diffL: 'CPU', diff: ['Easy', 'Normal', 'Hard'], teamL: 'Teams', team: n => `${n} v ${n}`,
    play: 'PLAY', howto: 'How to play', lang: '日本語', use: 'Use', using: 'Using', buy: n => `Get for ${n}`, need: n => `${n} more`,
    howTitle: 'How to play', close: 'Close',
    howTouch: [
      ['move', 'Drag on the left half to move'],
      ['aim', 'Swipe the right half toward your target and let go. A quick tap aims at the nearest rival'],
      ['pack', 'Out of snowballs? Tap Pack. Tap again or move to stop'],
      ['revive', 'Two hits and you are down. Stand on a teammate to revive them'],
      ['win', 'Knock out the whole rival team to take a round. First to 3 wins']
    ],
    howPC: [
      ['move', 'Move with WASD or the arrow keys'],
      ['aim', 'Click where you want to throw'],
      ['pack', 'Space to pack snowballs (again to stop)'],
      ['revive', 'Two hits and you are down. Stand on a teammate to revive them'],
      ['win', 'Knock out the whole rival team to take a round. First to 3 wins']
    ],
    credit: 'Some sounds: Gravity Sound (CC BY 4.0)',
    round: n => `Round ${n}`, go: 'GO!', roundWin: 'Round won!', roundLose: 'Round lost',
    downMe: 'A teammate can revive you', downSolo: 'You are down',
    tutMove: 'Move here', tutAim: 'Swipe and let go', tutPack: 'Out of snow?',
    win: 'YOU WIN!', lose: 'YOU LOSE', coins: n => `+${n}`, again: 'Play again', toTitle: 'Title', post: 'Post on X', save: 'Save image',
    postText: (w, a, b) => `I ${w ? 'won' : 'lost'} ${a}-${b} in SNOW FRIENDS! #snowballfight #tom3games`,
    newSkin: 'You can unlock a new color', quit: 'Quit'
  }
}
