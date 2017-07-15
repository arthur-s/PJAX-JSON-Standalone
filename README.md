# PJAX-JSON-Standalone
Standalone implementation of Pushstate with JSON AJAX, for non-jQuery web pages
Based on Carl's PJAX Standalone, see https://github.com/thybag/PJAX-Standalone (and his work based on original defunkt's jquery-pjax, see https://github.com/defunkt/jquery-pjax)

## Upd: the request.js can be imported to es6 project.
TODO:
* separate pj.request from pj
* turn pj.request to promise, with jQuery-like syntax (pj.get(), pj.post() etc)
* make it importable in es6 projects

## Usage
The main idea of this plugin - is to update a web page with returned JSON data. Your application sends a request for JSON data, and updates the page. 

In pjax technique you make request for static content and push it to some container. But here you get JSON object, and you cannot immediately push it to the container without turning it to static content, and becouse of this you need to write a handler which will render your JSON. This handler function must be defined  in options with **updateContent** key. For example:
```
/*
* data - your returned from request JSON data
* plugin's options, which can be updated (usually update title)
* options must be returned
*/
var updateContent = function (data, options) {
	console.log('Your data: ', data);
	console.log('options: ', options);
	
	var rendered = jsonToHTML(data);
    options.container.innerHTML = rendered;
	
	// replace tab title:
	options.title = data.article.name
	// must return options
	return options
};
```
Now you can use this plugin with options, like at https://github.com/thybag/PJAX-Standalone, except that this plugin's variable name is **pj**, not **pjax**, for example:
```javascript    
    pj.connect({
		container: 'main',
		updateContent: updateContent,
		autoAnalytics: false
	});
```

## Bonus: this plugin allow You to make ajax-requests via pj.request method
You can call it simply
```
 pj.request('http://domain.name', {
	/* pass extra headers, if needed */
	headers: {
		'Content-Type': 'application/json',
		'Accept': 'application/json',
	},

	success: function(data){
		console.log(data)
	},
	error: function(){
		alert('ohh!')
	}
})
```
Also You can pass with params *data* (object, will make POST request);
*timeout* (int, request timeout in seconds);
*credentials* (boolean, to make request w/o credentials).

