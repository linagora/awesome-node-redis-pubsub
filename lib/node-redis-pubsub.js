var redis = require('redis')
  ;


/**
 * Create a new NodeRedisPubsub instance that can subscribe to channels and publish messages
 * @param {Object} options Options for the client creations:
 *                 port - Optional, the port on which the Redis server is launched.
 *                 scope - Optional, two NodeRedisPubsubs with different scopes will not share messages
 */
function NodeRedisPubsub (options) {
  if (!(this instanceof NodeRedisPubsub)) return new NodeRedisPubsub(options);
  options = options || {};
  var port = options && options.port || 6379;   // 6379 is Redis' default
  var host = options && options.host || '127.0.0.1';
  var client_options = options && options.client_options || {};
  this._channels = {};
  
  // Need to create two Redis clients as one cannot be both in receiver and emitter mode
  // I wonder why that is, by the way ...
  this.emitter = redis.createClient(port, host, client_options);
  this.receiver = redis.createClient(port, host, client_options);

  if ( options.onRedisError ) {
    this.emitter.on('error', options.onRedisError);
    this.receiver.on('error', options.onRedisError);
  }

  this.receiver.setMaxListeners(0);

  this.receiver.on('message', function (channel, message) {
    if ( !this._channels[channel] ) {
      return ;
    }
    var receivedData= JSON.parse(message);
    this._channels[channel].subscriptions.forEach(function(handler) {
      handler(receivedData);
    });
  }.bind(this));


  this.prefix = options.scope ? options.scope + ':' : '';
}

NodeRedisPubsub.prototype._createChannelData = function(name) {
  this._channels[name] = {
    subscribed: false,
    subscriptions: []
  };
};


/**
 * Return the emitter object to be used as a regular redis client to save resources.
 */
NodeRedisPubsub.prototype.getRedisClient = function() {
  
  return this.emitter;
};



/**
 * Subscribe to a channel
 * @param {String} channel The channel to subscribe to, can be a pattern e.g. 'user.*'
 * @param {Function} handler Function to call with the received message.
 * @param {Function} cb Optional callback to call once the handler is registered.
 *
 */
NodeRedisPubsub.prototype.on = function(channel, handler, callback) {
  callback = callback || function() {};
  var prefixedChannel = this.prefix + channel;

  if ( !( prefixedChannel in this._channels) ) {
    this._createChannelData(prefixedChannel);
  }

  this._channels[prefixedChannel].subscriptions.push(handler);

  if ( this._channels[prefixedChannel].subscribed ) {
    callback();
    return ;
  }
  this.receiver.subscribe(prefixedChannel, callback);
  this._channels[prefixedChannel].subscribed = true;
};

/**
 * Unsubscribe from a channel
 * @param {String} channel The channel to unsubscribe from, can be a pattern e.g. 'user.*'
 * @param {Function} handler Function to call with the received message.
 * @param {Function} cb Optional callback to call once the handler is unregistered.
 *
 */
NodeRedisPubsub.prototype.removeListener = function(channel, handler, cb) {
  var callback = cb || function () {}, self = this;
  var prefixedChannel = this.prefix + channel;
  if ( !( prefixedChannel in this._channels) ) {
    return;
  }

  var subs = this._channels[prefixedChannel].subscriptions;
  var i = subs.length - 1;
  while (i >= 0) {
    if ( subs[i] === handler ) {
      subs.splice(i,1);
    }
    i--;
  }
  if ( subs.length === 0 ) {
    this.receiver.unsubscribe(prefixedChannel, callback);
    this._channels[prefixedChannel].subscribed = false;
  }
};

/**
 * Emit an event
 * @param {String} channel Channel on which to emit the message
 * @param {Object} message
 */
NodeRedisPubsub.prototype.emit = function (channel, message) {
  this.emitter.publish(this.prefix + channel, JSON.stringify(message));
};


module.exports = NodeRedisPubsub;
