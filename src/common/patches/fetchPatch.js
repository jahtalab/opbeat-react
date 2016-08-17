var utils = require('../../lib/utils')
var patchObject = require('../patchUtils').patchObject

var fetchTasks = 0

var fetchCounter = 0
function patchFetch (serviceContainer) {
  var transactionService = serviceContainer.services.transactionService

  // var then = function(trace) {
    
  // }

  var patchList = ['json', 'text', 'formData', 'blob', 'arrayBuffer', 'redirect', 'error']

  function patchResponse (response, trace) {
    var myTrace = trace
    patchList.forEach(function(funcName) { 
      if (!utils.isUndefined(response[funcName])) {
        patchObject(response, funcName, function(delegate) {
          return function(self, args) {
            var promise = delegate.apply(self, args)
            
            patchObject(promise, 'then', function (delegate) {
              return function (self, args) { // resolve, reject
                var task = {taskId: 'fetchTask' + fetchTasks++}
                transactionService.addTask(task.taskId)
                var resolve = args[0]
                args[0] = function () {
                  var ret = resolve.apply(this, arguments)
                  transactionService.removeTask(task.taskId)
                  transactionService.detectFinish()
                  return ret
                }
                return delegate.apply(self, args)
                // patchThen(newPromise, trace)
                // return newPromise
              }
            })

            return promise
          }
        })
      }
    })
  }

  function patchThen (promise, trace) {
    var myTrace = trace
    if (!utils.isUndefined(promise.then)) {
      patchObject(promise, 'then', function (delegate) {
        return function (self, args) { // resolve, reject
          var task = {taskId: 'fetchTask' + fetchTasks++}
          transactionService.addTask(task.taskId)
          var resolve = args[0]
          args[0] = function () {
            if (!trace.ended) {
              trace.end()
            }

            if (arguments.length > 0 && arguments[0]) {
              patchResponse(arguments[0], trace)
            }

            var ret = resolve.apply(this, arguments)
            transactionService.removeTask(task.taskId)
            transactionService.detectFinish()
            return ret
          }

          var newPromise = delegate.apply(self, args)
          patchThen(newPromise, trace)
          return newPromise
        }
      })
    }
  }

  if (window.fetch) {
    patchObject(window, 'fetch', function (delegate) {
      return function (self, args) { // url, urlOpts
        if (args.length < 1) {
          return delegate.apply(self, args)
        }
        var url = args[0]
        var trace = transactionService.startTrace('GET ' + url, 'ext.HttpRequest.fetch')

        var promise = delegate.apply(self, args)
        patchThen(promise, trace)
        return promise
      }
    })
  }
}
module.exports = patchFetch