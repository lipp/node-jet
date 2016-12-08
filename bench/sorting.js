var jet = require('../lib/jet')

var daemon = new jet.Daemon()

var provider = new jet.Peer()

var n = 10000
var changes = 1000
var states = {}

for (var i = 0; i < n; ++i) {
  var state = new jet.State('#' + i, Math.random())
  states['#' + i] = state
  provider.add(state)
}

provider.connect().then(function () {
  console.log('provider ready')
})

var consumer = new jet.Peer()

var fetcher = new jet.Fetcher()
  .sortByValue('number')
  .range(20, 100)

var changeCount = 0
fetcher.on('data', function (data) {
  changeCount++
  var first = states[data[0].path]
  var last = states[data[data.length - 1].path]
  first.value(last.value() + Math.random())
  if (changeCount === changes) {
    console.log('done', changeCount)
    process.exit(0)
  }
})

consumer.fetch(fetcher)

consumer.connect().then(function () {
  console.log('consumer ready')
})

daemon.listen()
