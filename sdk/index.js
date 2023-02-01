import { get, has, clone } from 'lodash-es'
import rule from './rule'

let _ = {}

_.get = get
_.has = has
_.clone = clone

const DEFAULT_CONFIG = {
  pid: '', // 项目id
  uuid: '', // [可选]设备唯一id，用于计算uv&设备分布，一般在cookie中可以取到，没有uuid可用设备mac/idfa(Apple 向用户设备随机分配的设备标识符)/imei(手机序列号)替代或者在storage的key中存入随机数字，模拟设备唯一id
  ucid: '', // [可选]用户 ucid，用于发生异常时追踪用户信息，一般在cookie中可以取到，没有可传空字符串
  is_test: false, // 是否为测试数据，默认false
  version: '1.0.0', // 业务方的js版本号，会随着打点数据一起上传，方便区分数据来源
  record: {
    time_on_page: true, // 是否监控用户在线时长数据，默认true
    performance: true, // 是否监控页面载入性能，默认true,
    js_error: true, // 是否监控页面报错信息，默认true,
    // 配置需要监控的页面报错类型，仅在js_error=true生效
    js_error_report_config: {
      ERROR_RUNTIME: true,
      ERROR_SCRIPT: true, // js资源加载失败
      ERROR_STYLE: true,
      ERROR_IMAGE: true,
      ERROR_AUDIO: true,
      ERROR_VIDEO: true,
      ERROR_CONSOLE: true, // vue运行时报错
      ERROR_TRY_CATCH: true,
      // 自定义检测函数，判断是否需要上报该错误
      checkErrorNeedReport: (desc = '', stack = '') => true,
    },
  },
  // 对于如同
  // test.com/detail/1.html
  // test.com/detail/2.html
  // test.com/detail/3.html
  // ...
  // 这种页面来说, 虽然url不同, 但他们本质上是同一个页面
  // 因此需要业务方传入一个处理函数, 根据当前url解析出真实的页面类型(例如: 列表页/详情页), 方便对错误来源进行分类
  // getPageType函数执行时会被传入一个location对象, 业务方需要完成该函数, 返回对应的的页面类型(50字以内, 建议返回汉字, 方便查看), 默认是返回当前页面的url
  getPageType: (location = window.location) => {
    return `${location.host}${location.pathname}`
  },
}

let commonConfig = _.clone(DEFAULT_CONFIG)

function debugLogger() {
  // 只有测试的时候才打印log
  if (commonConfig.is_test) {
    console.info(...arguments)
  }
}

const validLog = (type = '', code, detail = {}, extra = {}) => {
  const pid = _.get(commonConfig, ['pid'], '')
  if (!pid) {
    return '请设置工程ID[pid]'
  }

  if (type === 'error') {
    if (code < 0 || code > 9999) {
      return 'type:error的log code 应该在1～9999之间'
    }
  } else if (type === 'product') {
    if (code < 10000 || code > 19999) {
      return 'type:product的log code 应该在10000～19999之间'
    }
  } else if (type === 'info') {
    if (code < 20000 || code > 29999) {
      return 'type:info的log code 应该在20000～29999之间'
    }
  }

  // 字端段类型校验
  if (typeof detail !== 'object') {
    return 'second argument detail required object'
  }
  // 字端段类型校验
  if (typeof extra !== 'object') {
    return 'third argument extra required object'
  }

  // 字段校验
  const ruleItem = rule[code]
  if (ruleItem) {
    // 消费字段必填
    const requireFields = [...ruleItem.df]
    const realFields = Object.keys(detail)
    const needFields = []
    requireFields.forEach((field) => {
      // 缺字端
      if (realFields.indexOf(field) === -1) {
        needFields.push(field)
      }
    })
    if (needFields.length) {
      return `code: ${code} 要求 ${needFields.join(',')}字段必填`
    }
  }
  return ''
}

