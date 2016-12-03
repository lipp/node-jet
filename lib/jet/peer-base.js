'use strict'

var JsonRPC = require('./peer/jsonrpc')
var Promise = Promise || (typeof window !== 'undefined' && window.Promise) || require('bluebird')

/**
 * A bluebird Promise
 * @external Promise
 * @see {@link http://bluebirdjs.com/docs/api-reference.html|Bluebird API}
 */

var fallbackDaemonInfo = {
  name: 'unknown-daemon',
  version: '0.0.0',
  protocolVersion: 1,
  features: {
    fetch: 'full',
    authentication: false,
    batches: true
  }
}

/**
 * Create a Jet Peer instance.
 * @class
 * @classdesc A Peer instance is required for all actions related to Jet.
 * A Peer connected to a Daemon is able to add content (States/Methods)
 * or to consume content (by fetching or by calling set).
 * The peer uses either the Websocket protocol or the TCP trivial protocol (default) as transport.
 * When specifying the url field, the peer uses the Websocket protocol as transport.
 * If no config is provided, the Peer connects to the local ('localhost') Daemon using
 * the trivial protocol.
 * Browsers do only support the Websocket transport and must be provided with a config with url field.
 *
 * @param {Object} [config] A peer configuration
 * @param {string} [config.url] The Jet Daemon Websocket URL, e.g. `ws://localhost:11123`
 * @param {string} [config.ip=localhost] The Jet Daemon TCP trivial protocol ip
 * @param {number} [config.port=11122] The Jet Daemon TCP trivial protocol port
 * @param {string} [config.user] The user name used for authentication
 * @param {string} [config.password] The user's password used for auhtentication
 * @param {Boolean} [config.rejectUnauthorized=false] Allow self signed server certificates when using
 * @returns {Peer} The newly created Peer instance.
 *
 * @example
 * var peer = new jet.Peer({url: 'ws://jetbus.io:8080'})
 */
var Peer = function (sock, config) {
  this.config = config = config || {}
  var that = this

  this.jsonrpc = new JsonRPC(sock, config)

  this.connectPromise = new Promise(function (resolve, reject) {
    that.resolveConnect = resolve
    that.rejectConnect = reject
  })

  this.daemonInfo = fallbackDaemonInfo

  this.jsonrpc.connect().then(function () {
    return that.info().then(function (daemonInfo) {
      that.daemonInfo = daemonInfo
    }).catch(function () {}).then(function () {
      if (that.config.user) {
        that.authenticate(that.config.user, that.config.password).then(function (access) {
          that.access = access
          that.connected = true
          that.resolveConnect(that)
        }).catch(function (err) {
          that.rejectConnect(err)
        })
      } else {
        that.connected = true
        that.resolveConnect(that)
      }
    })
  }).catch(function (err) {
    that.rejectConnect(err)
  })
}

/**
 * Actually connect the peer to the Jet Daemon
 * After the connect Promise has been resolved, the peer provides `peer.daemonInfo` object.
 *
 * ```javascript
 * peer.connect().then(function() {
 *   var daemonInfo = peer.daemonInfo
 *   console.log('name', daemonInfo.name) // string
 *   console.log('version', daemonInfo.version) // string
 *   console.log('protocolVersion', daemonInfo.protocolVersion) // number
 *   onsole.log('can process JSON-RPC batches', daemonInfo.features.batches) // boolean
 *   console.log('supports authentication', daemonInfo.features.authentication) // boolean
 *   console.log('fetch-mode', daemonInfo.features.fetch); // string: 'full' or 'simple'
 * })
 * ```
 *
 * @returns {external:Promise} A Promise which gets resolved once connected to the Daemon, or gets rejected with either:
 * - [jet.ConnectionClosed](#module:errors~ConnectionClosed)
 * - [jet.InvalidUser](#module:errors~InvalidUser)
 * - [jet.InvalidPassword](#module:errors~InvalidPassword)
 *
 * @example
 * var peer = new jet.Peer({url: 'ws://jetbus.io:8012'})
 * peer.connect().then(function() {
 *   console.log('connected')
 * }).catch(function(err) {
 *   console.log('connect failed', err)
 * })
 */
Peer.prototype.connect = function () {
  return this.connectPromise
}

/**
 * Tells if the peer is connected to the daemon
 */
