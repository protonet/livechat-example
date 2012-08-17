protonet.utils = {}
protonet.utils.Sandbox = (function() {
  function _createIframe() {
    return $("<iframe>", {
      width:              1,
      height:             1,
      frameborder:        0,
      marginheight:       0,
      marginwidth:        0,
      allowtransparency:  "true"
    }).css({
      position: "absolute"
    });
  }
  
  var Sandbox = function() {
    this.iframe = _createIframe();
    return this;
  };
  
  Sandbox.prototype = {
    appendTo: function(element) {
      this.iframe.appendTo(element);
      return this;
    },
    
    load: function(callback) {
      this.iframe.one("load", function() {
        callback(this.contentWindow);
      });
      return this;
    }
  };
  
  return Sandbox;
})();

/**
 * Recommended to read
 * http://stackoverflow.com/questions/169258/is-http-streaming-comet-possible-in-safari
 * http://www.shanison.com/2010/05/10/stop-the-browser-%E2%80%9Cthrobber-of-doom%E2%80%9D-while-loading-comet-forever-iframe/
 */
protonet.dispatcher.provider.HttpStreaming = (function() {
  var SCRIPT_REG_EXP = /<script>[\s\S]*?<\/script>/mg;
  
  return {
    isSupported: function() {
      return true;
    },

    initialize: function() {
      protonet.trigger("socket.initialized");
      this.observe();
    },
    
    observe: function() {
      /**
       * Update socket id
       */
      protonet.on("socket.update_id", function(data) {
        this.socketId = data.socket_id;
      }.bind(this));
    },

    connect: function() {
      // We need to start the xhr streaming from a hidden iframe
      // since Chrome/Safari show a loading indicator for active xhr requests
      // that were started before the onload event
      var sandbox = new protonet.utils.Sandbox();
      sandbox.load(function(win) {
        win.setTimeout(this._connect.bind(this, win), 100);
      }.bind(this)).appendTo("body");
    },
    
    _buildUrl: function(additionalData) {
      var data  = $.extend({
            user_id:  protonet.config.user_id,
            token:    protonet.config.token,
            type:     "web"
          }, additionalData),
          queryParams         = encodeURIComponent(JSON.stringify(data)),
          url                 = protonet.config.xhr_streaming_url + "?" + queryParams;
      
      return url;
    },
    
    _connect: function(win) {
      win = win || window;
      var byteOffset          = 0,
          url                 = this._buildUrl(),
          connected,
          undef,
          abortOldRequest     = (function(oldRequest) {
            return function() {
              if (oldRequest) {
                oldRequest.abort();
                oldRequest = undef;
              }
            };
          })(this.ajax);
      
      clearTimeout(this.reconnectTimeout);
      
      // Use IE-proprietary XDomainRequest for same-origin requests
      // XMLHttpRequest doesn't work with http streaming since IE refuses to fill the responseText
      // property unless readyState == 4
      if (win.XDomainRequest) {
        this.ajax = new win.XDomainRequest();
        this.ajax.onprogress = function() {
          if (this.ajax.readyState >= 3) {
            abortOldRequest();
          }
          
          if (connected === undef) {
            connected = true;
            protonet.trigger("socket.connected", connected);
          }
          
          if (this.ajax.responseText.length === byteOffset) {
            return;
          }
          
          var responseText = this.ajax.responseText || "",
              rawData      = responseText.substring(byteOffset);
          byteOffset = responseText.length;
          protonet.trigger("socket.receive", rawData);
        }.bind(this);
        this.ajax.onload = function() {
          if (this._activeForMoreThan10seconds(this.ajax)) {
            this._connect(win);
          }
        }.bind(this);
      } else {
        this.ajax = new win.XMLHttpRequest();
        this.ajax.onreadystatechange = function() {
          if (this.ajax.readyState >= 3) {
            abortOldRequest();
          }
          
          if (this.ajax.readyState >= 3 && connected === undef) {
            connected = (this.ajax.status === 200);
            protonet.trigger("socket.connected", connected);
          }

          if (!connected) {
            return;
          }
          
          if (this._hasReceivedData(this.ajax)) {
            var responseText = this.ajax.responseText || "",
                rawData      = responseText.substr(byteOffset),
                boundary     = rawData.lastIndexOf("<\/script>");
            if (boundary !== -1) {
              rawData = rawData.substr(0, boundary + 9);
              byteOffset = byteOffset + rawData.length;
              protonet.trigger("socket.receive", rawData);
            }
          }

          if (this._shouldReconnect(this.ajax)) {
            this._connect(win);
          }
        }.bind(this);
      }
      
      this.ajax.activeSince = new Date();
      this.ajax.open("GET", url, true);
      this.ajax.send(null);
      
      // iOS can only keep a request open for 60 seconds
      // So we open a new socket connection after 55 seconds to make sure the user function doesn't go offline
      // during reconnect
      this.reconnectTimeout = setTimeout(this._connect.bind(this, win), 55000);
    },
    
    _shouldReconnect: function(request) {
      return  request.readyState  === 4 &&
              (
                request.status    === 200 ||
                // 0 === request got aborted (iOS seems to have a request timeout after 60 sec)
                request.status    === 0
              ) && this._activeForMoreThan10seconds(request);
    },
    
    _activeForMoreThan10seconds: function(request) {
      var now = new Date();
      return (now - request.activeSince) > 10000;
    },
    
    _hasReceivedData: function(currentRequest) {
      return currentRequest.readyState >= 3;
    },
    
    disconnect: function() {
      this.ajax && this.ajax.abort();
    },

    send: function(data) {
      var url = this._buildUrl({ socket_id: this.socketId });
      $.ajax(url, {
        type: "POST",
        crossDomain: true,
        data: JSON.stringify(data)
      });
    },

    receive: function(rawData) {
      var scripts = rawData.match(SCRIPT_REG_EXP) || [];
      
      return $.map(scripts, function(script) {
        // remove <script> and </script> from string
        script = script.substring(8);
        script = script.substring(0, script.length - 9);
        script = $.trim(script);
        
        try {
          var json = JSON.parse(script);
          if (json) {
            return json;
          }
        } catch(e) {}
        
        // null will not be captured in the resulting array created by $.map
        return null;
      });
    }
  };
})();
