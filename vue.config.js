const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  productionSourceMap: false,
  publicPath: './',
  outputDir: 'dist',
  assetsDir: 'assets',
  devServer: {
    port: 8080,
    host: '127.0.0.1',
    https: false,
    open: true
  },
})
