# ゆきがっせん 作り直し 進み具合

- 2026-11-23 着手。元 mini-arcade/yukigassen.html（Canvas2D ドット絵）を _orig/ に取得。bakage・game-rules・ship・design・anti-ai-tells を読んだ
- 方針: three.js の雪原（斜め上・自陣の後ろから）＋生成イラストの切り絵キャラ（オリジナルの水色の恐竜。ヨッシー要素なし）。遊び（2v2・川・ためる・復活・壊せる壁・難易度・人数・マップ4種・コイン・色）は元のまま移植
- 絵の生成を開始（art/gen.sh: 正面・背面・ため/ダウン/バンザイ・木・小物・背景）
- 絵ができた（art/raw の7枚 → art/key.py で img/dino.webp・props.webp・bg.webp）。恐竜の色は js/tint.js で水色だけ回す
- 中身 js/sim.js（元の遊びを m 単位に移植）・人の速さの bot js/bot.js・tools/sim.mjs で勝率: 2v2 やさしい80% ふつう53% つよい28%（80試合）。元の版で起きていた「壁の裏に隠れると終わらない」を直した（AI が壁の端へ回る・2秒で壁を崩しにかかる）
- 3D: js/view.js（雪原・川の流れ・雪レンガの壁が当たるたびに崩れる・雪玉・雪しぶき・足跡・息・降る雪・タイトルは低いカメラで山と空）。dist/game.js を esbuild で1本に（590KB）
- 検査 verify.mjs 47項目 全通過（Chromium・WebKit・3サイズ・PC・Xの中）。tom3games/yukigassen に公開、Pages built、live.mjs で Chromium/WebKit とも結果まで通過・og.png 200・GitHub に個人名なし
- 読み込み: 10Mbps 0.8〜1.4秒、3Mbps+CPU4倍遅 2.7秒（準備完了まで 0.8MB）
- 横丁: 6か所に登録、組み立て OK（5987ファイル）、検査中
- iOS シミュレーターの Safari で影の地図が地面ごと暗くなった → スマホは影の地図を切り丸い影に（v2）
- 横丁 v1 デプロイ済み。v2 の組み立て・検査済み（ゆきがっせんの NG 0）、デプロイはメイン
