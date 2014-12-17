// EventEmitter with optional context argument, backwards compatible
// tried to patch it, should have done it properly, it turned out a bit hacky
// but works well

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var ContextEmitter = module.exports = function ContextEmitter () {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
};

util.inherits(ContextEmitter, EventEmitter);

ContextEmitter.EventEmitter = ContextEmitter;

ContextEmitter.prototype._events = undefined;
ContextEmitter.prototype._maxListeners = undefined;

ContextEmitter.defaultMaxListeners = 10;//EventEmitter.defaultMaxListeners;

ContextEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

ContextEmitter.prototype.emit = function (type) {
  var er, handler, len, args, i, listeners, contextArgs;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        if (handler.contextListener) handler.call(this, this);
        else handler.call(this);
        return true;
        break;
      case 2:
        if (handler.contextListener) handler.call(this, this, arguments[1]);
        else handler.call(this, arguments[1]);
        return true;
        break;
      case 3:
        if (handler.contextListener) handler.call(this, this, arguments[1], arguments[2]);
        else handler.call(this, arguments[1], arguments[2]);
        return true;
        break;
    }
  }

  if (isFunction(handler) || isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];
    contextArgs = [ this ].concat(args);

    if (isFunction(handler)) {
      if (handler.contextListener) handler.apply(this, contextArgs);
      else handler.apply(this, args);
    }
    else {
      listeners = handler.slice();
      len = listeners.length;
      for (i = 0; i < len; i++) {
        if (listeners[i].contextListener) listeners[i].apply(this, contextArgs);
        else listeners[i].apply(this, args);
      }
    }
  }

  return true;
};

ContextEmitter.prototype.addListener = function (type, listener, context) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (arguments.length == 3) {
    var contextListener = listener.bind(context);
    contextListener.contextListener = listener;
    contextListener.context = context;
    listener = contextListener;
  }

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {

      // This is a bad pattern that i feel forced to continue
      // But i guess i have introduced some new :D
      // a complete rewrite might be due
      m = ContextEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

ContextEmitter.prototype.on = ContextEmitter.prototype.addListener;

ContextEmitter.prototype.once = function (type, listener, context) {
  if (arguments.length == 2)
    return EventEmitter.prototype.once.call(this, type, listener);

  var fired = false;
  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(context, arguments);
    }
  }
  g.contextListener = listener;
  g.context = context;
  this.on(type, g);

  return this;
};

ContextEmitter.prototype.removeListener = function (type, listener, context) {
  var remove = EventEmitter.prototype.removeListener;
  var events = this._events;
  if (arguments.length == 2 || !events || !events[type])
    return remove.call(this, type, listener);

  if (events[type] instanceof Array) {
    for (var i in events[type]) {
      if (events[type][i].contextListener === listener &&
          events[type][i].context === context) {
        return remove.call(this, type, events[type][i]);
      }
    }
  }
  else {
    if (events[type].contextListener === listener &&
        events[type].context === context) {
      return remove.call(this, type, events[type]);
    }
  }

  return this;
};

ContextEmitter.prototype.removeAllListeners = function (type, context) {
  var remove = EventEmitter.prototype.removeListener;
  var events = this._events;
  if (arguments.length < 2 || !events || (type && !events[type]))
    return EventEmitter.prototype.removeAllListeners.apply(this, arguments);

  if (!type) {
    for (var type in events) this.removeAllListeners(type, context);
  }
  else if (events[type] instanceof Array) {
    for (var i in events[type]) {
      if (events[type][i].context === context) {
        remove.call(this, type, events[type][i]);
      }
    }
  }
  else {
    if (events[type].context === context) {
      remove.call(this, type, events[type]);
    }
  }

  return this;
};

function isFunction(arg) {
  return typeof arg === 'function';
};

function isNumber(arg) {
  return typeof arg === 'number';
};

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
};

function isUndefined(arg) {
  return arg === void 0;
};