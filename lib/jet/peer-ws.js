'use strict'

var PeerBase = require('./peer-base')
var WebSocket = WebSocket || (typeof window !== 'undefined' && window.WebSocket) || require('ws')

var PeerWS = function (config) {
  var url = config.url || (typeof window !== 'undefined' && ('ws://' + window.location.host))
  var sock = new WebSocket(url, 'jet', config)
  return new PeerBase(sock, config)
}

module.exports = PeerWS
