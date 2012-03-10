(function() {
	
	var touchplay = null;
	var elapsedtime = 0;
	var jplayer = null;
	var nickname = null;
	var socket = null;
	var pvtmsgto = null;
	var roundpoints = 0;
	var stopanimation = false;
	var states = ['A song is already playing, please wait for the next one...',
			'Game is about to start...', 'Game is over', 'New game will start soon...'];
	var tmstrings = ['Yes, you guessed the title. Who is the artist?', 'Now tell me the artist!',
					'Correct, do you also know the artist?'];
	var amstrings = ['Yes, that\'s the artist. What about the title?', 'Exactly, now tell me the title!',
					'Do you also know the title?'];
	var bmstrings = ['Yeah true! do you like this track?', 'Good job!', 'Great!',
					'Very well done!', 'Exactly!', 'Excellent!'];
	var nmstrings = ['Nope, sorry!', 'No way!', 'Fail', 'Nope', 'No', 'That\'s wrong', 'What?!',
				'Wrong', 'Haha, what?!', 'You kidding?', 'Don\'t make me laugh', 'You mad?'];
	
	// Prompt for name and send it.
	var setNickName = function(msg) {
		if (!msg) {
			msg = "What's your name?";

			var html = '<div class="modal-header"><h3>Welcome to Binb</h3></div>';
			html += '<div class="modal-body"><p>'+msg+'</p></div>';
			html += '<div class="modal-footer">';
			html += '<input id="login" class="" type="text" name="nickname" />';
			html += '<button id="join" class="btn btn-primary">';
			html += '<i class="icon-user icon-white"></i> Join the game</button></div>';

			$(html).appendTo($('#modal'));
			var login = $('#login');
			var button = $('#join');
			button.click(function() {
				var val = $.trim(login.val());
				if (val !== "") {
					nickname = val;
					socket.emit('setnickname', nickname);
				}
				else {
					var txt = "Nickname can't be empty.";
					invalidNickName({feedback:'<span class="label label-important">'+txt+'</span>'});
				}
				login.val("");
			});
			login.keyup(function(event) {
				if (event.keyCode === 13) {
					button.click();	
				}
			});
			$('#modal').modal('show');
			$('#modal').on('shown', function() {
				login.focus();	
			});
		}
		else {
			$('.modal-body p').html(msg);
			$('#login').focus();
		}
	};

	// Your submitted name was invalid
	var invalidNickName = function(data) {
		setNickName(data.feedback+"<br/>Try again:");
	};
	
	// You joined the game
	var ready = function(data) {
		$('#modal').modal('hide').empty();
		$('#total-tracks span').text(data.trackscount);
		var msg = nickname+" joined the game";
		var joinspan = $("<span class='join'></span>");
		joinspan.text(msg);
		addChatEntry(joinspan);
		updateUsers(data);

		var messagebox = $("#message");
		messagebox.keyup(function(event) {
			if (event.keyCode === 13) {
				var val = $.trim(messagebox.val());
				if (val !== "") {
					var data = (pvtmsgto) ? {to:pvtmsgto,chatmsg:val} : val;
					socket.emit('sendchatmsg', data);
				}
				messagebox.val("");
			}
		});
		var guessbox = $("#guess");
		guessbox.keyup(function(event) {
			if (event.keyCode === 13) {
				var val = $.trim(guessbox.val().toLowerCase());
				if (val !== "") {
					socket.emit('guess', val);
				}
				guessbox.val("");
			}
		});
		$("#guess").focus();
		
		socket.on('newuser', userJoin);
		socket.on('userleft', userLeft);
		socket.on('updateusers', updateUsers);
		socket.on('chatmsg', getChatMessage);
		socket.on('loadtrack', loadTrack);
		socket.on('playtrack', playTrack);
		socket.on('trackinfo', addTrackInfo);
		socket.on('artistmatched', function() {
			var feedback = amstrings[Math.floor(Math.random()*amstrings.length)];
			addFeedback(feedback, "correct");
		});
		socket.on('titlematched', function() {
			var feedback = tmstrings[Math.floor(Math.random()*tmstrings.length)];
			addFeedback(feedback, "correct");
		});
		socket.on('bothmatched', function() {
			var feedback = bmstrings[Math.floor(Math.random()*bmstrings.length)];
			addFeedback(feedback, "correct");
		});
		socket.on('nomatch', function() {
			var feedback = nmstrings[Math.floor(Math.random()*nmstrings.length)];
			addFeedback(feedback, "wrong");
		});
		socket.on('stoptrying', function() {
			addFeedback('You guessed both artist and title. Please wait...');
		});
		socket.on('noguesstime', function() {
			addFeedback('You have to wait the next song...', "wrong");
		});
		socket.on('gameover', gameOver);
		socket.on('status', setStatus);
		socket.emit('getstatus');
	};

	var setStatus = function(data) {
		if (data.status === 0) {
			cassetteAnimation(Date.now()+data.timeleft, true);
		}
		if (data.status === 1) {
			loadTrack(data);
		}
		addFeedback(states[data.status]);
	};

	// A new player joined the game
	var userJoin = function(data) {
		var msg = data.nickname+" joined the game";
		var joinspan = $("<span class='join'></span>");
		joinspan.text(msg);
		addChatEntry(joinspan);
		updateUsers(data);
	};

	// A user left the game
	var userLeft = function(data) {
		var leftmsg = data.nickname+" left the game";
		var leftspan = $("<span class='left'></span>");
		leftspan.text(leftmsg);
		addChatEntry(leftspan);
		updateUsers(data);
	};

	// Update the list of users
	var updateUsers = function(data) {
		var elem = $("#users");
		elem.empty();
		var users = [];
		for (var key in data.users) {
			users.push(data.users[key]);
		}
		users.sort(function(a, b) {return b.points - a.points;});
		// Flag to test if our private recipient is in the list of active users
		var found = false;
		for (var i=0; i<users.length; i++) {
			var user = users[i];
			var li = $('<li></li>');
			var pvt = $('<span class="private label label-info">P</span>');
			var username = $('<span class="name"></span>').text(user.nickname);
			var points = $('<span class="points">('+user.points+')</span>');
			var roundrank = $('<span></span>');
			var roundpointsel = $('<span class="round-points"></span>');
			li.append(pvt, username, points, roundrank, roundpointsel);
			elem.append(li);
			if (pvtmsgto === user.nickname) {
				pvt.show();
				username.click(clearPrivate);
				found = true;
			}
			else {
				username.click(function() {
					addPrivate($(this).text());
				});
			}
			if (nickname === user.nickname) {
				username.addClass("you");
				roundpoints = user.roundpoints;
				$('#summary .rank').text(i+1);
				$('#summary .points').text(user.points);
			}
			if (user.roundpoints > 0) {
				roundpointsel.text('+'+user.roundpoints);
				if (user.roundpoints === 1) {
					username.addClass("matched");
				}
				else {
					if (user.roundpoints > 3) {
						var stand = 7 - user.roundpoints;
						roundrank.addClass("round-rank stand"+stand);
					}
					username.addClass("correct");
				}
			}
		}
		if (!found && pvtmsgto) {
			var recipient = $('#recipient');
			var width = recipient.outerWidth(true) + 1;
			recipient.css('margin-right','0');
			recipient.text("");
			$('#message').animate({'width':'+='+width+'px'}, "fast");
			pvtmsgto = null;
			$("#message").focus();
		}
	};
	
	var addPrivate = function(usrname) {
		if (pvtmsgto) {
			clearPrivate();
		}
		if (nickname === usrname) {
			return;
		}
		var recipient = $("#recipient");
		recipient.css('margin-right','4px');
		recipient.text("To "+usrname+":");
		var width = recipient.outerWidth(true) + 1;
		recipient.hide();
		$('#message').animate({'width':'-='+width+'px'}, "fast", function() {recipient.show();});
		var el = $("span.name:contains("+usrname+")");
		el.prev().show();
		el.unbind('click');
		el.click(clearPrivate);
		pvtmsgto = usrname;
		$("#message").focus();
	};

	var clearPrivate = function() {
		var recipient = $("#recipient");
		var width = recipient.outerWidth(true) + 1;
		recipient.css('margin-right','0');
		recipient.text("");
		$('#message').animate({'width':'+='+width+'px'}, "fast");
		var el = $("span.name:contains("+pvtmsgto+")");
		el.prev().hide();
		el.unbind("click");
		el.click(function() {
			addPrivate($(this).text());
		});
		pvtmsgto = null;
		$("#message").focus();
	};

	// Receive a chat message
	var getChatMessage = function(data) {
		var prefix = data.from;
		var msgspan = $("<span class='message'></span>");
		if (data.to) {
			// Private Message
			prefix = (nickname === data.from) ? '(To '+data.to+')' : '(From '+prefix+')';
			msgspan.addClass("private");
		}
		var msg = prefix+": "+data.chatmsg;
		msgspan.text(msg);
		addChatEntry(msgspan);
	};

	var loadTrack = function(data) {
		jplayer.jPlayer("mute");
		jplayer.jPlayer("setMedia", {m4a: data.previewUrl});
	};

	// Play a track 
	var playTrack = function(data) {
		if (touchplay) {
			touchplay.removeClass("btn-danger disabled").addClass("btn-success");
			touchplay.html('<i class="icon-play icon-white"></i> Play');
		}
		jplayer.jPlayer("unmute");
		jplayer.jPlayer("play");
		updateUsers(data);
		cassetteAnimation(Date.now()+30000, true);
		if (data.counter === 1) {
			$('#modal').modal('hide').empty();
			$('#tracks').empty();
		}
		$('#summary .track').text(data.counter+'/'+data.tot);
		addFeedback('What is this song?');
	};

	// Start cassette animation
	var cassetteAnimation = function(endtime, forward) {
		var millisleft = endtime - Date.now();
		var secleft = millisleft / 1000;
		var width, deg, offsetleft, offsetright, css;
		if (forward) {
			width = 148 - (148*secleft/30);
			deg = 360 - (360*secleft/30);
			offsetleft = 44 - 24*secleft/30;
			offsetright = 130 - 24*secleft/30;
			$('#progress').width(width);
			css = {
				'-moz-transform' : 'rotate('+deg+'deg)',
				'-webkit-transform' : 'rotate('+deg+'deg)',
				'-o-transform' : 'rotate('+deg+'deg)',
				'-ms-transform' : 'rotate('+deg+'deg)',
				'transform' : 'rotate('+deg+'deg)'
			};
			$('#cassette .wheel').css(css);
			$('#tape-left').css('left', offsetleft+'px');
			$('#tape-right').css('left', offsetright+'px');
		}
		else {
			width = 148*secleft/5;
			deg = 360*secleft/5;
			offsetleft = 20 + 24*secleft/5;
			offsetright = 106 + 24*secleft/5;
			$('#progress').width(width);
			css = {
				'-moz-transform' : 'rotate('+deg+'deg)',
				'-webkit-transform' : 'rotate('+deg+'deg)',
				'-o-transform' : 'rotate('+deg+'deg)',
				'-ms-transform' : 'rotate('+deg+'deg)',
				'transform' : 'rotate('+deg+'deg)'
			};
			$('#cassette .wheel').css(css);
			$('#tape-left').css('left', offsetleft+'px');
			$('#tape-right').css('left', offsetright+'px');
		}
		if (forward) {
			$('#countdown').text(secleft.toFixed(1));
			if (touchplay) {elapsedtime = 30 - Math.round(secleft);}
		}
		else {
			$('#countdown').text(Math.round(secleft));
		}
		if (stopanimation || millisleft < 50) {
			return;
		}
		setTimeout(function() {cassetteAnimation(endtime, forward);}, 50);
	};

	// Add track info
	var addTrackInfo = function(data) {
		if (touchplay) {
			touchplay.removeClass("btn-success").addClass("btn-danger disabled");
			touchplay.html('<i class="icon-play icon-white"></i> Wait');
		}
		cassetteAnimation(Date.now()+5000, false);
		var html = '<li class="bordered"><img class="artwork" src="'+data.artworkUrl+'"/>';
		html += '<div class="info"><div class="artist">'+data.artistName+'</div>';
		var titleattr = '';
		var trackname = data.trackName;
		if (data.trackName.length > 45) {
			titleattr = data.trackName;
			trackname = data.trackName.substring(0,42) + '...';
		}
		html += '<div class="title" title="'+titleattr+'">'+trackname+'</div></div>';
		var attrs = '';
		var rp = '';
		if (roundpoints > 0) {
			rp = '+'+roundpoints;
			if (roundpoints > 3) {
				var stand = 7 - roundpoints;
				attrs += 'class="round-rank stand'+stand+'"';
			}
		}
		html += '<div '+attrs+'></div><div class="round-points">'+rp+'</div>';
		html += '<a target="_blank" href="'+data.trackViewUrl+'">';
		html += '<img src="/static/images/itunes.png"/></a></li>';
		$('#tracks').prepend($(html));
	};

	// Game over countdown
	var countDown = function(endtime) {
		var millisleft = endtime - Date.now();
		var secleft = millisleft / 1000;
		$('.modal-footer span').text(Math.round(secleft));
		if (millisleft < 200) {
			return;
		}
		setTimeout(function() {countDown(endtime);}, 200);
	};

	var gameOver = function(data) {
		var users = [];
		for (var key in data.users) {
			users.push(data.users[key]);
		}
		users.sort(function(a, b) {return b.points - a.points;});
		var html = '<div class="modal-header"><h3>Game Over</h3></div>';
		html += '<div class="modal-body">';
		for(var i=0;i<3;i++) {
			if (users[i]) {
				var rank = i+1;
				var offset = -16 + (-32 * i);
				var style = ' style="background:url(/static/images/sprites.png)';
				style += ' no-repeat 0px '+offset+'px;"';
				html += '<div class="gameover"'+style+'>'+rank+')';
				html += ' <span class="name">'+users[i].nickname;
				html += '</span>('+users[i].points+')</div>';
			}
		}
		html +='</div>';
		html += '<div class="modal-footer">A new game will start in <span></span> second/s</div>';
		$('#modal').append($(html));
		$('#modal').modal('show');
		countDown(Date.now()+10000);
	};

	// Let the user know when he / she has disconnected
	var disconnect = function() {
		stopanimation = true;
		jplayer.jPlayer("stop");
		var errormsg = "ERROR: You have disconnected.";
		var errorspan = $("<span class='error'></span>");
		errorspan.text(errormsg);
		addChatEntry(errorspan);
		addFeedback('Something wrong happened');
		var users = $("#users");
		users.empty();
	};

	// Add a chat entry, whether message, notification, etc.
	var addChatEntry = function(childNode) {
		var li = $("<li class='entry'></li>");
		li.append(childNode);
		var chat = $("#chat");
		chat.append(li);
		var chatRaw = document.getElementById("chat");
		chatRaw.scrollTop = chatRaw.scrollHeight;
	};

	var addFeedback = function(txt, style) {
		if (typeof style === 'string') {
			var fbspan = $('<span class="'+style+'"></span>');
			fbspan.text(txt);
			$('#feedback').html(fbspan);
			return;
		}
		$('#feedback').text(txt);
	};

	var addVolumeControl = function() {
		var volumebutton = $('<div id="volume-button">'+
								'<a class="button"><div id="icon" class="volume-high"></div></a>'+           
								'<div id="volume-slider">'+ // Outer background
									'<div id="volume-total"></div>'+ // Rail
									'<div id="volume-current"></div>'+ // Current volume
									'<div id="volume-handle"></div>'+ // Handle
								'</div>'+
							'</div>').appendTo("#volume");
		var icon = volumebutton.find('#icon');
		var volumeslider = volumebutton.find('#volume-slider');
		var volumetotal = volumebutton.find('#volume-total');
		var volumecurrent = volumebutton.find('#volume-current');
		var volumehandle = volumebutton.find('#volume-handle');
		var mouseisdown = false;
		var mouseisover = false;
		var oldvalue = 1;
		var clicked = false;

		var positionVolumeHandle = function(volume) {
			if (!volumeslider.is(':visible')) {
				volumeslider.show();
				positionVolumeHandle(volume);
				volumeslider.hide();
				return;
			}
			var totalheight = volumetotal.height();
			var totalposition = volumetotal.position();
			var newtop = totalheight - (totalheight * volume);
			volumehandle.css('top', totalposition.top + newtop - (volumehandle.height() / 2));
			volumecurrent.height(totalheight - newtop );
			volumecurrent.css('top', totalposition.top + newtop);
		};

		var handleIcon = function (volume) {
			if (volume === 0) {
				icon.removeClass().addClass('volume-none');
			}
			else if (volume <= 0.33) {
				icon.removeClass().addClass('volume-low');
			}
			else if (volume <= 0.66) {
				icon.removeClass().addClass('volume-medium');
			}
			else {
				icon.removeClass().addClass('volume-high');
			}
		};

		var setVolume = function(volume) {
			handleIcon(volume);
			oldvalue = volume;
			jplayer.jPlayer("volume", volume);
		};

		var handleVolumeMove = function(e) {
			var totaloffset = volumetotal.offset();
			var newy = e.pageY - totaloffset.top;
			var railheight = volumetotal.height();
			var totalTop = parseInt(volumetotal.css('top').replace(/px/,''),10);
			var volume = (railheight - newy) / railheight;		

			if (newy < 0) {
				newy = 0;
			}
			else if (newy > railheight) {
				newy = railheight;
			}

			volumehandle.css('top', totalTop + newy - (volumehandle.height() / 2));
			volumecurrent.height(railheight - newy);
			volumecurrent.css('top',newy+totalTop);

			volume = Math.max(0,volume);
			volume = Math.min(volume,1);

			setVolume(volume);
			
			var d = new Date();
			d.setTime(d.getTime() + 31536000000); // One year in milliseconds
			document.cookie = "volume="+volume+";path=/;expires="+d.toGMTString()+";";
		};

		var loadFromCookie = function() {
			if (/volume\s*\=/.test(document.cookie)) {
				var value = document.cookie.replace(/.*volume\s*\=\s*([^;]*);?.*/, "$1");
				value = parseFloat(value);
				positionVolumeHandle(value);
				setVolume(value);
			}
			else {
				positionVolumeHandle(1);
			}
		};

		volumebutton.hover(function() {
			volumeslider.show();
			mouseisover = true;
		}, function() {
			mouseisover = false;
			if (!mouseisdown)    {
				volumeslider.hide();
			}
		});
		
		volumeslider.on('mouseover', function() {
			mouseisover = true;
		}).on('mousedown', function (e) {
			handleVolumeMove(e);
			mouseisdown = true;
			return false;
		});

		$(document).on('mouseup', function (e) {
			mouseisdown = false;
			if (!mouseisover) {
				volumeslider.hide();
			}
		}).on('mousemove', function (e) {
			if (mouseisdown) {
				handleVolumeMove(e);
			}
		});

		volumebutton.find('.button').click(function() {
			if (!clicked) {
				clicked = true;
				if (oldvalue !== 0) {
					jplayer.jPlayer("volume", 0);
					positionVolumeHandle(0);
					handleIcon(0);
				}
			}
			else {
				clicked = false;
				if (oldvalue !== 0) {
					jplayer.jPlayer("volume", oldvalue);
					positionVolumeHandle(oldvalue);
					handleIcon(oldvalue);
				}
			}
		});
		loadFromCookie();
	};

	// Set up the App.
	$(function() {
		$('#modal').modal({keyboard:false,show:false,backdrop:"static"});
		if ($.browser.mozilla) {
			// Block ESC button in firefox (it breaks all socket connection).
			$(document).keypress(function(event) {
				if(event.keyCode === 27) {
					return false;
				}
			});
		}
		socket = io.connect("http://binb.nodejitsu.com/", {'reconnect':false});
		socket.on("connect", function() {
			jplayer = $("#player").jPlayer({
				ready: function() {
					setNickName();
					if (!$.jPlayer.platform.mobile && !$.jPlayer.platform.tablet) {
						addVolumeControl();
					}
					else {
						var touchbackdrop = $('<div id="touch-backdrop">'+
							'<button id="touch-play" class="btn btn-danger disabled">'+
								'<i class="icon-play icon-white"></i> Wait'+
							'</button></div>').appendTo("#cassette");
						touchplay = $('#touch-play');
						touchplay.click(function() {
							if (!$(this).hasClass("btn-danger")) {
								touchplay = null;
								jplayer.jPlayer('play', elapsedtime);
								touchbackdrop.remove();
							}
						});
					}
				},
				swfPath: "/static/swf/",
				supplied: "m4a",
				preload: "auto",
				volume: 1
			});
		});
		socket.on('invalidnickname', invalidNickName);
		socket.on('ready', ready);
		socket.on("disconnect", disconnect);
	});
})();
