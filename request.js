/*
based on 
https://gist.github.com/jed/993585
https://gist.github.com/Xeoncross/7663273
*/

var pj = {};

pj.request = function(url, params) {
    params = params || {};
    var new_xhr = function(){try{return new(window.XMLHttpRequest||ActiveXObject('MSXML2.XMLHTTP.3.0'))}catch(e){return null}};
    if (!new_xhr) return;
    var req = new_xhr(), // req = new XMLHttpRequest(),
        data = params.data || null,
        success = params.success || null,
        error = params.error || null,
        timeout = params.timeout || null,
        credentials = params.credentials || null,
        headersObj = params.headers || {};

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
        if ( req.status != 200 && req.status != 201 && req.status != 304 ) {
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


export default pj;