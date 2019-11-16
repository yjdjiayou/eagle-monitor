/**
 * 前端捕获到错误信息，然后传给 node 层
 * 在 node 层反解产出代码对应的 sourcemap
 * 然后给前端返回反解后的错误信息（详细的（不是压缩处理后的）报错源码位置）
 */

const fs = require('fs');
const path = require('path');
let sourceMap = require('source-map');

// 这里只根据 main.bundle.js.map 的内容来提示
// 如果是其他的 js 资源或者 html 里面内联的 js 报错了，就无法给出对应的错误信息
let sourcemapFilePath = path.join(__dirname, '../../website/client/react-app/dist/main.bundle.js.map');

let sourcesPathMap = {};
function fixPath(filepath) {
  return filepath.replace(/\.[\.\/]+/g, "");
}

module.exports = async (ctx, next) => {
  if (ctx.path === '/sourcemap') {
    let sourceMapContent = fs.readFileSync(sourcemapFilePath, 'utf-8');
    let fileObj = JSON.parse(sourceMapContent);
    let sources = fileObj.sources;

    sources.map(item => {
      sourcesPathMap[fixPath(item)] = item;
    });

    // 这里只是测试用：用了 react-app.js 里面报错的位置信息
    // 正常情况下，需要写个文件上传，然后把 sourcemap 上传上去
    // 告诉服务端报错的是哪行哪列
    let findPos = {
      line: 551,
      column: 17,
    };

    let consumer = await new sourceMap.SourceMapConsumer(sourceMapContent);
    let result = consumer.originalPositionFor(findPos);

    // {source:xxx,line:xxx, column:xxx. name:xxx}
    console.log('result',result);

    let originSource = sourcesPathMap[result.source];

    let sourcesContent = fileObj.sourcesContent[sources.indexOf(originSource)];
    let sourcesContentArr = sourcesContent.split('\n');
    let sourcesContentMap = {};

    sourcesContentArr.forEach((item, index) => {
      sourcesContentMap[index] = item;
    });

    result.sourcesContentMap = sourcesContentMap;

    ctx.body = result;
  }

  return next();
};
