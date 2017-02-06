var jsdom = require('jsdom');
var helpers = require('./helpers');

exports.debug = function(debug) {
  helpers.debug(debug);
};

exports.debug(false);

function Readability(window, options) {
  this._window = window;
  this._document = window.document;
  helpers.setCleanRules(options.cleanRulers || []);

  this.cache = {};

  helpers.prepDocument(this._document);
  // Cache the body HTML in case we need to re-use it later
  this.cache = {
    'body': this._document.body.innerHTML
  };

  this.__defineGetter__('content', function() {
    return this.getContent();
  });
  this.__defineGetter__('title', function() {
    return this.getTitle();
  });
  this.__defineGetter__('textBody', function() {
    return this.getTextBody();
  });
  this.__defineGetter__('html', function() {
    return this.getHTML();
  });
  this.__defineGetter__('document', function() {
    return this.getDocument();
  });
}

Readability.prototype.close = function() {
  if (this._window) {
    this._window.close();
  }
  this._window = null;
  this._document = null;
  delete this.cache
};

Readability.prototype.getContent = function() {
  if (typeof this.cache['article-content'] !== 'undefined') {
    return this.cache['article-content'];
  }
  if (!this.cache['article-after-grab']) {
    this.cache['article-after-grab'] = helpers.grabArticle(this._document);
  }
  var articleContent = this.cache['article-after-grab'];
  if (helpers.getInnerText(articleContent, false) === '') {
    this._document.body.innerHTML = this.cache.body;
    articleContent = helpers.grabArticle(this._document, true);
    if (helpers.getInnerText(articleContent, false) === '') {
      return this.cache['article-content'] = false;
    }
  }

  return this.cache['article-content'] = articleContent.innerHTML;
};

Readability.prototype.getTitle = function() {
  if (typeof this.cache['article-title'] !== 'undefined') {
    return this.cache['article-title'];
  }

  var title = _findMetaTitle(this._document) || this._document.title;
  var betterTitle;
  var commonSeparatingCharacters = [' | ', ' _ ', ' - ', '«', '»', '—'];

  var self = this;
  commonSeparatingCharacters.forEach(function(char) {
    var tmpArray = title.split(char);
    if (tmpArray.length > 1) {
      if (betterTitle) return self.cache['article-title'] = title;
      betterTitle = tmpArray[0].trim();
    }
  });

  if (betterTitle && betterTitle.length > 10) {
    return this.cache['article-title'] = betterTitle;
  }

  return this.cache['article-title'] = title;
};

Readability.prototype.getTextBody = function() {
  if (typeof this.cache['article-text-body'] !== 'undefined') {
    return this.cache['article-text-body'];
  }

  if (!this.cache['article-after-grab']) {
    this.cache['article-after-grab'] = helpers.grabArticle(this._document);
  }
  var articleContent = this.cache['article-after-grab']
  var rootElement = articleContent.childNodes[0];
  var textBody = '';
  if (rootElement) {
    var textElements = rootElement.childNodes;
    for (var i = 0; i < textElements.length; i++) {
      var el = textElements[i];
      var text = helpers.getInnerText(el);
      if (!text) continue;
      textBody += text;
      if ((i + 1) < textElements.length) textBody += '\n';
    }
  }

  return this.cache['article-text-body'] = textBody;
}

Readability.prototype.getDocument = function() {
  return this._document;
};

Readability.prototype.getHTML = function() {
  return this._document.getElementsByTagName('html')[0].innerHTML;
};

function _findMetaTitle(document) {
  var metaTags = document.getElementsByTagName('meta');
  var tag;

  for(var i = 0; i < metaTags.length; i++) {
    tag = metaTags[i];

    if(tag.getAttribute('property') === 'og:title' || tag.getAttribute('name') === 'twitter:title'){
      return tag.getAttribute('content');
    }
  }
  return null;
}

function read(html, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  jsdomParse(html);

  function jsdomParse(body) {
    if (typeof body !== 'string') body = body.toString();
    if (!body) return callback(new Error('Empty story body returned from URL'));
    jsdom.env({
      html: body,
      done: function(errors, window) {
        window.document.originalURL = null;
        if (errors) {
          window.close();
          return callback(errors);
        }
        if (!window.document.body) {
          window.close();
          return callback(new Error('No body tag was found.'));
        }

        try {
          var readability = new Readability(window, options);

          callback(null, readability);
        } catch (ex) {
          window.close();
          return callback(ex);
        }
      }
    });
  }
}

exports.read = read;
