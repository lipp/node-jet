'use strict'

var PeerBase = require('./peer-base')
var MessageSocket = require('./message-socket').MessageSocket

var PeerTCP = function (config) {
  var sock = new MessageSocket(config.port || 11122, config.ip)
  return new PeerBase(sock, config)
}

module.exports = PeerTCP
