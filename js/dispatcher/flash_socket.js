protonet.dispatcher.provider.FlashSocket = {
  isSupported: function() {
    return protonet.browser.HAS_FLASH(8);
  },
  
  initialize: function() {
    // We have to insert the flash outside the body in firefox, otherwise the flash gets reloaded as soon as you
    // change the css overflow property of the body element
    // see https://bugzilla.mozilla.org/show_bug.cgi?id=90268
    // (fixed in firefox 13)
    var isBuggy     = $.browser.mozilla && !!window.globalStorage,
        container   = $("<div>", { id: "socket-container" }).appendTo(isBuggy ? "html" : "body"),
        attributes  = { id: "flash-socket" },
        params      = { allowscriptaccess: "sameDomain", wmode: "opaque" };
    
    this.retries = 0;
    
    // Fires "socket.initialized" when ready
    swfobject.embedSWF(
      "/flash/socket.swf?" + new Date().getTime(),
      "socket-container",
      "auto", "auto", "8",
      null, {}, params, attributes
    );
  },
  
  _authenticate: function(connected) {
    if (!connected) {
      return false;
    }
    
    this.send({
      operation: "authenticate",
      payload: {
        user_id:  protonet.config.user.user_id,
        token:    protonet.config.user.communication_token,
        type:     "web"
      }
    });
  },
  
  connect: function() {
    this.socket = this.socket || swfobject.getObjectById("flash-socket");
    if (!this.socket) {
      // User is probably using a flash blocker
      return;
    }
    
    if (!this.socket.connectSocket) {
      // Retry a couple of times... IE needs this.
      if (++this.retries > 15) {
        protonet.trigger("socket.connected", false);
      } else {
        setTimeout(this.connect.bind(this), 250);
      }
      return;
    }
    
    this.socket.connectSocket(protonet.config.dispatching_server, protonet.config.dispatching_server_port);
    
    // the flash socket will trigger the socket.connected event
    this._authenticateMethod = this._authenticateMethod || this._authenticate.bind(this);
    
    // Make sure that we unbind old listeners first
    protonet
      .off("socket.connected", this._authenticateMethod)
      .on("socket.connected", this._authenticateMethod);
  },
  
  disconnect: function() {
    if (!this.socket || !this.socket.closeSocket) {
      return;
    }
    this.socket.closeSocket();
    this.retries = 0;
  },
  
  send: function(data) {
    if (!this.socket || !this.socket.sendData) {
      return;
    }
    this.socket.sendData(JSON.stringify(data));
  },
  
  receive: function(rawData) {
    /**
     * Policy XML message
     * FIXME: Handle this in the flash socket
     */
    if ($.trim(rawData).startsWith("<?xml")) {
      return;
    }
    
    return JSON.parse(rawData);
  }
};