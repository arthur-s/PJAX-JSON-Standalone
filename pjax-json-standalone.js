/**!
 * PJAX JSON Standalone
 *
 * Standalone implementation of Pushstate with JSON AJAX, for non-jQuery web pages.
 * Based on Carl's PJAX Standalone, see https://github.com/thybag/PJAX-Standalone
 * jQuery are recommended to use the original implementation at: http://github.com/defunkt/jquery-pjax
 * 
 * @version 0.1
 * @author Arthur
 * @source https://github.com/arthur-s/PJAX-JSON-Standalone
 * @license MIT
 */
(function(window){ 
	'use strict';

	// Object to store private values/methods.
	var internal = {
		// Is this the first usage of PJAX? (Ensure history entry has required values if so.)
		"firstrun": true,
		// Borrowed wholesale from https://github.com/defunkt/jquery-pjax
		// Attempt to check that a device supports pushstate before attempting to use it.
		"is_supported": window.history && window.history.pushState && window.history.replaceState && !navigator.userAgent.match(/((iPod|iPhone|iPad).+\bOS\s+[1-4]|WebApps\/.+CFNetwork)/),
		// Track which scripts have been included in to the page. (used if e)
		"loaded_scripts": []
	};
	
	// If PJAX isn't supported we can skip setting up the library all together
	// So as not to break any code expecting PJAX to be there, return a shell object containing
	// IE7 + compatible versions of connect (which needs to do nothing) and invoke ( which just changes the page)
	if(!internal.is_supported) {
		// PJAX shell, so any code expecting PJAX will work
		var pjax_shell = {
			"connect": function() { return; },
			"invoke": function() {
				var url = (arguments.length === 2) ? arguments[0] : arguments.url;
				document.location = url;
				return;	
			} 
		};
		// AMD support
		if (typeof define === 'function' && define.amd) { 
			define( function() { return pjax_shell; }); 
		} else { 
			window.pj = pjax_shell; 
		}
		return;
	}

	/**
	 * AddEvent
	 *
	 * @scope private
	 * @param obj Object to listen on
	 * @param event Event to listen for.
	 * @param callback Method to run when event is detected.
	 */
	internal.addEvent = function(obj, event, callback) {
		obj.addEventListener(event, callback, false);
	};

	/**
	 * Clone
	 * Util method to create copies of the options object (so they do not share references)
	 * This allows custom settings on different links.
	 *
	 * @scope private
	 * @param obj
	 * @return obj
	 */
	internal.clone = function(obj) {
		var object = {};
		// For every option in object, create it in the duplicate.
		for (var i in obj) {
			object[i] = obj[i];
		}
		return object;
	};

	/**
	 * triggerEvent
	 * Fire an event on a given object (used for callbacks)
	 *
	 * @scope private
	 * @param node. Objects to fire event on
	 * @return event_name. type of event
	 */
	internal.triggerEvent = function(node, event_name, data) {
		// Good browsers
		var evt = document.createEvent("HTMLEvents");
		evt.initEvent(event_name, true, true);
		// If additional data was provided, add it to event
		if(typeof data !== 'undefined') evt.data = data;
		node.dispatchEvent(evt);
	};

	/**
	 * popstate listener
	 * Listens for back/forward button events and updates page accordingly.
	 */
	internal.addEvent(window, 'popstate', function(st) {
		if(st.state !== null) {

			var opt = {	
				'url': st.state.url, 
				'container': st.state.container, 
				'title' : st.state.title,
				'history': false
			};

			// Merge original in original connect options
			if(typeof internal.options !== 'undefined'){
				for(var a in internal.options){ 
					// if (typeof opt[a] === 'undefined') opt[a] = internal.options[a];
					if (typeof opt.hasOwnProperty(a)){
						opt[a] = internal.options[a];
					}
				}
			}

			// Convert state data to PJAX options
			var options = internal.parseOptions(opt);
			// If something went wrong, return.
			if(options === false) return;
			// If there is a state object, handle it as a page load.
			internal.handle(options);
		}
	});

	/**
	 * attach
	 * Attach PJAX listeners to a link.
	 * @scope private
	 * @param link_node. link that will be clicked.
	 * @param content_node. 
	 */
	internal.attach = function(node, options) {

		// Ignore external links.
		if ( node.protocol !== document.location.protocol ||
			node.host !== document.location.host ) {
			return;
		}

		// Ignore anchors on the same page
		if(node.pathname === location.pathname && node.hash.length > 0) {
			return;
		}

		// Ignore common non-PJAX loadable media types (pdf/doc/zips & images) unless user provides alternate array
		var ignoreFileTypes = ['pdf','doc','docx','zip','rar','7z','gif','jpeg','jpg','png'];
		if(typeof options.ignoreFileTypes === 'undefined') options.ignoreFileTypes = ignoreFileTypes;
		// Skip link if file type is within ignored types array
		if(options.ignoreFileTypes.indexOf( node.pathname.split('.').pop().toLowerCase() ) !== -1){
			return;
		}

		// Add link HREF to object
		options.url = node.href;

		// If PJAX data is specified, use as container
		if(node.getAttribute('data-pjax')) {
			options.container = node.getAttribute('data-pjax');
		}

		// If data-title is specified, use as title.
		if(node.getAttribute('data-title')) {
			options.title = node.getAttribute('data-title');
		}

		// Check options are valid.
		options = internal.parseOptions(options);
		if(options === false) return;

		// Attach event.
		internal.addEvent(node, 'click', function(event) {
			// Allow middle click (pages in new windows)
			if ( event.which > 1 || event.metaKey || event.ctrlKey ) return;
			// Don't fire normal event
			if(event.preventDefault){ event.preventDefault(); }else{ event.returnValue = false; }
			// Take no action if we are already on said page?
			if(document.location.href === options.url) return false;
			// handle the load.
			internal.handle(options);
		});
	};

	/**
	 * parseLinks
	 * Parse all links within a DOM node, using settings provided in options.
	 * @scope private
	 * @param dom_obj. Dom node to parse for links.
	 * @param options. Valid Options object.
	 */
	internal.parseLinks = function(dom_obj, options) {

		var nodes;

		if(typeof options.useClass !== 'undefined'){
			// Get all nodes with the provided class name.
			nodes = dom_obj.getElementsByClassName(options.useClass);
		}else{
			// If no class was provided, just get all the links
			nodes = dom_obj.getElementsByTagName('a');
		}

		// For all returned nodes
		for(var i=0,tmp_opt; i < nodes.length; i++) {
			var node = nodes[i];
			if(typeof options.excludeClass !== 'undefined') {
				if(node.className.indexOf(options.excludeClass) !== -1) continue;
			}
			// Override options history to true, else link parsing could be triggered by back button (which runs in no-history mode)
			tmp_opt = internal.clone(options);
			tmp_opt.history = true;
			internal.attach(node, tmp_opt);
		}

		if(internal.firstrun) {
			// Fire ready event once all links are connected
			internal.triggerEvent(internal.get_container_node(options.container), 'ready');
			
		}
	};

	/**
	 * handle
	 * Handle requests to load content via PJAX.
	 * @scope private
	 * @param url. Page to load.
	 * @param node. Dom node to add returned content in to.
	 * @param addtohistory. Does this load require a history event.
	 */
	internal.handle = function(options) {
		
		// Fire beforeSend Event.
		internal.triggerEvent(options.container, 'beforeSend', options);

		// Do the request (FROM OUTSIDE!)
		internal.request(options.url,{
			
			// set headers to the ajax request
			headers: options.headers,

			success: function(data) {
				// Fail if unable to load HTML via AJAX
				if(data === false){
					internal.triggerEvent(options.container,'complete', options);
					internal.triggerEvent(options.container,'error', options);
					return;
				}

				// Parse JSON & update DOM - implement this function yourself
				// options = internal.updateContent(data, options);
				options = options.updateContent(data, options);
				
				// Do we need to add this to the history?
				if(options.history) {
					// If this is the first time pjax has run, create a state object for the current page.
					if(internal.firstrun){
						window.history.replaceState({'url': document.location.href, 'container':  options.container.id, 'title': document.title}, document.title);
						internal.firstrun = false;
					}
					// Update browser history
					window.history.pushState({'url': options.url, 'container': options.container.id, 'title': options.title }, options.title , options.url);
				}

				// Initialize any new links found within document (if enabled).
				if(options.parseLinksOnload){
					internal.parseLinks(options.container, options);
				}

				// Fire Events
				internal.triggerEvent(options.container,'complete', options);
				internal.triggerEvent(options.container,'success', options);
				
				// Don't track if page isn't part of history, or if autoAnalytics is disabled
				if(options.autoAnalytics && options.history) {
					// If autoAnalytics is enabled and a Google analytics tracker is detected push 
					// a trackPageView, so PJAX loaded pages can be tracked successfully.
					if(window._gaq) _gaq.push(['_trackPageview']);
					if(window.ga) ga('send', 'pageview', {'page': options.url, 'title': options.title});
				}

				// Set new title
				document.title = options.title;

				// Scroll page to top on new page load
				if(options.returnToTop) {
					window.scrollTo(0, 0);
				}
			},
			error: function(data) {console.log('error')}
		})
	};

	/**
	 * parseOptions
	 * Validate and correct options object while connecting up any listeners.
	 *
	 * @scope private
	 * @param options
	 * @return false | valid options object
	 */
	internal.parseOptions = function(options) {

		/**  Defaults parse options. (if something isn't provided)
		 *
		 * - history: track event to history (on by default, set to off when performing back operation)
		 * - parseLinksOnload: Enabled by default. Process pages loaded via PJAX and setup PJAX on any links found.
		 * - autoAnalytics: Automatically attempt to log events to Google analytics (if tracker is available)
		 * - returnToTop: Scroll user back to top of page, when new page is opened by PJAX
		 * - headers: extra headers that will be added to the ajax request.
		 */
		var defaults = {
			"history": true,
			"parseLinksOnload": true,
			"autoAnalytics": true,
			"returnToTop": true,
			"updateContent": internal.updateContent,
			"headers": {'Accept': 'application/json'}
		};

		// Ensure a URL and container have been provided.
		if(typeof options.url === 'undefined' || typeof options.container === 'undefined' || options.container === null) {
			console.log("URL and Container must be provided.");
			return false;
		}

		// Check required options are defined, if not, use default
		for(var o in defaults) {
			if(typeof options[o] === 'undefined') options[o] = defaults[o];
		}

		// Ensure history setting is a boolean.
		options.history = (options.history === false) ? false : true;

		// Get container (if its an id, convert it to a DOM node.)
		options.container = internal.get_container_node(options.container);

		// Events
		var events = ['ready', 'beforeSend', 'complete', 'error', 'success'];

		// If everything went okay thus far, connect up listeners
		for(var e in events){
			var evt = events[e];
			if(typeof options[evt] === 'function'){
				internal.addEvent(options.container, evt, options[evt]);
			}
		}

		// Return valid options
		return options;
	};

	/**
	 * get_container_node
	 * Returns container node
	 *
	 * @param container - (string) container ID | container DOM node.
	 * @return container DOM node | false
	 */
	internal.get_container_node = function(container) {
		if(typeof container === 'string') {
			container = document.getElementById(container);
			if(container === null){
				console.log("Could not find container with id:" + container);
				return false;
			}
		}
		return container;
	};

	/**
	 * connect
	 * Attach links to PJAX handlers.
	 * @scope public
	 *
	 * Can be called in 3 ways.
	 * Calling as connect(); 
	 *		Will look for links with the data-pjax attribute.
	 *
	 * Calling as connect(container_id)
	 *		Will try to attach to all links, using the container_id as the target.
	 *
	 * Calling as connect(container_id, class_name)
	 *		Will try to attach any links with the given class name, using container_id as the target.
	 *
	 * Calling as connect({	
	 *						'url':'somepage.php',
	 *						'container':'somecontainer',
	 *						'beforeSend': function(){console.log("sending");}
	 *					})
	 *		Will use the provided JSON to configure the script in full (including callbacks)
	 */
	internal.connect = function(/* options */) {
		// connect();
		var options = {};
		// connect(container, class_to_apply_to)
		if(arguments.length === 2){
			options.container = arguments[0];
			options.useClass = arguments[1];
		}
		// Either JSON or container id
		if(arguments.length === 1){
			if(typeof arguments[0] === 'string' ) {
				//connect(container_id)
				options.container = arguments[0];
			}else{
				//Else connect({url:'', container: ''});
				options = arguments[0];
			}
		}
		// Delete history and title if provided. These options should only be provided via invoke();
		delete options.title;
		delete options.history;
		
		internal.options = options;
		if(document.readyState === 'complete') {
			internal.parseLinks(document, options);
		} else {
			//Don't run until the window is ready.
			internal.addEvent(window, 'load', function(){	
				//Parse links using specified options
				internal.parseLinks(document, options);
			});
		}
	};
	
	/**
	 * invoke
	 * Directly invoke a pjax page load.
	 * invoke({url: 'file.php', 'container':'content'});
	 *
	 * @scope public
	 * @param options  
	 */
	internal.invoke = function(/* options */) {

		var options = {};
		// url, container
		if(arguments.length === 2){
			options.url = arguments[0];
			options.container = arguments[1];
		}else{
			options = arguments[0];
		}

		// Process options
		options = internal.parseOptions(options);
		// If everything went okay, activate pjax.
		if(options !== false) internal.handle(options);
	};

	
	/*
	* You can easyly override this method, or use it globally
	* e.g. pj.request(url, {data: {}, succeess: function(data){alert(data)}})
	* https://gist.github.com/jed/993585
	* https://gist.github.com/Xeoncross/7663273
	*/
	internal.request = function(url, params) {
		params = params || {};
		var new_xhr = function(){try{return new(window.XMLHttpRequest||ActiveXObject('MSXML2.XMLHTTP.3.0'))}catch(e){return null}};
		if (!new_xhr) return;
		var req = new_xhr(), // req = new XMLHttpRequest(),
			data = params.data || null,
			success = params.success || null,
			error = params.error || null,
			timeout = params.timeout || null,
			credentials = params.credentials || null,
			headersObj = params.headers || internal.headers || {};

		// Must encode data
	    if(data && typeof(data) === 'object') {
	        var y = '', e = encodeURIComponent;
	        for (var x in data) {
	            if (data.hasOwnProperty(x)){
	            	y += '&' + e(x) + '=' + e(data[x]);
	            }
	        }
	        // data = y.slice(1) + (! cache ? '&_t=' + new Date : '');
	        data = y.slice(1);
	    }

		req.onreadystatechange = function () {
			if ( req.readyState != 4 ) return;

			// Error
			if ( req.status != 200 && req.status != 304 ) {
				if ( error ) error();
				return;
			}

			if ( success ) success(req.responseText);
		};

		if ( data ) {
			req.open('POST', url, true);
			req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		} else {
			req.open('GET', url, true);
		}

		req.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		
		// add extra headers,
		// e.g., {'Content-Type': 'application/json'}
		for (var key in headersObj) {
			if (headersObj.hasOwnProperty(key)) {
				req.setRequestHeader(key, headersObj[key]);
			}
		}

		if (credentials){
			req.withCredentials = true;
		}

		req.send(data);

		if ( timeout ) {
			setTimeout(function () {
				req.onreadystatechange = function () {};
				req.abort();
				if ( error ) error();
			}, timeout);
		}
	};

	/*
	* Main update function. You should pass your own updateContent function with options
	* for example, in your view: 
	*		var updateContent = function (data, options){ dosmth(); return options; }
	* 		pj.connect('container', {"updateContent": updateContent})
	*/
	internal.updateContent = function (data, options) {
		console.warn('set up updateContent function!');
		console.log('Your data: ', data);
		console.log('options: ', options);
		// must return options
		return options
	};

	var pjax_obj = {
		connect: internal.connect,
		invoke: internal.invoke,
		request: internal.request
		// updateContent: internal.updateContent
	};

	// transport
	if ( typeof define === 'function' && define.amd ) {
		// AMD
		define( pjax_obj );
	} else {
		// browser global
		window.pj = pjax_obj;
	}


})(window);
