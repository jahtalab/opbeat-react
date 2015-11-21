var utils = require('../utils')

module.exports = function ($provide, traceBuffer) {
  // Template Compile Instrumentation
  $provide.decorator('$compile', ['$delegate', '$injector', function ($delegate, $injector) {
    return utils.instrumentModule($delegate, $injector, {
      type: 'template.angular.$compile',
      prefix: '$compile'
    })
  }])
}