Peer.prototype.isConnected = function () {
  return this.connected === true
}

/**
 * Close the connection to the Daemon. All associated States and Methods are automatically
 * removed by the Daemon.
 *
 * @returns {external:Promise}
 *
 */
Peer.prototype.close = function () {
  this.connected = false
  return this.jsonrpc.close()
}

/**
 * Returns if the connection to the Daemon has been closed
 *
 * @returns {external:Promise}
 *
 */
Peer.prototype.closed = function () {
  return this.jsonrpc.closed()
}

/**
 * Batch operations wrapper. Issue multiple commands to the Daemon
 * in one message batch. Only required for performance critical actions.
 *
 * @param {function} action A function performing multiple peer actions.
 *
 */
Peer.prototype.batch = function (action) {
  this.jsonrpc.batch(action)
}

/**
 * Sends a fetch request to the daemon containing the fetch rules
 * defined by `fetcher`.
 *
 * @param {FetchChainer} fetcher A configured fetcher.
 * @returns {external:Promise} Gets resolved as soon as the Daemon has registered the fetch expression.
 */
Peer.prototype.fetch = function (fetcher) {
  var that = this
  return this.connectPromise.then(function () {
    fetcher.jsonrpc = that.jsonrpc
    fetcher.variant = that.daemonInfo.features.fetch
    return fetcher.fetch()
  })
}

/**
 * Sends a unfetch request to the daemon
 *
 * @param {FetchChainer} fetcher A previously fetched fetcher.
 * @returns {external:Promise} Gets resolved as soon as the Daemon has unregistered the fetch expression.
 *
 */
Peer.prototype.unfetch = function (fetcher) {
  return this.connectPromise.then(function () {
    return fetcher.unfetch()
  })
}

/**
 * Adds a state or method to the Daemon.
 *
 * @param {(State|Method)} content To content to be added.
 * @returns {external:Promise} Gets resolved as soon as the content has been added to the Daemon.
 */
Peer.prototype.add = function (stateOrMethod) {
  var that = this
  stateOrMethod.jsonrpc = that.jsonrpc
  stateOrMethod.connectPromise = this.connectPromise
  return stateOrMethod.add()
}

/**
 * Remove a state or method from the Daemon.
 *
 * @param {State|Method} content The content to be removed.
 * @returns {external:Promise} Gets resolved as soon as the content has been removed from the Daemon.
 */
Peer.prototype.remove = function (stateOrMethod) {
  return stateOrMethod.remove()
}

/**
 * Call a {Method} defined by another Peer.
 *
 * @param {string} path The unique path of the {Method}.
 * @param {Array} args The arguments provided to the {Method}.
 * @param {object} [options] Options.
 * @param {number} [options.timeout] A timeout for invoking the {Method} after which a timeout error rejects the promise.
 * @returns {external:Promise}
 */
Peer.prototype.call = function (path, callparams, options) {
  options = options || {}
  var params = {
    path: path,
    args: callparams || [],
    timeout: options.timeout // optional
  }
  var jsonrpc = this.jsonrpc
  return this.connectPromise.then(function () {
    return jsonrpc.service('call', params, null, options.skipResult)
  })
}

/**
 * Info
 * @private
 */
Peer.prototype.info = function () {
  return this.jsonrpc.service('info', {})
}

/**
 * Authenticate
 * @private
 */
Peer.prototype.authenticate = function (user, password) {
  return this.jsonrpc.service('authenticate', {
    user: user,
    password: password
  })
}

/**
 * Config
 *
 * @private
 */
Peer.prototype.configure = function (params) {
  return this.jsonrpc.service('config', params)
}

/**
 * Set a {State} to another value.
 *
 * @param {string} path The unique path to the {State}.
 * @param {*} value The desired new value of the {State}.
 * @param {object} [options] Optional settings
 * @param {number} [options.timeout]
 *
 */
Peer.prototype.set = function (path, value, options) {
  options = options || {}
  var params = {
    path: path,
    value: value,
    timeout: options.timeout, // optional
    valueAsResult: options.valueAsResult // optional
  }
  var jsonrpc = this.jsonrpc
  return this.connectPromise.then(function () {
    return jsonrpc.service('set', params, null, options.skipResult)
  })
}

module.exports = Peer
