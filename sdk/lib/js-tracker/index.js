'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true,
})

const _util = require('./util')

const monitor = {}

monitor.init = function (opts) {
  __config(opts)
  __init()
}

const errorList = [] // 错误处理回调

let report = function report() {}

const config = {
  concat: true,
  delay: 2000, // 错误处理间隔时间
  maxError: 16, // 异常错误数量限制
  sampling: 1, // 采样率
}

// 定义的错误类型码
const ERROR_RUNTIME = 1
const ERROR_SCRIPT = 2
const ERROR_STYLE = 3
const ERROR_IMAGE = 4
const ERROR_AUDIO = 5
const ERROR_VIDEO = 6
const ERROR_CONSOLE = 7
const ERROR_TRY_CATCH = 8

const LOAD_ERROR_TYPE = {
  SCRIPT: ERROR_SCRIPT,
  LINK: ERROR_STYLE,
  IMG: ERROR_IMAGE,
  AUDIO: ERROR_AUDIO,
  VIDEO: ERROR_VIDEO,
}

function __config(opts) {
  ;(0, _util.merge)(opts, config)
  report = (0, _util.debounce)(config.report, config.delay, function () {
    errorList = []
  })
}

function __init() {
  // 全局错误error捕获处理
  // 监听资源加载错误(JavaScript Source failed to load)
  // error 只是全局错误，使用 addEventListener 绑定而不使用“=” 是因为部分用户会使用 = 来重写error，这样 SDK本身都得不到任何错误了。
  window.addEventListener(
    'error',
    function (event) {
      // 过滤 target 为 window 的异常，避免与上面的 onerror 重复
      let errorTarget = event.target
      let errorName = errorTarget.nodeName.toUpperCase()
      if (
        errorTarget !== window &&
        errorTarget.nodeName &&
        LOAD_ERROR_TYPE[errorName]
      ) {
        handleError(formatLoadError(errorTarget))
      } else {
        // onerror会被覆盖，转为使用Listener进行监控
        let { message, filename, lineno, colno, error } = event
        handleError(
          formatRuntimerError(message, filename, lineno, colno, error)
        )
      }
    },
    true
  )

  // 监听浏览器中捕获到未处理的Promise错误，以及部分框架把错误吞掉的问题
  window.addEventListener(
    'unhandledrejection',
    function (event) {
      handleError(event)
    },
    true
  )

  // 针对Vue报错重写console.error
  // TODO
  console.error = (function (origin) {
    return function (info) {
      let errorLog = {
        type: ERROR_CONSOLE,
        desc: info,
      }
      handleError(errorLog)
      origin.call(console, info)
    }
  })(console.error)
}

/**
 * 生成runtime错误日志
 * @param {String} message 错误信息
 * @param {String} source 发生错误的脚本URL
 * @param {Number} lineno 发生错误的行号
 * @param {Number} colno 发生错误的列号
 * @param {Object} error error对象
 * @returns {Object}
 */
function formatRuntimerError(message, source, lineno, colno, error) {
  return {
    type: ERROR_RUNTIME,
    desc: message + ' at ' + source + ':' + lineno + ':' + colno,
    stack: error && error.stack ? error.stack : 'no stack', // IE < 9, has no error stack
  }
}

/**
 * 生成load错误日志
 * @param {Object} errorTarget
 * @returns {Object}
 */
function formatLoadError(errorTarget) {
  return {
    type: LOAD_ERROR_TYPE[errorTarget.nodeName.toUpperCase()],
    desc: errorTarget.baseURI + '@' + (errorTarget.src || errorTarget.href),
    stack: 'no stack',
  }
}

/**
 * 错误数据统一处理函数
 * @param {Object} errorLog
 */
function handleError(errorLog) {
  // 是否延时处理
  if (!config.concat) {
    !needReport(config.sampling) || config.report([errorLog])
  } else {
    pushError(errorLog)
    report(errorList)
  }
}

/**
 * 往异常信息数组里添加一条记录
 * @param {Object} errorLog 错误日志
 */
function pushError(errorLog) {
  if (needReport(config.sampling) && errorList.length < config.maxError) {
    errorList.push(errorLog)
  }
}

/**
 * 设置一个采样率，决定是否上报
 * @param {Number} sampling 0, -1
 * @returns { Boolean }
 */
function needReport(sampling) {
  return Math.random() < (sampling || 1)
}
