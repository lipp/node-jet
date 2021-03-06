'use strict'

const jetUtils = require('../utils')
const fetchCommon = require('../fetch-common')
const Elements = require('../element').Elements
const isDef = jetUtils.isDefined

let globalFetchId = 1

const createFetchDispatcher = function (params, f, ref) {
  if (isDef(params.sort)) {
    if (params.sort.asArray) {
      delete params.sort.asArray // peer internal param
      const arr = []
      const from = params.sort.from
      return function (message) {
        arr.length = message.params.n
        message.params.changes.forEach(function (change) {
          arr[change.index - from] = change
        })
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

const FakePeer = function () {
  this.fetchers = {}
  this.id = 'fakePeer'
  const eachFetcherIterator = jetUtils.eachKeyValue(this.fetchers)
  this.eachFetcher = function (element, initElementFetching) {
    const hasSetAccess = !element.fetchOnly
    const initElementFetchingAccess = function (peerFetchId, fetcher) {
      initElementFetching('fakePeer' + peerFetchId, fetcher, hasSetAccess)
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
  return (this.fetchers[fetchId] && true) || false
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
const FakeFetcher = function (jsonrpc, fetchParams, fetchCb, asNotification) {
  const id = '__f__' + globalFetchId
  ++globalFetchId

  fetchParams.id = id

  let fetchDispatcher

  const wrappedFetchDispatcher = function (nparams) {
    fetchDispatcher = fetchDispatcher || createFetchDispatcher(fetchParams, fetchCb, this)
    fetchDispatcher({
      params: nparams
    })
  }

  if (jsonrpc.fakeContext === undefined) {
    const context = jsonrpc.fakeContext = {}
    context.elements = new Elements()
    context.peer = new FakePeer()

    const fetchSimpleDispatcher = function (message) {
      const params = message.params
      const event = params.event

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
      }, asNotification).then(function () {
        setTimeout(resolve, 50) // wait some time to let the FakeFetcher.elements get filled
      }).catch(reject)
    })
  }

  this.fetch = function () {
    const context = jsonrpc.fakeContext
    return context.fetchAllPromise.then(function () {
      return fetchCommon.fetchCore(context.peer, context.elements, fetchParams, wrappedFetchDispatcher)
    })
  }

  this.unfetch = function () {
    const context = jsonrpc.fakeContext
    return context.fetchAllPromise.then(function () {
      return fetchCommon.unfetchCore(context.peer, context.elements, fetchParams)
    })
  }

  this.isFetching = function () {
    const context = jsonrpc.fakeContext
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
const Fetcher = function (jsonrpc, params, fetchCb, asNotification) {
  const id = '__f__' + globalFetchId
  params.id = id
  ++globalFetchId

  const fetchDispatcher = createFetchDispatcher(params, fetchCb, this)

  const addFetchDispatcher = function () {
    jsonrpc.addRequestDispatcher(id, fetchDispatcher)
  }

  const removeFetchDispatcher = function () {
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
    return jsonrpc.service('fetch', params, addFetchDispatcher, asNotification)
  }
}

module.exports = {
  FakeFetcher: FakeFetcher,
  Fetcher: Fetcher
}
