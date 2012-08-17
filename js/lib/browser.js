protonet.browser = {
  SUPPORTS_WEBSOCKET: function() {
    return !!window.WebSocket;
  },
  
  SUPPORTS_POST_MESSAGE_BETWEEN_POPUPS: function() {
    // window.DOMParser is only supported in IE versions 9+
    // IE 8 supports postMessage but not between popups
    return "postMessage" in window && "DOMParser" in window;
  },
  
  SUPPORTS_NOTIFICATIONS: function() {
    return "webkitNotifications" in window;
  },
  
  SUPPORTS_EVENT: (function() {
    // Some events are hard/impossible to feature-detect
    var browserSniffing = {
      "DOMMouseScroll": $.browser.mozilla
    };
    
    return function(eventName) {
      if (browserSniffing[eventName]) {
        return true;
      }
      
      var testElement = document.createElement("div");
      eventName = "on" + eventName;
      var isSupported = (eventName in testElement);
      if (!isSupported) {
        testElement.setAttribute(eventName, "return;");
        isSupported = typeof(testElement[eventName]) == "function";
      }
      testElement = null;
      return isSupported;
    };
  })(),
  
  IS_TOUCH_DEVICE: function() {
    return this.SUPPORTS_EVENT("touchmove");
  },
  
  IS_IOS: function() {
    return navigator.userAgent.match(/(iphone|ipod|ipad)/);
  },
  
  /**
   * Whether the browser supports HTML5 placeholder attributes
   * <input placeholder="Enter Text">
   */
  SUPPORTS_PLACEHOLDER: function() {
    return "placeholder" in document.createElement("input");
  },
  
  HAS_FLASH: (function() {
    var cache = {};
    return function(version) {
      if (typeof(cache[version]) === "undefined") {
        cache[version] = !!window.swfobject && swfobject.hasFlashPlayerVersion(version + "");
      }
      return cache[version];
    };
  })(),
  
  IS_ANDROID_WEBKIT: function() {
    var userAgent = navigator.userAgent.toLowerCase();
    return userAgent.indexOf("android") !== -1 && userAgent.indexOf("webkit") !== -1;
  },
  
  IS_SAFARI: function() {
    return $.browser.safari && !navigator.userAgent.match(/chrome/i);
  },
  
  IS_CHROME: function() {
    return !protonet.browser.IS_SAFARI() && protonet.browser.testCSS("WebkitTransform");
  },
  
  IS_FF: function() {
    return protonet.browser.testCSS('MozBoxSizing'); 
  },
  
  SUPPORTS_ONLINE_DETECTION: function() {
    return "onLine" in navigator && navigator.userAgent.match(/chrome/i);
  },

  testCSS: function(prop) {
    // browser CSS feature detection
    return prop in document.documentElement.style;
  }
};