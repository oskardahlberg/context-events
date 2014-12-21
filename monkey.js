var events = module.exports = require('events');
var EventEmitter = events.EventEmitter;
var ContextEmitter = require('./events').EventEmitter;

for (var key in ContextEmitter)
  EventEmitter[key] = ContextEmitter[key];

for (var key in ContextEmitter.prototype)
  EventEmitter.prototype[key] = ContextEmitter.prototype[key];