/**
 * this is our central event emitter
 * at the moment it doesn't do anything than just be there as a
 * central pub sub point
 */
(function() {
  var WHITE_SPACE = /\s+/;
  
  protonet.events.Emitter = Class.create({
    initialize: function() {
      this._events = {};
      // Aliases
      this.bind = this.on.bind(this);
      this.unbind = this.off.bind(this);
    },
    
    _on: function(eventName, handler) {
      var handlerArray = this._events[eventName] || (this._events[eventName] = []);
      handlerArray.push(handler);
    },
    
    on: function(eventNames, handler) {
      $.each(eventNames.split(WHITE_SPACE), function(i, eventName) {
        this._on(eventName, handler);
      }.bind(this));
      return this;
    },
    
    _before: function(eventName, handler) {
      var handlerArray = this._events[eventName] || (this._events[eventName] = []);
      handlerArray.unshift(handler);
    },
    
    before: function(eventNames, handler) {
      $.each(eventNames.split(WHITE_SPACE), function(i, eventName) {
        this._before(eventName, handler);
      }.bind(this));
      return this;
    },
    
    _after: function(eventName, handler) {
      var handlerArray = this._events[eventName] || (this._events[eventName] = []);
      handlerArray.push(function() {
        var args = $.makeArray(arguments),
            that = this;
        setTimeout(function() { handler.apply(that, args); }, 0);
      });
    },
    
    after: function(eventNames, handler) {
      $.each(eventNames.split(WHITE_SPACE), function(i, eventName) {
        this._after(eventName, handler);
      }.bind(this));
      return this;
    },
    
    _off: function(eventName, handler) {
      this._events[eventName] = handler ? $.map(this._events[eventName] || [], function(currentHandler) {
        return handler === currentHandler ? null : currentHandler;
      }) : [];
      return this;
    },
    
    off: function(eventNames, handler) {
      $.each(eventNames.split(WHITE_SPACE), function(i, eventName) {
        this._off(eventName, handler);
      }.bind(this));
      return this;
    },
    
    one: function(eventName, handler) {
      return this.on(eventName, function() {
        this.off(eventName, arguments.callee);
        handler.apply(this, $.makeArray(arguments));
      }.bind(this));
    },
    
    trigger: function() {
      var args      = $.makeArray(arguments),
          eventName = args.shift();
      
      if (protonet.config.debug_mode) {
        console.log(eventName, arguments);
      }
      
      $.each(this._events[eventName] || [], function(i, handler) {
        handler.apply(this, args);
      }.bind(this));
      return this;
    },
    
    destroy: function() {
      delete this._events;
    }
  });
})();