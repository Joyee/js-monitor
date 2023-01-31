'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true,
})

exports.debounce = debounce
exports.merge = merge

/**
 * debounce
 * @param {Function} func 实际要执行的函数
 * @param {Number} delay 延时时间，ms
 * @param {Function} callback 在 func 执行后的回调
 */
function debounce(func, delay, callback) {
  let timer
  return function () {
    const context = this
    const args = arguments
    clearTimeout(timer)
    timer = setTimeout(() => {
      func.apply(context, args)
      !callback || callback()
    }, delay)
  }
}

/**
 * merge
 * @param {Object} src
 * @param {Object} dest
 * @returns { Object }
 */
function merge(src, dest) {
  for (const item in src) {
    dest[item] = src[item]
  }
  return dest
}
