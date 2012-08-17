window.$window   = $(window);

$(document).ready(function() {
  var $widget      = $('#widget'),
      $timeline    = $('#timeline'),
      $chatMessage = $('#chat-message'),
      $scrollInput = $("<input type='text'>");

      EXPIRES_IN   = 604800000;
      API_URL      = protonet.config.api_url;

  $widget.find('nav a').on('mouseover click', function(event){
    var $this = $(this);
    event.preventDefault();

    $widget.find('.active').removeClass('active');
    $widget.find('#' + $this.attr("class")).addClass("active");
    $this.addClass("active");
    if($this.hasClass("widget-livechat")) {
      scrollToBottom();
    };

    $(document.body).bind('mouseover.widget', function(event){
      if ($(event.target).parents('#widget').length == 0) {
        $(document.body).unbind('mouseover.widget');
        $widget.find('.active').removeClass('active');
      };
    });
  });

  if (!protonet.browser.SUPPORTS_WEBSOCKET() || offTime() == true) {
    $('.widget-livechat').hide();
    $widget.css({
      "min-height": "97px"
    });
    return
  };

  if (protonet.config.user){
    if ((new Date - new Date(protonet.config.user[0].created_at) ) > EXPIRES_IN ) {
      protonet.config.user = null;
    }else{
      $.getJSON(API_URL + 'update/'+ protonet.config.user[0].user_id +'?callback=?', function(data){
        protonet.config.user = data;
      });
    }
  } 

  if (protonet.config.user) {
    // establish connection and sync meeps
    $timeline.empty();
    protonet.dispatcher.initialize();
    protonet.dispatcher.onready(function(){
      protonet.trigger("socket.send", {
        operation:  "sync",
        payload:    {
          limit: 20
        }
      });
    });
    
    $('form#live-chat').bind("submit", onSubmit);

  }else{
    $('form#live-chat').bind("submit.first", function(event){
      event.preventDefault();
      $chatMessage.prop('disabled', true);
      $timeline.empty();
      $.getJSON(API_URL + 'start?callback=?', function(data){
        protonet.config.user = data;
        store.set('user', data);

        protonet.dispatcher.initialize();
        protonet.dispatcher.onready(function(){
          sendMeep({
            message: $chatMessage.val(),
            channel_id: protonet.config.user[0].channel_id,
            user_id: protonet.config.user[0].user_id
          });
          $chatMessage
            .prop('disabled', false)
            .val("");
          $('form#live-chat')
            .unbind("submit.first")
            .bind("submit", onSubmit);
        });
      });        
    });
  };
 
  function offTime(){
    var now = new Date(),
      day   = now.getDay(),
      hours = now.getHours();

    if ( day == 6 || day == 0 || hours < 10 || hours > 17) {
      return true;
    }else{
      return false;
    }
  }

  function onSubmit(event){
    event.preventDefault();
    var meep = {
          message: $chatMessage.val(),
          channel_id: protonet.config.user[0].channel_id,
          user_id: protonet.config.user[0].user_id
        }
    sendMeep(meep);
    $chatMessage.val("");
  }

  function sendMeep(meep){
    protonet.trigger("socket.send", {
      operation:  "meep.create",
      payload:    meep
    });
  }

  function safe_tags(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') ;
  }

  function renderMeep(data){
    var $meep = $("<li>" + safe_tags(data.message) + "</li>");
    if (data.user_id == protonet.config.user[0].user_id) {
      $meep.prepend("<span>You: </span>");
    }else{
      $meep.prepend("<span>Team: </span>");
      $meep.addClass("team");
    }
    $timeline.append($meep);
    scrollToBottom();
  }

  function scrollToBottom(){
    $scrollInput.appendTo($timeline);
    $scrollInput.focus();
    $scrollInput.detach();
    $chatMessage.focus();
  }

  protonet.on("sync.received", function(data){
    $.each(data[protonet.config.user[0].channel_id], function(i, meep){
      renderMeep(meep);
    });
  });

  protonet.on("meep.receive", function(data){
    renderMeep(data);
  });

});
