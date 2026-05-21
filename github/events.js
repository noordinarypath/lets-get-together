var https = require('https');

exports.handler = function(event, context, callback) {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return callback(null, { statusCode: 200, headers: headers, body: '' });
  }

  var siteId = process.env.SITE_ID;
  var token = process.env.NETLIFY_TOKEN;

  if (!siteId || !token) {
    return callback(null, {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: 'Missing environment variables' })
    });
  }

  var method = event.httpMethod;
  var params = event.queryStringParameters || {};
  var eventId = params.id || '';

  if (method === 'GET' && eventId) {
    // Get a single event
    var getOptions = {
      hostname: 'api.netlify.com',
      path: '/api/v1/sites/' + siteId + '/blobs/' + eventId,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };

    var getReq = https.request(getOptions, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        if (res.statusCode === 404) {
          return callback(null, {
            statusCode: 404,
            headers: headers,
            body: JSON.stringify({ error: 'Event not found' })
          });
        }
        callback(null, {
          statusCode: 200,
          headers: headers,
          body: data
        });
      });
    });
    getReq.on('error', function(e) {
      callback(null, { statusCode: 500, headers: headers, body: JSON.stringify({ error: e.message }) });
    });
    getReq.end();

  } else if (method === 'POST') {
    // Save or update an event
    var body = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) {}
    var id = body.id || '';
    if (!id) {
      return callback(null, { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Missing event id' }) });
    }
    var postData = JSON.stringify(body);
    var postOptions = {
      hostname: 'api.netlify.com',
      path: '/api/v1/sites/' + siteId + '/blobs/' + id,
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    var postReq = https.request(postOptions, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        callback(null, { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) });
      });
    });
    postReq.on('error', function(e) {
      callback(null, { statusCode: 500, headers: headers, body: JSON.stringify({ error: e.message }) });
    });
    postReq.write(postData);
    postReq.end();

  } else if (method === 'DELETE' && eventId) {
    // Delete an event
    var delOptions = {
      hostname: 'api.netlify.com',
      path: '/api/v1/sites/' + siteId + '/blobs/' + eventId,
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };
    var delReq = https.request(delOptions, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        callback(null, { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) });
      });
    });
    delReq.on('error', function(e) {
      callback(null, { statusCode: 500, headers: headers, body: JSON.stringify({ error: e.message }) });
    });
    delReq.end();

  } else {
    callback(null, { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid request' }) });
  }
};
