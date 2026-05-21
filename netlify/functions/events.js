var https = require('https');

var GITHUB_TOKEN = process.env.GITHUB_TOKEN;
var GITHUB_REPO = 'noordinarypath/lets-get-together';
var DATA_PATH = 'data';

exports.handler = function(event, context, callback) {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return callback(null, { statusCode: 200, headers: headers, body: '' });
  }

  var method = event.httpMethod;
  var params = event.queryStringParameters || {};
  var eventId = params.id || '';

  function githubRequest(options, body, done) {
    var reqOptions = {
      hostname: 'api.github.com',
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Authorization': 'token ' + GITHUB_TOKEN,
        'User-Agent': 'nop-event-scheduler',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      var bodyStr = JSON.stringify(body);
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    var req = https.request(reqOptions, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { done(null, res.statusCode, JSON.parse(data)); }
        catch(e) { done(null, res.statusCode, data); }
      });
    });
    req.on('error', function(e) { done(e); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  }

  function getFileSha(id, done) {
    githubRequest({ path: '/repos/' + GITHUB_REPO + '/contents/' + DATA_PATH + '/' + id + '.json' }, null, function(err, status, data) {
      if (err || status === 404) return done(null, null);
      done(null, data.sha || null);
    });
  }

  if (method === 'GET' && eventId) {
    githubRequest({ path: '/repos/' + GITHUB_REPO + '/contents/' + DATA_PATH + '/' + eventId + '.json' }, null, function(err, status, data) {
      if (err || status === 404) {
        return callback(null, { statusCode: 404, headers: headers, body: JSON.stringify({ error: 'Event not found' }) });
      }
      try {
        var content = Buffer.from(data.content, 'base64').toString('utf8');
        callback(null, { statusCode: 200, headers: headers, body: content });
      } catch(e) {
        callback(null, { statusCode: 500, headers: headers, body: JSON.stringify({ error: 'Parse error' }) });
      }
    });

  } else if (method === 'POST') {
    var body = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) {}
    var id = body.id || '';
    if (!id) return callback(null, { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Missing id' }) });

    var content = Buffer.from(JSON.stringify(body)).toString('base64');
    getFileSha(id, function(err, sha) {
      var payload = { message: 'Save event ' + id, content: content };
      if (sha) payload.sha = sha;
      githubRequest({ path: '/repos/' + GITHUB_REPO + '/contents/' + DATA_PATH + '/' + id + '.json', method: 'PUT' }, payload, function(err, status, data) {
        if (err) return callback(null, { statusCode: 500, headers: headers, body: JSON.stringify({ error: 'Save failed' }) });
        callback(null, { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) });
      });
    });

  } else if (method === 'DELETE' && eventId) {
    getFileSha(eventId, function(err, sha) {
      if (!sha) return callback(null, { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) });
      var payload = { message: 'Delete event ' + eventId, sha: sha };
      githubRequest({ path: '/repos/' + GITHUB_REPO + '/contents/' + DATA_PATH + '/' + eventId + '.json', method: 'DELETE' }, payload, function(err, status, data) {
        callback(null, { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) });
      });
    });

  } else {
    callback(null, { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid request' }) });
  }
};
