# context-events

Node's event emitter with optional context argument, like Backbone.

Forked from https://github.com/Gozala/events

Use require('context-events/monkey') to get a patched version of the original Events.
Should be fully backwords compatible, only acts differently when given context argument.

## Install ##

```
npm install context-events
```

## Require ##

```javascript
var EventEmitter = require('context-events')
```

## Usage ##

See the [node.js event emitter docs](http://nodejs.org/api/events.html)

## Modified proto methods ##

All context arguments are optional

### addListener / on / once (type, listener, context)
Set the context the listener will be called from it.

The first argument in the callback will be the callee.
Example: 

	emitter.on('type', listener, context);
	emitter.emit('type', arg1, arg2);
	->
	listener.call(context, emitter, arg1, arg2)

### removeListener (type, listener, context)
Remove a listener added with a context

### removeAllListeners (type, context)
Remove listeners with a certain context, type null for all