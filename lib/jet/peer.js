'use strict'

var PeerTCP = require('./peer-tcp')
var PeerWS = require('./peer-ws')

var Peer = function (config) {
  if (config.url || (typeof (window) !== 'undefined')) {
    return new PeerWS(config)
  } else {
    return new PeerTCP(config)
  }
}

module.exports = Peer
