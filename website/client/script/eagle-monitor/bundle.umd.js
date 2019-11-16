(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(factory());
}(this, (function () { 'use strict';

// https://developer.mozilla.org/zh-CN/docs/Web/API/PerformanceTiming
/**
 * 性能监控
 */

var perf = {
  init: function init(cb) {
    var cycleFreq = 100; // 循环轮询的时间
    var isOnload = false;
    var performance = window.performance || window.mozPerformance || window.msPerformance || window.webkitPerformance;

    var Util = {
      addEventListener: function addEventListener(name, callback, useCapture) {
        if (window.addEventListener) {
          return window.addEventListener(name, callback, useCapture);
        } else if (window.attachEvent) {
          return window.attachEvent('on' + name, callback);
        }
      },

      domready: function domready(callback) {
        if (isOnload === true) {
          return void 0;
        }
        var timer = null;

        // interactive:DOM 树解析完成，但是仍在加载子资源，例如图像，样式表和框架
        if (document.readyState === 'interactive') {
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
          if (performance.timing.domInteractive) {
            clearTimeout(timer);
            callback();
            
          } else {
            timer = setTimeout(runCheck, cycleFreq);
          }
        }
      },

      onload: function onload(callback) {
        var timer = null;

        if (document.readyState === 'complete') {
          runCheck();
        } else {
          Util.addEventListener('load', function () {
            runCheck();
          }, false);
        }

        function runCheck() {
          if (performance.timing.loadEventEnd) {
            clearTimeout(timer);
            callback();
            isOnload = true;
          } else {
            timer = setTimeout(runCheck, cycleFreq);
          }
        }
      }
    };

    var reportPerf = function reportPerf() {
      if (!performance) {
        return void 0;
      }

      // 过滤无效数据；
      function filterTime(a, b) {
        return a > 0 && b > 0 && a - b >= 0 ? a - b : undefined;
      }

      // append data from window.performance
      var timing = performance.timing;

      var perfData = {
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
        ttfb: filterTime(timing.responseStart, timing.navigationStart) // 首字节时间
      };

      return perfData;
    };

    Util.domready(function () {
      var perfData = reportPerf('domready');
      perfData.type = 'domready';
      cb(perfData);
    });

    Util.onload(function () {
      var perfData = reportPerf('onload');
      perfData.type = 'onload';
      cb(perfData);
    });
  }
};

var onload = function onload(cb) {
  if (document.readyState === 'complete') {
    cb();
  }
  window.addEventListener('load', cb);
};

/**
 * 静态资源监控
 */

function filterTime(a, b) {
  return a > 0 && b > 0 && a - b >= 0 ? a - b : undefined;
}

var resolvePerformanceTiming = function resolvePerformanceTiming(timing) {
  var o = {
    initiatorType: timing.initiatorType,
    name: timing.name,
    duration: parseInt(timing.duration),
    redirect: filterTime(timing.redirectEnd, timing.redirectStart), // 重定向
    dns: filterTime(timing.domainLookupEnd, timing.domainLookupStart), // DNS解析
    connect: filterTime(timing.connectEnd, timing.connectStart), // TCP建连
    network: filterTime(timing.connectEnd, timing.startTime), // 网络总耗时

    send: filterTime(timing.responseStart, timing.requestStart), // 发送开始到接受第一个返回
    receive: filterTime(timing.responseEnd, timing.responseStart), // 接收总时间
    request: filterTime(timing.responseEnd, timing.requestStart), // 总时间

    ttfb: filterTime(timing.responseStart, timing.requestStart) // 首字节时间
  };

  return o;
};

var resolveEntries = function resolveEntries(entries) {
  return entries.map(function (item) {
    return resolvePerformanceTiming(item);
  });
};

var resources = {
  init: function init(cb) {
    var performance = window.performance || window.mozPerformance || window.msPerformance || window.webkitPerformance;
    if (!performance || !performance.getEntries) {
      return void 0;
    }

    if (window.PerformanceObserver) {
      var observer = new window.PerformanceObserver(function (list) {
        try {
          var entries = list.getEntries();
          cb(resolveEntries(entries));
        } catch (e) {
          console.error(e);
        }
      });
      observer.observe({
        entryTypes: ['resource']
      });
    } else {
      onload(function () {
        var entries = performance.getEntriesByType('resource');
        cb(resolveEntries(entries));
      });
    }
  }
};

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

/**
 * 错误上报
 */

var formatError = function formatError(errObj) {
  var col = errObj.column || errObj.columnNumber; // Safari Firefox
  var row = errObj.line || errObj.lineNumber; // Safari Firefox
  var message = errObj.message;
  var name = errObj.name;

  var stack = errObj.stack;
  // stack 里面的错误信息是最准确的

  if (stack) {
    // urlFirstStack 里面有报错的 url 和位置（行列）
    var matchUrl = stack.match(/https?:\/\/[^\n]+/);
    var urlFirstStack = matchUrl ? matchUrl[0] : '';
    var regUrlCheck = /https?:\/\/(\S)*\.js/;

    // 获取真正的 URL
    var resourceUrl = '';
    if (regUrlCheck.test(urlFirstStack)) {
      resourceUrl = urlFirstStack.match(regUrlCheck)[0];
    }

    // 获取真正的行列信息
    var stackRow = null; // 行
    var stackCol = null; // 列
    var posStack = urlFirstStack.match(/:(\d+):(\d+)/);
    if (posStack && posStack.length >= 3) {
      var _posStack = _slicedToArray(posStack, 3);

      stackRow = _posStack[1];
      stackCol = _posStack[2];
    }

    // TODO formatStack
    return {
      content: stack,
      col: Number(col || stackCol),
      row: Number(row || stackRow),
      message: message, name: name, resourceUrl: resourceUrl
    };
  }

  return {
    row: row, col: col, message: message, name: name
  };
};

var errorCatch = {
  init: function init(cb) {
    var _originOnerror = window.onerror;
    window.onerror = function () {
      for (var _len = arguments.length, arg = Array(_len), _key = 0; _key < _len; _key++) {
        arg[_key] = arguments[_key];
      }

      var errorMessage = arg[0],
          scriptURI = arg[1],
          lineNumber = arg[2],
          columnNumber = arg[3],
          errorObj = arg[4];
      // console.log('window 里原始的错误=>',arg);

      var errorInfo = formatError(errorObj);
      // console.log(JSON.parse(JSON.stringify(errorInfo)));
      errorInfo._errorMessage = errorMessage;
      errorInfo._scriptURI = scriptURI;
      errorInfo._lineNumber = lineNumber;
      errorInfo._columnNumber = columnNumber;
      errorInfo.type = 'onerror';
      // console.log(JSON.parse(JSON.stringify(errorInfo)));
      cb(errorInfo);
      _originOnerror && _originOnerror.apply(window, arg);
    };

    var _originOnunhandledrejection = window.onunhandledrejection;
    window.onunhandledrejection = function () {
      for (var _len2 = arguments.length, arg = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        arg[_key2] = arguments[_key2];
      }

      var e = arg[0];
      var reason = e.reason;
      cb({
        type: e.type || 'unhandledrejection',
        reason: reason
      });
      _originOnunhandledrejection && _originOnunhandledrejection.apply(window, arg);
    };
  }
};

/**
 * ajax 请求监控
 */

var xhrHook = {
  //TODO 自身 SDK 的请求无需拦截
  init: function init(cb) {
    // xhr hook
    var xhr = window.XMLHttpRequest;
    // 避免用户使用其他的性能监控脚本，只允许使用我们写的脚本，否则会多次监控，没有什么意义
    if (xhr._eagle_flag === true) {
      return void 0;
    }
    xhr._eagle_flag = true;

    var _originOpen = xhr.prototype.open;
    xhr.prototype.open = function (method, url, async, user, password) {
      // TODO eagle url check
      this._eagle_xhr_info = {
        url: url,
        method: method,
        status: null
      };
      return _originOpen.apply(this, arguments);
    };

    var _originSend = xhr.prototype.send;
    xhr.prototype.send = function (value) {
      var _this2 = this;

      var _self = this;
      this._eagle_start_time = Date.now();

      var ajaxEnd = function ajaxEnd(event) {
        return function () {
          if (_self.response) {
            var responseSize = null;
            switch (_self.responseType) {
              case 'json':
                responseSize = JSON && JSON.stringify(_this.response).length;
                break;
              case 'blob':
              case 'moz-blob':
                responseSize = _self.response.size;
                break;
              case 'arraybuffer':
                responseSize = _self.response.byteLength;
              case 'document':
                responseSize = _self.response.documentElement && _self.response.documentElement.innerHTML && _self.response.documentElement.innerHTML.length + 28;
                break;
              default:
                responseSize = _self.response.length;
            }
            _self._eagle_xhr_info.event = event;
            _self._eagle_xhr_info.status = _self.status;
            _self._eagle_xhr_info.success = _self.status >= 200 && _self.status <= 206 || _self.status === 304;
            _self._eagle_xhr_info.duration = Date.now() - _self._eagle_start_time;
            _self._eagle_xhr_info.responseSize = responseSize;
            _self._eagle_xhr_info.requestSize = value ? value.length : 0;
            _self._eagle_xhr_info.type = 'xhr';
            cb(_this2._eagle_xhr_info);
          }
        };
      };

      // TODO eagle url check
      if (this.addEventListener) {
        this.addEventListener('load', ajaxEnd('load'), false);
        this.addEventListener('error', ajaxEnd('error'), false);
        this.addEventListener('abort', ajaxEnd('abort'), false);
      } else {
        var _origin_onreadystatechange = this.onreadystatechange;
        this.onreadystatechange = function (event) {
          if (_origin_onreadystatechange) {
            _originOpen.apply(this, arguments);
          }
          if (this.readyState === 4) {
            ajaxEnd('end')();
          }
        };
      }
      return _originSend.apply(this, arguments);
    };

    // fetch hook
    if (window.fetch) {
      var _origin_fetch = window.fetch;
      window.fetch = function () {
        var startTime = Date.now();
        var args = [].slice.call(arguments);

        var fetchInput = args[0];
        var method = 'GET';
        var url = void 0;

        if (typeof fetchInput === 'string') {
          url = fetchInput;
        } else if ('Request' in window && fetchInput instanceof window.Request) {
          url = fetchInput.url;
          if (fetchInput.method) {
            method = fetchInput.method;
          }
        } else {
          url = '' + fetchInput;
        }

        if (args[1] && args[1].method) {
          method = args[1].method;
        }

        // TODO eagle check
        var fetchData = {
          method: method,
          url: url,
          status: null
        };

        return _origin_fetch.apply(this, args).then(function (response) {
          fetchData.status = response.status;
          fetchData.type = 'fetch';
          fetchData.duration = Date.now() - startTime;
          cb(fetchData);
          return response;
        });
      };
    }
  }
};

/**
 * 浏览器检查 html 元素时，右键 => Copy => Copy XPath
 */
// /html/body/div[2]/ul/li[2]

var getXpath = function getXpath(element) {
  if (!(element instanceof Element)) {
    return void 0;
  }

  if (element.nodeType !== 1) {
    return void 0;
  }

  var rootElement = document.body;
  if (element === rootElement) {
    return void 0;
  }

  var childIndex = function childIndex(ele) {
    var parent = ele.parentNode;
    var children = [].slice.call(parent.childNodes).filter(function (_) {
      return _.nodeType === 1;
    });
    var i = 0;
    for (var _i = 0, len = children.length; _i < len; _i++) {
      if (children[_i] === ele) {
        i = _i;
        break;
      }
    }
    return i === 0 ? '' : '[' + i + ']';
  };

  var xpath = '';

  while (element !== document) {
    var tag = element.tagName.toLocaleLowerCase();
    var eleIndex = childIndex(element);
    xpath = '/' + tag + eleIndex + xpath;
    element = element.parentNode;
  }

  return xpath;
};

/**
 * 用户行为检测
 */

var behavior = {
  init: function init(cb) {
    cb();
    document.addEventListener('click', function (e) {
      var xpath = getXpath(e.target);
      console.log('xpath: ', xpath);
    }, false);
  }
};

perf.init(function (perfData) {
  // console.log('perf', perfData);
});

resources.init(function (list) {
  // console.log('resources', list.length === 1 ? list[0] : list);
});

errorCatch.init(function (err) {
  console.log('errorCatch', err);
});

xhrHook.init(function (xhrInfo) {
  console.log(xhrInfo);
});

behavior.init(function () {
  console.log('behavior init');
});

})));
//# sourceMappingURL=bundle.umd.js.map
