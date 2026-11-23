// 公開物をまとめる。node tools/build.mjs で dist/game.js を作る（js/ を直したら毎回）
// esbuild はリポジトリに入れない。入っていなければ: mkdir -p ~/tools/esb && cd ~/tools/esb && npm i esbuild
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
const esbuild = createRequire(homedir() + '/tools/esb/x.js')('esbuild')
const ROOT = resolve(import.meta.dirname, '..')
const r = await esbuild.build({
  absWorkingDir: ROOT, entryPoints: ['js/game.js'], outfile: 'dist/game.js', bundle: true, format: 'esm', minify: true,
  target: ['es2020', 'safari15'], charset: 'utf8', legalComments: 'eof', logLevel: 'warning', metafile: true
})
const out = r.metafile.outputs['dist/game.js']
console.log('dist/game.js', (out.bytes / 1024).toFixed(0) + 'KB', Object.keys(r.metafile.inputs).length + 'files')
