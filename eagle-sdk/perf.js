// https://developer.mozilla.org/zh-CN/docs/Web/API/PerformanceTiming

let perf = {
  init: (cb) => {
    let cycleFreq = 100; // 循环轮询的时间
    let isDOMReady = false;
    let isOnload = false;
    let performance = window.performance || window.mozPerformance || window.msPerformance || window.webkitPerformance;

    let Util = {
      addEventListener: function (name, callback, useCapture) {
        if (window.addEventListener) {
          return window.addEventListener(name, callback, useCapture);
        } else if (window.attachEvent) {
          return window.attachEvent('on' + name, callback);
        }
      },

      domready: function (callback) {
        if ( isOnload === true ) { return void 0; }
        let timer = null;

        // interactive:DOM 树解析完成，但是仍在加载子资源，例如图像，样式表和框架
        if ( document.readyState === 'interactive' ) {
          runCheck();
        } else if (document.addEventListener) {
          // perfData.domReady = timing.domContentLoadedEventStart - timing.navigationStart
          // performance.timing.domContentLoadedEventStart：发生 DOMContentLoaded 事件的时间，即开始加载网页内资源的时间
          // performance.timing.domContentLoadedEventEnd：DOMContentLoaded 事件已经发生且执行完所有事件处理程序的时间，网页内资源加载完成的时间
          // 因为 DOMContentLoaded 是在两个时间中间执行的，无法获取 performance.timing.domContentLoadedEventEnd
          // 所以只能用 timing.domContentLoadedEventStart 去减 timing.navigationStart
          document.addEventListener('DOMContentLoaded', function () {
            runCheck();
          }, false);

        } else if (document.attachEvent) {
          document.attachEvent('onreadystatechange', function () {
            runCheck();
          });
        }

        function runCheck() {
          // 因为 domInteractive 刚开始的值是 0，需要等到有值时才能去上报，否则时间会是负数
          // 所以这里需要循环检测
          if ( performance.timing.domInteractive ) {
            clearTimeout(timer);
            callback();
            isDOMReady = true;
          } else {
            timer = setTimeout(runCheck, cycleFreq);
          }
        }
      },

      onload: function (callback) {
        let timer = null;

        if (document.readyState === 'complete') {
          runCheck();
        } else {
          Util.addEventListener('load', function () {
            runCheck();
          }, false);
        }

        function runCheck() {
          if ( performance.timing.loadEventEnd ) {
            clearTimeout(timer);
            callback();
            isOnload = true;
          } else {
            timer = setTimeout(runCheck, cycleFreq);
          }
        }
      }
    };

    let reportPerf = function () {
      if (!performance) {
        return void 0;
      }

      // 过滤无效数据；
      function filterTime(a, b) {
        return (a > 0 && b > 0 && (a - b) >= 0) ? (a - b) : undefined;
      }

      // append data from window.performance
      let timing = performance.timing;

      let perfData = {
        // 网络建连
        pervPage: filterTime(timing.fetchStart, timing.navigationStart), // 上一个页面
        redirect: filterTime(timing.responseEnd, timing.redirectStart), // 页面重定向时间
        dns: filterTime(timing.domainLookupEnd, timing.domainLookupStart), // DNS查找时间
        connect: filterTime(timing.connectEnd, timing.connectStart), // TCP建连时间
        network: filterTime(timing.connectEnd, timing.navigationStart), // 网络总耗时

        // 网络接收
        send: filterTime(timing.responseStart, timing.requestStart), // 前端从发送到接收到后端第一个返回
        receive: filterTime(timing.responseEnd, timing.responseStart), // 接受页面时间
        request: filterTime(timing.responseEnd, timing.requestStart), // 请求页面总时间

        // 前端渲染
        dom: filterTime(timing.domComplete, timing.domLoading), // dom解析时间
        loadEvent: filterTime(timing.loadEventEnd, timing.loadEventStart), // loadEvent时间
        frontend: filterTime(timing.loadEventEnd, timing.domLoading), // 前端总时间

        // 关键阶段
        load: filterTime(timing.loadEventEnd, timing.navigationStart), // 页面完全加载总时间
        domReady: filterTime(timing.domContentLoadedEventStart, timing.navigationStart), // domready时间
        interactive: filterTime(timing.domInteractive, timing.navigationStart), // 可操作时间
        ttfb: filterTime(timing.responseStart, timing.navigationStart),  // 首字节时间
      };

      return perfData;
    };

    Util.domready(function () {
      let perfData = reportPerf('domready');
      perfData.type = 'domready';
      cb(perfData);
    });

    Util.onload(function () {
      let perfData = reportPerf('onload');
      perfData.type = 'onload';
      cb(perfData);
    });
  }
};

export default perf;
