/**
 * 错误上报
 */

let formatError = (errObj) => {
  let col = errObj.column || errObj.columnNumber; // Safari Firefox
  let row = errObj.line || errObj.lineNumber; // Safari Firefox
  let message = errObj.message;
  let name = errObj.name;

  let {stack} = errObj;
  // stack 里面的错误信息是最准确的
  if (stack) {
    // urlFirstStack 里面有报错的 url 和位置（行列）
    let matchUrl = stack.match(/https?:\/\/[^\n]+/);
    let urlFirstStack = matchUrl ? matchUrl[0] : '';
    let regUrlCheck = /https?:\/\/(\S)*\.js/;

    // 获取真正的 URL
    let resourceUrl = '';
    if (regUrlCheck.test(urlFirstStack)) {
      resourceUrl = urlFirstStack.match(regUrlCheck)[0];
    }

    // 获取真正的行列信息
    let stackRow = null;// 行
    let stackCol = null;// 列
    let posStack = urlFirstStack.match(/:(\d+):(\d+)/);
    if (posStack && posStack.length >= 3) {
      [, stackRow, stackCol] = posStack;
    }

    // TODO formatStack
    return {
      content: stack,
      col: Number(col || stackCol),
      row: Number(row || stackRow),
      message, name, resourceUrl
    };
  }

  return {
    row, col, message, name
  }
};

let errorCatch = {
  init: (cb) => {
    let _originOnerror = window.onerror;
    window.onerror = (...arg) => {
      let [errorMessage, scriptURI, lineNumber, columnNumber, errorObj] = arg;
      // console.log('window 里原始的错误=>',arg);
      let errorInfo = formatError(errorObj);
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

    let _originOnunhandledrejection = window.onunhandledrejection;
    window.onunhandledrejection = (...arg) => {
      let e = arg[0];
      let reason = e.reason;
      cb({
        type: e.type || 'unhandledrejection',
        reason
      });
      _originOnunhandledrejection && _originOnunhandledrejection.apply(window, arg);
    };
  },
};

export default errorCatch;
