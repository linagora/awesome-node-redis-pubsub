var should = require('chai').should()
  , conf = { port: 6379, scope: 'onescope' }
  , conf2 = { port: 6379, scope: 'anotherscope' }
  , NodeRedisPubsub = require('../index')
  ;


describe('Node Redis Pubsub', function () {

  it('should trap driver error using onRedisError option', function(done) {
    var called = 0;
    var conf = {
      port: 3333,
      scope: 'foo',
      onRedisError: function(err) {
        err.should.be.an.object;
        err.should.have.property('message');
        called++;
        if ( called === 2 ) {
          done();
        }
      }
    };
    var rq = new NodeRedisPubsub(conf);
  });

  it('Should send and receive standard messages correctly', function (done) {
    var rq = new NodeRedisPubsub(conf);

    rq.on('a test', function (data) {
      data.first.should.equal('First message');
      data.second.should.equal('Second message');
      done();
    }
    , function () {
        rq.emit('a test', { first: 'First message'
                            , second: 'Second message' });
      });
  });


  it('Should only receive messages for his own scope', function (done) {
    var rq = new NodeRedisPubsub(conf)
      , rq2 = new NodeRedisPubsub(conf2)
      ;

    rq.on('thesame', function (data) {
      data.first.should.equal('First message');
      data.second.should.equal('Second message');
      rq2.emit('thesame', { third: 'Third message' });
    }
    , function () {
        rq2.on('thesame', function (data) {
          data.third.should.equal('Third message');   // Tests would fail here if rq2 received message destined to rq
          done();
        }, function () {
          rq.emit('thesame', { first: 'First message'
                             , second: 'Second message' });
        });
      });
  });

  it('Should support unsubscribing channels', function (done) {
    var rq = new NodeRedisPubsub(conf);
    var handler = function (data) {
      data.first.should.equal('First message');
      data.second.should.equal('Second message');
    };
    rq.on('remove test', handler
    , function () {
      rq.removeListener('remove test', handler,function() {
        rq._channels['onescope:remove test'].subscriptions.should.have.length(0);
        rq._channels['onescope:remove test'].subscribed.should.be.false;
        done();
      });
    });
  });



});


