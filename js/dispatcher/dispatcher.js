protonet.dispatcher = {

  initialize: function() {
    this._observe();
    this.create();
  },
  
  reinitialize: function() {
    var undef;
    this.initialized = this.connected = undef;
    this.create();
  },

  initializeCallback: function() {
    this.initialized = true;
    this.connect();
  },
  
  onready: function(callback) {
    if (this.connected) {
      callback();
    } else {
      this.callbacks = this.callbacks || [];
      this.callbacks.push(callback);
    }
  },
  
  _observe: function() {
    var that = this;
    
    protonet.one("socket.update_id", function() {
      setTimeout(function() {
        if (that.callbacks) {
          $.each(that.callbacks, function(i, callback) {
            callback();
          });
          that.callbacks = [];
        }
      }, 0);
    });
    
    protonet
      .on("socket.initialized",   this.initializeCallback.bind(this))
      .on("socket.reinitialize",  this.reinitialize.bind(this))
      .on("socket.connected",     this.connectCallback.bind(this))
      .on("socket.send",          this.send.bind(this))
      .on("socket.receive",       this.receive.bind(this))
      .on("socket.ping_received", this.pingCallback.bind(this));
    
    $window
      .bind("offline unload", this.disconnect.bind(this))
      .bind("online focus",   this.connect.bind(this));
  },
  
  create: function() {
    var queryParams = location.search, i;
    if (queryParams.indexOf("noflash=1") !== -1 || protonet.config.incoming_interface === "published_to_web") {
      delete this.provider.FlashSocket;
    }
    
    if (queryParams.indexOf("forcexhr=1") !== -1) {
      this.provider = { HttpStreaming: this.provider.HttpStreaming };
    }
    
    for (i in this.provider) {
      if (this.provider[i].isSupported()) {
        this.currentProvider = this.provider[i];
        break;
      }
    }
    //this.currentProvider = this.provider.WebSocket;
    this.currentProvider && this.currentProvider.initialize();
  },
  
  connect: function() {
    if (this.connected || !this.initialized) {
      return;
    }
    
    this.currentProvider.connect();
  },
  
  connectCallback: function(status) {
    if (status) {
      this.connected = true;
      this.startCheck();
      if (this._reconnect) {
        this._reconnect = false;
        protonet.trigger("socket.reconnected");
      }
    } else {
      this.disconnect();
    }
  },
  
  disconnect: function(event) {
    this.currentProvider.disconnect();
    
    this.stopCheck();
    
    this.startReconnect();
    
    // Don't show a flash message when user closes the window
    var isUnload = (event || {}).type == "unload";
    
    // ... also only shout it to the world when the socket has been online before
    if (this.connected === true && !isUnload) {
      protonet.trigger("socket.disconnected");
    }
    
    if (this.connected === undefined && !isUnload) {
      protonet.trigger("flash_message.error", "SOCKET_FAILURE");
    }
    
    this.connected = false;
  },
  
  stopReconnect: function() {
    this._reconnect = false;
    clearTimeout(this.reconnectTimeout);
  },
  
  startReconnect: function() {
    this.stopReconnect();
    this._reconnect = true;
    this.reconnectTimeout = setTimeout(this.connect.bind(this), 5000);
  },
  
  reconnect: function() {
    this.disconnect();
    setTimeout(this.connect.bind(this), 1000);
  },
  
  /**
   * Send data to socket every 20 seconds
   * If no answer is received after 5 seconds the socket appears to be offline
   * Try to reconnect after 5 seconds
   */
  startCheck: function() {
    this.stopCheck();
    this.checkInterval = setInterval(this.ping.bind(this), 20000);
  },
  
  stopCheck: function() {
    clearInterval(this.checkInterval);
  },
  
  ping: function() {
    clearTimeout(this.offlineTimeout);
    this.offlineTimeout = setTimeout(this.disconnect.bind(this), 5000);
    
    protonet.trigger("socket.send", { operation: "ping" });
  },
  
  pingCallback: function() {
    clearTimeout(this.offlineTimeout);
  },

  receive: function(data) {
    var dataArr = this.currentProvider.receive(data);
    
    if (!dataArr) {
      return;
    }
    
    dataArr = $.makeArray(dataArr);
    $.each(dataArr, function(i, data) {
      var trigger = data.trigger || data.operation;
      if (trigger) {
        protonet.trigger(trigger, data);
      } else if (data.eval) {
        eval(data.eval);
      }
    });
  },
  
  send: function(data) {
    this.currentProvider.send(data);
  }
};
protonet.dispatcher.provider = {}