var Promise, config, credentials, crypto, flags, httpRequest, klarna, parseError, publicMethods, request, wrapper;

crypto = require('crypto');

request = require('request');

Promise = require('promise');

flags = {
  live: false,
  initalized: false
};

credentials = {
  eid: null,
  secret: null
};

config = {
  purchase_country: 'SE',
  purchase_currency: 'SEK',
  locale: 'sv-se',
  merchant: {
    id: null,
    terms_uri: null,
    checkout_uri: null,
    confirmation_uri: null,
    push_uri: null
  },
  gui: {
    layout: 'desktop'
  }
};

klarna = {
  url: {
    test: 'https://checkout.testdrive.klarna.com/checkout/orders',
    live: 'https://checkout.klarna.com/checkout/orders'
  },
  headers: {
    contentType: 'application/vnd.klarna.checkout.aggregated-order-v2+json',
    accept: 'application/vnd.klarna.checkout.aggregated-order-v2+json'
  }
};


/* PRIVATE */

httpRequest = {
  headers: function(payload) {
    var biscuit, hash;
    biscuit = payload != null ? JSON.stringify(payload) + credentials.secret : credentials.secret;
    hash = crypto.createHash('sha256').update(biscuit, 'utf-8').digest('base64');
    return {
      'Accept': klarna.headers.accept,
      'Authorization': 'Klarna ' + hash,
      'Content-Type': klarna.headers.contentType
    };
  },
  options: function(data, id) {
    var url;
    url = flags.live ? klarna.url.live : klarna.url.test;
    return {
      url: id != null ? url + '/' + id : url,
      headers: this.headers(data),
      body: data,
      json: data != null ? true : false
    };
  }
};

wrapper = function(f) {
  var key, ref, value;
  if (!flags.initalized) {
    throw 'Klarna module not initialized. Please use init() method.';
  }
  ref = config.merchant;
  for (key in ref) {
    value = ref[key];
    if (value == null) {
      throw "Config error: " + key + " not set";
    }
  }
  return f;
};

parseError = function(error, response, body) {
  if (error != null) {
    return {
      type: 'HTTP',
      code: error.code,
      message: error.message
    };
  } else if (body) {
    body = typeof body === 'string' ? JSON.parse(body) : body;
    return {
      type: 'Klarna',
      code: body.http_status_code + " - " + body.http_status_message,
      message: body.internal_message
    };
  }
};


/* PUBLIC */

publicMethods = {
  init: function(input) {
    if (input == null) {
      throw "Missing init values";
    }
    if (input.eid != null) {
      credentials.eid = input.eid;
      config.merchant.id = input.eid;
    }
    if (input.secret != null) {
      credentials.secret = input.secret;
    }
    if ((input.live != null) && typeof input.live === 'boolean') {
      flags.live = input.live;
    }
    if ((input.eid != null) && (input.secret != null)) {
      return flags.initalized = true;
    }
  },
  config: function(input) {
    if (input.purchase_country != null) {
      config.purchase_country = input.purchase_country;
    }
    if (input.purchase_currency != null) {
      config.purchase_currency = input.purchase_currency;
    }
    if (input.locale != null) {
      config.locale = input.locale;
    }
    if (input.layout != null) {
      if (input.layout === 'desktop' || input.layout === 'mobile') {
        config.gui.layout = input.layout;
      }
    }
    if (input.terms_uri != null) {
      config.merchant.terms_uri = input.terms_uri;
    }
    if (input.cancellation_terms_uri != null) {
      config.merchant.cancellation_terms_uri = input.cancellation_terms_uri;
    }
    if (input.checkout_uri != null) {
      config.merchant.checkout_uri = input.checkout_uri;
    }
    if (input.confirmation_uri != null) {
      config.merchant.confirmation_uri = input.confirmation_uri;
    }
    if (input.push_uri != null) {
      return config.merchant.push_uri = input.push_uri;
    }
  },
  place: function(cart) {
    var f;
    f = function() {
      return new Promise(function(resolve, reject) {
        var resource;
        resource = config;
        resource.cart = cart;
        return request.post(httpRequest.options(resource), function(error, response, body) {
          var err, location;
          err = parseError(error, response, body);
          if (err != null) {
            return reject(err);
          } else if ((response.statusCode != null) && response.statusCode === 201) {
            location = response.headers.location;
            return resolve(location.slice(location.lastIndexOf('/') + 1));
          }
        });
      });
    };
    return wrapper(f)();
  },
  fetch: function(id) {
    var f;
    f = function() {
      return new Promise(function(resolve, reject) {
        return request.get(httpRequest.options(null, id), function(error, response, body) {
          if (response != null) {
            if (response.statusCode === 200) {
              return resolve(JSON.parse(body));
            } else {
              return reject(parseError(error, response, body));
            }
          } else {
            return reject(parseError(error, response, body));
          }
        });
      });
    };
    return wrapper(f)();
  },
  update: function(id, data) {
    var f;
    f = function() {
      return new Promise(function(resolve, reject) {
        return request.post(httpRequest.options(data, id), function(error, response, body) {
          if (response != null) {
            if ((response.statusCode != null) && response.statusCode === 200) {
              return resolve(body);
            } else {
              return reject(parseError(error, response, body));
            }
          } else {
            return reject(parseError(error, response, body));
          }
        });
      });
    };
    return wrapper(f)();
  },
  confirm: function(id, orderid1, orderid2) {
    var f;
    f = function() {
      return new Promise(function(resolve, reject) {
        var data;
        data = {
          status: 'created'
        };
        if (orderid1 != null) {
          data.merchant_reference = {
            orderid1: orderid1
          };
        }
        if (orderid2 != null) {
          data.merchant_reference.orderid2 = orderid2;
        }
        return publicMethods.update(id, data).then(function(order) {
          return resolve(order);
        }, function(error) {
          return reject(error);
        });
      });
    };
    return wrapper(f)();
  }
};

module.exports = publicMethods;
