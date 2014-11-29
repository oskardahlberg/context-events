# context-events

Node's event emitter with optional context argument, like Backbone.
Inherits from
https://github.com/Gozala/events
and should be fully backwords compatible since it calls most of the original code.

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
Set the contex the listener will be called from it

### removeListener (type, listener, context)
Remove a listener added with a context

### removeAllListeners (type, context)
Remove listeners with a certain context, type null for all