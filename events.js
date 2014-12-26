// EventEmitter with optional context argument, backwards compatible


// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var EventEmitter = module.exports = function EventEmitter () {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
};

EventEmitter.EventEmitter = EventEmitter;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function (n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function (type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error' &&
      (!this._events || !this._events.error ||
      (isObject(this._events.error) && !this._events.error.length))) {

    if (arguments[1] instanceof Error) throw arguments[1];
    throw TypeError('Uncaught, unspecified "error" event.');
  }

  if (!this._events) return false;

  var handler = this._events[type];

  if (!handler ||
      isObject(handler) && handler.length == 0) return false;

  var length = arguments.length;

  // fast cases
  if (isFunction(handler) && length <= 3) {
    // call with context as first argument
    if (handler.hasOwnProperty('context')) {
      if (length == 1) handler.call(null, this);
      if (length == 2) handler.call(null, this, arguments[1]);
      if (length == 3) handler.call(null, this, arguments[1], arguments[2]);
    }
    else {
      if (length == 1) handler.call(this);
      if (length == 2) handler.call(this, arguments[1]);
      if (length == 3) handler.call(this, arguments[1], arguments[2]);    
    }

    return true;
  }

  var args = new Array(length - 1);
  for (var i = 1; i < length; i++) args[i-1] = arguments[i];
  var contextArgs = [ this ].concat(args);

  if (isFunction(handler)) {
    if (handler.hasOwnProperty('context')) handler.apply(null, contextArgs);
    else handler.apply(this, args);
    return true;
  }

  var listeners = handler.slice();

  for (var i in listeners) {
    if (listeners[i].hasOwnProperty('context')) listeners[i].apply(null, contextArgs);
    else listeners[i].apply(this, args);    
  }

  return true;
};

EventEmitter.prototype.addListener = function (type, listener, context) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events) this._events = {};

  if (arguments.length > 2) {
    var bound = listener.bind(context);
    bound.context = context;
    bound.original = listener;
    listener = bound;
  }

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener"
  var original = isFunction(listener.original) ? listener.original : listener;
  if (this._events.newListener) {
    console.log('emitting', type, original, context)
    if (arguments.length > 2)
      this.emit('newListener', type, original, context);
    else
      this.emit('newListener', type, original);
  }

  // Optimize the case of one listener. Don't need the extra array object.
  if (!this._events[type])
    this._events[type] = listener;
  // If we've already got an array, just append.
  else if (isObject(this._events[type]))
    this._events[type].push(listener);
  // Adding the second element, need to change to array.
  else
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var max;
    if (!isUndefined(this._maxListeners)) {
      max = this._maxListeners;
    }
    else if (this.constructor && !isUndefined(this.constructor.defaultMaxListeners)) {
      max = this.constructor.defaultMaxListeners;
    }
    else {
      max = EventEmitter.defaultMaxListeners;
    }

    if (max && max > 0 && this._events[type].length > max) {
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

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function (type, listener, context) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;
  var temp = function () {
    this.removeListener(type, temp);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  };

  if (arguments.length > 2) {
    temp = temp.bind(context);
    temp.context = context;
  }

  temp.original = listener;
  this.on(type, temp);

  return this;
};

// emits a 'removeListener' event if the listener was removed
EventEmitter.prototype.removeListener = function (type, listener, context) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  var handler = this._events[type];

  if (isFunction(handler)) {
    if (!hasListener(handler, listener) ||
        arguments.length <= 2 && handler.hasOwnProperty('context') || 
        arguments.length > 2 && !hasContext(handler, context)) {
    return this;
  }
    delete this._events[type];
  }
  else {
    var position;
    for (var i = 0; i < handler.length; i++) {
      if (arguments.length <= 2 && handler[i].hasOwnProperty('context') || 
          arguments.length > 2 && !hasContext(handler[i], context)) continue;
      if (hasListener(handler[i], listener)) {
        position = i;
        break;
      }    
    }

    if (position == null) return this;

    if (handler.length === 1) delete this._events[type];
    else handler.splice(position, 1);
  }

  if (this._events.removeListener) {
    if (arguments.length > 2)
      this.emit('removeListener', type, listener, context);
    else
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function (type, context) {
  if (!this._events) return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener && arguments.length < 2) {
    if (arguments.length === 0) this._events = {};
    else if (this._events[type]) delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (var key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    delete this._events;
    return this;
  }

  if (arguments.length > 1 && type == null) {
    for (var key in this._events) this.removeAllListeners(key, context);
    return this;
  }

  var handler = this._events[type];

  if (isFunction(handler)) {
    if (arguments.length > 1) {
      if (!hasContext(handler, context)) return this;
      this.removeListener(type, handler, context);
    }
    else {
      if (handler.hasOwnProperty('context')) return this;
      this.removeListener(type, handler);
    }
  }
  else {
    var listeners = handler.slice();
    for (var i = listeners.length - 1; i >= 0; i--) {
      if (arguments.length > 1) {
        if (!hasContext(listeners[i], context)) continue;
        this.removeListener(type, listeners[i], context);
      }
      else {
        if (listeners[i].hasOwnProperty('context')) continue;
        this.removeListener(type, listeners[i]);
      }
    }
  }

  return this;
};

EventEmitter.prototype.listeners = function (type, context) {
  if (arguments.length > 1 && type == null) {
    var result = [];
    for (var key in this._events) {
      result = result.concat(this.listeners(key, context));
    }
    return result;
  }

  var handler;
  if (!this._events || !this._events[type]) handler = [];
  else if (isFunction(this._events[type])) handler = [this._events[type]];
  else handler = this._events[type].slice();

  if (arguments.length < 2) return handler;

  var result = [];
  for (var i = 0; i < handler.length; i++) {
    if (hasContext(handler[i], context)) result.push(handler[i].original);
  }
  return result;
};

// this is weird ? keeping for legacy
EventEmitter.listenerCount = function (emitter, type) {
  var result;
  if (!emitter._events || !emitter._events[type])
    result = 0;
  else if (isFunction(emitter._events[type]))
    result = 1;
  else
    result = emitter._events[type].length;
  return result;
};

function hasListener (handler, listener) {
  return (
    handler === listener ||
    isFunction(handler.original) && handler.original === listener
  );
};

function hasContext (handler, context) {
  return handler.hasOwnProperty('context') && handler.context === context;
};

function isFunction (arg) {
  return typeof arg === 'function';
};

function isNumber (arg) {
  return typeof arg === 'number';
};

function isObject (arg) {
  return typeof arg === 'object' && arg !== null;
};

function isUndefined(arg) {
  return arg === void 0;
};