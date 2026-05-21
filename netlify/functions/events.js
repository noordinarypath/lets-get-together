export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO = 'noordinarypath/lets-get-together';
  const method = event.httpMethod;
  const params = event.queryStringParameters || {};
  const eventId = params.id || '';

  async function ghFetch(path, options = {}) {
    const res = await fetch('https://api.github.com' + path, {
      ...options,
      headers: {
        'Authorization': 'token ' + GITHUB_TOKEN,
        'User-Agent': 'nop-event-scheduler',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    try { return { status: res.status, data: JSON.parse(text) }; }
    catch(e) { return { status: res.status, data: text }; }
  }

  async function getFileSha(id) {
    const r = await ghFetch('/repos/' + REPO + '/contents/data/' + id + '.json');
    if (r.status === 404) return null;
    return r.data.sha || null;
  }

  try {
    if (method === 'GET' && eventId) {
      const r = await ghFetch('/repos/' + REPO + '/contents/data/' + eventId + '.json');
      if (r.status === 404) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Event not found' }) };
      }
      const content = Buffer.from(r.data.content, 'base64').toString('utf8');
      return { statusCode: 200, headers, body: content };

    } else if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const id = body.id;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };

      const content = Buffer.from(JSON.stringify(body)).toString('base64');
      const sha = await getFileSha(id);
      const payload = { message: 'Save event ' + id, content };
      if (sha) payload.sha = sha;

      const r = await ghFetch('/repos/' + REPO + '/contents/data/' + id + '.json', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (r.status >= 400) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Save failed', detail: r.data }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

    } else if (method === 'DELETE' && eventId) {
      const sha = await getFileSha(eventId);
      if (!sha) return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

      const payload = { message: 'Delete event ' + eventId, sha };
      await ghFetch('/repos/' + REPO + '/contents/data/' + eventId + '.json', {
        method: 'DELETE',
        body: JSON.stringify(payload)
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
    }
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
