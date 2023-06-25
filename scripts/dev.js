const { context } = require('esbuild')
const { resolve } = require('path')

const target = 'reactivity'

async function run() {
  const ctx = await context({
    entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)],
    outfile: resolve(__dirname, `../packages/${target}/dist/${target}.js`),
    bundle: true, // 将依赖的模块全部打包
    sourcemap: true,
    format: 'esm',
    platform: 'browser',
  })

  await ctx.watch()

  console.log('watching~~')
}

run()
