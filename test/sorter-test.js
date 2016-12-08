/* globals describe it beforeEach */
var expect = require('chai').expect
var sorter = require('../lib/jet/sorter')
var sinon = require('sinon')

describe('sorter', function () {
  describe('byPath', function () {
    var inst
    var onNotify
    beforeEach(function () {
      onNotify = sinon.spy()
      inst = sorter.create({
        sort: {
          byPath: true,
          from: 1, // inclusive start index JS style (first is 0,... 1->second)
          to: 3 // incluse max end index
        }
      }, onNotify)
      inst.sorter({event: 'add', value: 123, path: 'asd'}, true)
      inst.sorter({event: 'add', path: 'zoo'}, true)
      inst.sorter({event: 'add', value: 123, path: 'bar'}, true)
      inst.sorter({event: 'add', value: 123, path: 'aaa'}, true) // this will be skippped (index 0)
      inst.flush()
    })

    it('should init/flush correctly', function () {
      expect(onNotify.calledOnce).to.be.true
      expect(onNotify.args[0][0]).to.deep.equal({
        event: 'init',
        from: 0,
        array: [
          {
            path: 'asd',
            value: 123
          },
          {
            path: 'bar',
            value: 123
          },
          {
            path: 'zoo',
            value: undefined // not neccessary
          }
        ]
      })
    })

    it('should update on "remove" correctly', function () {
      inst.sorter({event: 'remove', path: 'bar'})
      expect(onNotify.calledTwice).to.be.true
      expect(onNotify.args[1][0]).to.deep.equal({
        event: 'remove',
        index: 1
      })
    })

    it('should ignore elements out of range', function () {
      inst.sorter({event: 'add', path: 'zz0'})
      inst.sorter({event: 'remove', path: 'zz0'})
      expect(onNotify.calledOnce).to.be.true
    })

    it('should update on "add" correctly', function () {
      inst.sorter({event: 'add', path: 'aaa', value: 44})
      expect(onNotify.calledTwice).to.be.true
      expect(onNotify.args[1][0]).to.deep.equal({
        event: 'insert',
        path: 'aaa',
        value: 44,
        index: 0
      })
    })

    it('should update on "change" correctly', function () {
      inst.sorter({event: 'change', path: 'asd', value: 44})
      expect(onNotify.calledTwice).to.be.true
      expect(onNotify.args[1][0]).to.deep.equal({
        event: 'change',
        path: 'asd',
        value: 44,
        index: 0
      })
    })
  })

  describe('byValue', function () {
    var inst
    var onNotify
    beforeEach(function () {
      onNotify = sinon.spy()
      inst = sorter.create({
        sort: {
          byValue: 'number',
          from: 1,
          to: 3
        }
      }, onNotify)
      inst.sorter({event: 'add', value: 1, path: 'asd'}, true)
      inst.sorter({event: 'add', value: 3, path: 'zoo'}, true)
      inst.sorter({event: 'add', value: 2, path: 'bar'}, true)
      inst.sorter({event: 'add', value: 0, path: 'uyt'}, true)
      inst.flush()
    })

    it('should init/flush correctly', function () {
      expect(onNotify.calledOnce).to.be.true
      expect(onNotify.args[0][0]).to.deep.equal({
        event: 'init',
        from: 1,
        array: [
          {
            path: 'asd',
            value: 1
          },
          {
            path: 'bar',
            value: 2
          },
          {
            path: 'zoo',
            value: 3
          }
        ]
      })
    })

    it('should update on "remove" correctly', function () {
      inst.sorter({event: 'remove', path: 'bar'})
      expect(onNotify.calledTwice).to.be.true
      expect(onNotify.args[1][0]).to.deep.equal({
        event: 'remove',
        index: 1
      })
    })

    it('should ignore elements out of range', function () {
      inst.sorter({event: 'add', path: 'zz0', value: 1000})
      inst.sorter({event: 'change', path: 'zz0', value: 10000})
      inst.sorter({event: 'remove', path: 'zz0', value: 10000})
      expect(onNotify.calledOnce).to.be.true
    })

    it('should update on "add" correctly', function () {
      inst.sorter({event: 'add', path: 'z00', value: 0.3})
      expect(onNotify.calledTwice).to.be.true
      expect(onNotify.args[1][0]).to.deep.equal({
        event: 'insert',
        path: 'z00',
        value: 0.3,
        index: 0
      })
    })

    it('should update on "change" -> move correctly', function () {
      inst.sorter({event: 'change', path: 'asd', value: 1.1})
      expect(onNotify.calledTwice).to.be.true
      expect(onNotify.args[1][0]).to.deep.equal({
        event: 'change',
        value: 1.1,
        index: 2
      })
    })

    it('should update on "change" -> move correctly', function () {
      inst.sorter({event: 'change', path: 'asd', value: 4})
      expect(onNotify.calledTwice).to.be.true
      expect(onNotify.args[1][0]).to.deep.equal({
        event: 'move',
        value: 4,
        prevIndex: 0,
        index: 2
      })
    })
  })
})
