protonet.dispatcher.provider.WebSocket = {
  isSupported: function() {
    return protonet.browser.SUPPORTS_WEBSOCKET();
  },
  
  initialize: function() {
    this.buffer = "";
    protonet.trigger("socket.initialized");
  },

  connect: function() {
    if (location.protocol == 'https:' && !protonet.browser.IS_SAFARI()) {
      this.socket = new WebSocket(protonet.config.dispatching_websocket_url_ssl);
    } else {
      this.socket = new WebSocket(protonet.config.dispatching_websocket_url);
    }
    
    this.socket.onmessage = function(event) { 
      protonet.trigger("socket.receive", event.data);
    };
    
    this.socket.onopen = function() {
      this.hadConnection = true;
      
      this.send({
        operation: "authenticate",
        payload: {
          user_id:  protonet.config.user[0].user_id,
          token:    protonet.config.user[0].communication_token,
          type:     "web"
        }
      });
      protonet.trigger("socket.connected", true);
    }.bind(this);
    
    var onClose = function() {
      if (this.hadConnection) {
        protonet.trigger("socket.connected", false);
      } else {
        // switch to http streaming
        this.isSupported = function() { return false; };
        protonet.trigger("socket.reinitialize");
      }
    }.bind(this);
    
    this.socket.onclose = onClose;
    this.socket.onerror = onClose;
    
    $window
      .bind("beforeunload.websockets", function() {
        this.socket.onclose = $.noop;
      }.bind(this))
      
      .bind("keydown.websockets", function(event) {
        // Firefox closes a websocket connection when you press ESC!
        // That's not cool, so we have to avoid this by canceling the default behavior
        // onkeydown 27 (ESC key)
        // Well apart from that I'm currently very thirsty but we do have no
        // Alcohol-free Krombacher Radler anymore and Ali is not willing to go out and buy more
        // even though he just successfully mastered Ramadan 2011.
        // Whatever, I'm gonna focus on working now despite the fact that I'm very desperate for a cold drink.
        // Someday people will thank me for that and I'm gonna earn so much money that I can afford buying a Helicopter.
        // Then I could borrow Ali it so he can fly to the next grocery store to get the drinks. That would be truly awesome.
        if (event.keyCode === 27) {
          event.preventDefault();
        }
      });
  },
  
  disconnect: function() {
    if (!this.socket) {
      return;
    }
    $window.unbind(".websockets");
    
    this.socket.onmessage = $.noop;
    this.socket.onopen    = $.noop;
    this.socket.onclose   = $.noop;
    this.socket.onerror   = $.noop;
    
    this.socket.close();
  },
  
  send: function(data) {
    if (!this.socket || !this.socket.send) {
      return;
    }
    try { this.socket.send(JSON.stringify(data) + protonet.config.dispatching_websocket_delimiter); } catch(e) {}
  },
  
  receive: function(rawData) {
    if(protonet.config.dispatching_websocket_delimiter == "\0") {
      if(rawData.match(/\0/)) {
        var rawChunks = rawData.split(/\0/);
        var chunks = [(this.buffer || "") + rawChunks.shift()];

        // no more chunks?
        if(rawChunks.length == 0) {
          return JSON.parse(chunks[0]);
        }

        // if last chunk is complete
        if(rawChunks.slice(-1) == "\0") {
          this.buffer = ""; // empty buffer
        } else {
          this.buffer = rawChunks.pop();
        }
        
        // and pack them up
        for (var i = 0; i < rawChunks.length; i++) {
          if(rawChunks[i] != "") {
            chunks.push(rawChunks[i]);
          }
        }
        var data = $(chunks).map(function(i, val){
          return JSON.parse(val);
        });

        return data;
      } else {
        this.buffer += rawData;
      }
    } else {
      return JSON.parse(rawData);
    }
    
  }
};