const detailAdapter = (code, detail = {}) => {
  const dbDetail = {
    error_no: '',
    http_code: '',
    during_ms: '',
    url: '',
    request_size_b: '',
    response_size_b: '',
  }
  // 查找rule
  const ruleItem = rule[code]
  if (ruleItem) {
    const d = { ...dbDetail }
    const fields = Object.keys(detail)
    fields.forEach((field) => {
      const transferField = ruleItem.dft[field]
      // 需要字段转换
      if (transferField) {
        // 需要字段转换
        d[transferField] = detail[field]
        delete detail[field]
      } else {
        d[field] = detail[field]
      }
    })
    return d
  } else {
    return detail
  }
}

const clog = (text) => {
  console.log(`%c ${text}`, 'color: red')
}

/**
 *
 * @param {类型} type
 * @param {code码} code
 * @param {消费数据} detail
 * @param {展示数据} extra
 */
const log = (type = '', code, detail = {}, extra = {}) => {
  const errorMsg = validLog(type, code, detail, extra)
  if (errorMsg) {
    clog(errorMsg)
    return
  }
  // 调用自定义函数，计算pageType
  let getPageTypeFunc = _.get(
    commonConfig,
    ['getPageType'],
    _.get(DEFAULT_CONFIG, ['getPageType'])
  )
  let location = window.location
  let pageType = location.href
  try {
    pageType = '' + getPageTypeFunc(location)
  } catch (error) {
    debugLogger(`config.getPageType执行时发生异常, 错误信息 => `, {
      e: error,
      location,
    })
    pageType = `${location.host}${location.pathname}`
  }

  const logInfo = {
    type,
    code,
    detail: detailAdapter(code, detail),
    extra,
    common: {
      ...commonConfig,
      timestamp: Date.now(),
      runtime_version: commonConfig.version,
      sdk_version: config.version,
      page_type: pageType,
    },
  }

  const img = new window.Image()
  img.src = `${feeTarget}?d=${encodeURIComponent(JSON.stringify(logInfo))}`
}

window.onload = () => {
  // 检查是否监控性能指标
  const isPerformanceFlagOn = _.get(
    commonConfig,
    ['record', 'performance'],
    _.get(DEFAULT_CONFIG, ['record', 'performance'])
  )
  const isOldPerformanceFlagOn = _.get(commonConfig, ['performance'], false)
  const needRecordPerformance = isPerformanceFlagOn || isOldPerformanceFlagOn
  if (needRecordPerformance === false) {
    debugLogger(`config.record.performance值为false，跳过性能指标打点`)
    return
  }

  const performance = window.performance
  if (!performance) {
    console.log('你的浏览器不支持 performace 接口')
    return
  }

  const times = performance.timing.toJSON()
  debugLogger('发送页面性能指标数据, 上报内容 => ', {
    ...times,
    url: `${window.location.host}${window.location.pathname}`,
  })
  log('perf', 20001, {
    ...times,
    url: `${window.location.host}${window.location.pathname}`,
  })
}

// 用户行为数据

// 获取用户平均在线时长
const OFFLINE_MILL = 15 * 60 * 1000 // 15min 不操作认为不在线
const SEND_MILL = 5 * 1000 // 每5s打点一次
let lastTime = Date.now()

window.addEventListener('click', function () {
  // 检查是否监控用户在线时长
  const isTimeOnPageFlagOn = _.get(commonConfig, ['record', 'time_on_page'], _.get(DEFAULT_CONFIG, ['record', 'time_on_page']))
  const isOldTimeOnPageFlagOn = _.get(commonConfig, ['online'], false)
  const needRecordTimeOnPage = isTimeOnPageFlagOn || isOldTimeOnPageFlagOn
  if (needRecordTimeOnPage === false) {
    debugLogger('config.record.time_on_page值为false， 跳过停留时长打点')
    return
  }
  const now = Date.now()
  const duration = now - SEND_MILL
  if (duration > OFFLINE_MILL) {
    lastTime = Date.now()
  } else if (duration > SEND_MILL) {
    debugLogger('发送用户留存时间埋点，埋点内容 => ', { duration_ms: duration })
    // 用户在线时长
    log.product(10001, { duration_ms: duration })
  }
}, false)

export const Elog = log.error = (code, detail, extra) => {
  return log('error', code, detail, extra)
}

export const Plog = log.product = (code, detail, extra) => {
  return log('product', code, detail, extra)
}

export const Ilog = log.info = (code, detail, extra) => {
  return log('info', code, detail, extra)
}
