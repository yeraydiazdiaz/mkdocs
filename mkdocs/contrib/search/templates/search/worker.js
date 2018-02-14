var base_url = 'function' === typeof importScripts ? '.' : '/search/';
var allowSearch = false;
var index;
var documents = {};
var lang = ['en'];
var data;

function getScript(script, callback) {
  console.log('Loading script: ' + script);
  $.getScript(base_url + script).done(function () {
    callback();
  }).fail(function (jqxhr, settings, exception) {
    console.log('Error: ' + exception);
  });
}

function getScriptsInOrder(scripts, callback) {
  if (scripts.length === 0) {
    callback();
    return;
  }
  getScript(scripts[0], function() {
    getScriptsInOrder(scripts.slice(1), callback);
  });
}

function loadScripts(urls, callback) {
  if( 'function' === typeof importScripts ) {
    importScripts.apply(null, urls);
    callback();
  } else {
    getScriptsInOrder(urls, callback);
  }
}

function onJSONLoaded () {
  data = JSON.parse(this.responseText);
  var scriptsToLoad = ['lunr.js'];
  if (data.config && data.config.lang && data.config.lang.length) {
    lang = data.config.lang;
  }
  if (lang.length > 1 || lang[0] !== "en") {
    scriptsToLoad.push('lunr.stemmer.support.js');
    if (lang.length > 1) {
      scriptsToLoad.push('lunr.multi.js');
    }
    for (var i=0; i < lang.length; i++) {
      if (lang[i] != 'en') {
        scriptsToLoad.push(['lunr', lang[i], 'js'].join('.'));
      }
    }
  }
  loadScripts(scriptsToLoad, onScriptsLoaded);
}

function onScriptsLoaded () {
  console.log('All search scripts loaded, building Lunr index...');
  if (data.config && data.config.seperator && data.config.seperator.length) {
    lunr.tokenizer.seperator = new RegExp(data.config.seperator);
  }
  index = lunr(function () {
    if (lang.length === 1 && lang[0] !== "en" && lunr[lang[0]]) {
      this.use(lunr[lang[0]]);
    } else if (lang.length > 1) {
      this.use(lunr.multiLanguage.apply(null, lang));  // spread operator not supported in all browsers: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_operator#Browser_compatibility
    }
    this.field('title', { boost: 10 });
    this.field('text');
    this.ref('location');

    for (var i=0; i < data.docs.length; i++) {
      var doc = data.docs[i];
      doc.location = base_url + doc.location;
      this.add(doc);
      documents[doc.location] = doc;
    }
  });
  allowSearch = true;
  console.log('Lunr index built, search ready');
}

function init () {
  var oReq = new XMLHttpRequest();
  oReq.addEventListener("load", onJSONLoaded);
  var index_path = base_url + '/search_index.json';
  if( 'function' === typeof importScripts ){
      index_path = 'search_index.json';
  }
  oReq.open("GET", index_path);
  oReq.send();
}

function search (query) {
  if (!allowSearch) {
    console.error('Assets for search still loading');
    return;
  }

  var resultDocuments = [];
  var results = index.search(query);
  for (var i=0; i < results.length; i++){
    var result = results[i];
    doc = documents[result.ref];
    doc.base_url = base_url;
    doc.summary = doc.text.substring(0, 200);
    resultDocuments.push(doc);
  }
  return resultDocuments;
}

if( 'function' === typeof importScripts ) {
  onmessage = function (e) {
    if (e.data.baseUrl) {
      base_url = e.data.baseUrl;
      init();
    } else if (e.data.query) {
      postMessage({ results: search(e.data.query) });
    } else {
      console.error("Worker - Unrecognized message: " + e);
    }
  };
}
