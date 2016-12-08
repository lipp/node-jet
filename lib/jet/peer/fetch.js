'use strict'

var jetUtils = require('../utils')
var fetchCommon = require('../fetch-common')
var Elements = require('../element').Elements
var Promise = Promise || (typeof window !== 'undefined' && window.Promise) || require('bluebird')
var isDef = jetUtils.isDefined

var globalFetchId = 1

var createFetchDispatcher = function (params, f, ref) {
  if (isDef(params.sort)) {
    if (params.sort.asArray) {
      delete params.sort.asArray // peer internal param
      var arr = []
      // var from = params.sort.from
      return function (message) {
        message = message.params
        if (message.event === 'init') {
          arr = message.array
        } else if (message.event === 'change') {
          arr[message.index].path = message.path
          arr[message.index].value = message.value
        } else if (message.event === 'move') {
          arr.splice(message.index, 0, arr.splice(message.prevIndex, 1)[0])
          arr[message.index].value = message.value
        } else if (message.event === 'insert') {
          arr = arr.slice(0, message.index).concat([{path: message.path, value: message.value}]).concat(arr.slice(message.index))
        } else if (message.event === 'remove') {
          arr = arr.slice(0, message.index).concat(arr.slice(message.index + 1)).concat([message.append])
        }
        f.call(ref, arr, ref)
      }
    } else {
      return function (message) {
        f.call(ref, message.params.changes, message.params.n)
      }
    }
  } else {
    return function (message) {
      f.call(ref, message.params)
    }
  }
}

var FakePeer = function () {
  this.fetchers = {}
  this.id = 'fakePeer'
  var eachFetcherIterator = jetUtils.eachKeyValue(this.fetchers)
  this.eachFetcher = function (element, initElementFetching) {
    var hasSetAccess = !element.fetchOnly
    var initElementFetchingAccess = function (peerFetchId, fetcher) {
      initElementFetching(peerFetchId, fetcher, hasSetAccess)
    }
    eachFetcherIterator(initElementFetchingAccess)
  }
}

FakePeer.prototype.addFetcher = function (fetchId, fetcher) {
  this.fetchers[fetchId] = fetcher
}

FakePeer.prototype.removeFetcher = function (fetchId) {
  delete this.fetchers[fetchId]
}

FakePeer.prototype.hasFetcher = function (fetchId) {
  return this.fetchers[fetchId] && true || false
}

/**
 * FakeFetcher
 *
 * Mimiks normal "fetch" API when the Daemon runs
 * fetch = 'simple' mode. In this case, the Daemon supports
 * only one "fetch all" per Peer.
 * Filtering (value and/or path based) and sorting are handled
 * by the peer.
 *
 * Normally only embedded systems with very limited resources
 * run the fetch = 'simple' mode.
 * @private
 */
var FakeFetcher = function (jsonrpc, fetchParams, fetchCb) {
  var id = '__f__' + globalFetchId
  ++globalFetchId

  fetchParams.id = id

  var fetchDispatcher

  var wrappedFetchDispatcher = function (nparams) {
    fetchDispatcher = fetchDispatcher || createFetchDispatcher(fetchParams, fetchCb, this)
    fetchDispatcher({
      params: nparams
    })
  }

  if (jsonrpc.fakeContext === undefined) {
    var context = jsonrpc.fakeContext = {}
    context.elements = new Elements()
    context.peer = new FakePeer()

    var fetchSimpleDispatcher = function (message) {
      var params = message.params
      var event = params.event

      if (event === 'remove') {
        fetchCommon.removeCore(context.peer, context.elements, params)
      } else if (event === 'add') {
        fetchCommon.addCore(context.peer, context.peer.eachFetcher, context.elements, params)
      } else {
        fetchCommon.changeCore(context.peer, context.elements, params)
      }
    }

    context.fetchAllPromise = new Promise(function (resolve, reject) {
      jsonrpc.service('fetch', {}, function (ok, fetchSimpleId) {
        jsonrpc.addRequestDispatcher(fetchSimpleId, fetchSimpleDispatcher)
      }).then(function () {
        setTimeout(resolve, 50) // wait some time to let the FakeFetcher.elements get filled
      }).catch(reject)
    })
  }

  this.fetch = function () {
    var context = jsonrpc.fakeContext
    return context.fetchAllPromise.then(function () {
      return fetchCommon.fetchCore(context.peer, context.elements, fetchParams, wrappedFetchDispatcher)
    })
  }

  this.unfetch = function () {
    var context = jsonrpc.fakeContext
    return context.fetchAllPromise.then(function () {
      return fetchCommon.unfetchCore(context.peer, context.elements, fetchParams)
    })
  }

  this.isFetching = function () {
    var context = jsonrpc.fakeContext
    return context.peer.hasFetcher(fetchParams.id)
  }
}

/**
 * Fetcher
 *
 * Sets up a new fetcher. Fetching is very similiar to pub-sub.
 * You can optionally define path- and/or value-based filters
 * and sorting criteria.
 *
 * All options are available at [jetbus.io](http://jetbus.io).
 */
var Fetcher = function (jsonrpc, params, fetchCb) {
  var id = '__f__' + globalFetchId
  params.id = id
  ++globalFetchId

  var fetchDispatcher = createFetchDispatcher(params, fetchCb, this)

  var addFetchDispatcher = function () {
    jsonrpc.addRequestDispatcher(id, fetchDispatcher)
  }

  var removeFetchDispatcher = function () {
    jsonrpc.removeRequestDispatcher(id)
  }

  this.unfetch = function () {
    return jsonrpc.service('unfetch', {
      id: id
    }, removeFetchDispatcher)
  }

  this.isFetching = function () {
    return jsonrpc.hasRequestDispatcher(id)
  }

  this.fetch = function () {
    return jsonrpc.service('fetch', params, addFetchDispatcher)
  }
}

module.exports = {
  FakeFetcher: FakeFetcher,
  Fetcher: Fetcher
}
