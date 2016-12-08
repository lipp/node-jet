'use strict'

var jetUtils = require('./utils')
var isDefined = jetUtils.isDefined

var createSort = function (options) {
  var sort
  var lt, gt

  if ((!isDefined(options.sort.byValue) && !isDefined(options.sort.byValueField)) || options.sort.byPath) {
    gt = function (a, b) {
      return a.path > b.path
    }
    lt = function (a, b) {
      return a.path < b.path
    }
  } else {
    if (options.sort.byValue) {
      lt = function (a, b) {
        return a.value < b.value
      }
      gt = function (a, b) {
        return a.value > b.value
      }
    } else if (options.sort.byValueField) {
      var fieldStr = Object.keys(options.sort.byValueField)[0]
      var getField = jetUtils.accessField(fieldStr)
      lt = function (a, b) {
        return getField(a.value) < getField(b.value)
      }
      gt = function (a, b) {
        return getField(a.value) > getField(b.value)
      }
    }
  }
  var psort = function (s, a, b) {
    try {
      if (s(a, b)) {
        return -1
      }
    } catch (ignore) {} // eslint-disable-line no-empty
    return 1
  }

  if (options.sort.descending) {
    sort = function (a, b) {
      return psort(gt, a, b)
    }
  } else {
    sort = function (a, b) {
      return psort(lt, a, b)
    }
  }
  return sort
}

exports.create = function (options, notify) {
  var from
  var to
  var matches = {}
  var sorted = []
  var indices = []
  var sort

  from = options.sort.from || 0
  to = options.sort.to || 9

  sort = createSort(options)

  var isInRange = function (i) {
    return i > -1 && i <= (to - from)
  }

  var sorter = function (notification, initializing) {
    var event = notification.event
    var path = notification.path
    var value = notification.value
    if (event !== 'remove') {
      var element = {path: path}
      if (notification.hasOwnProperty('value')) {
        element.value = value
      }
      if (notification.fetchOnly) {
        element.fetchOnly = true
      }
      matches[path] = element
    } else {
      delete matches[path]
    }
    if (initializing) {
      return
    }

    var index = indices.indexOf(path)

    if (event === 'remove') {
      if (isInRange(index)) {
        sorted = sorted.slice(0, index).concat(sorted.slice(index + 1))
        notify({
          event: 'remove',
          index: index
        })
      }
      return
    }

    sorted = Object.keys(matches)
      .map(function (path) {
        return matches[path]
      })
      .sort(sort)
      .slice(from, to + 1)

    indices = sorted.map(function (element) {
      return element.path
    })

    var newIndex = indices.indexOf(path)

    if (isInRange(newIndex)) {
      var message = {}
      if (index === newIndex) {
        message.event = 'change'
      } else if (isInRange(index)) {
        message.event = 'move'
        message.prevIndex = index
      } else {
        message.event = 'insert'
        message.path = path
      }
      message.index = newIndex
      message.value = value
      notify(message)
    }
  }

  var flush = function () {
    sorted = Object.keys(matches)
      .map(function (path) {
        var element = matches[path]
        return {
          path: element.path,
          value: element.value
        }
      })
      .sort(sort)
      .slice(from, to + 1)

    indices = sorted.map(function (element) {
      return element.path
    })

    notify({
      event: 'init',
      from: from,
      array: sorted
    })
  }

  return {
    sorter: sorter,
    flush: flush
  }
}
