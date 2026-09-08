const BASE = '/api';

async function request(method, url, body, isForm) {
  const opts = { method, headers: {} };
  if (body !== undefined && !isForm) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (isForm) {
    opts.body = body; // FormData，浏览器自动设 Content-Type
  }
  const res = await fetch(BASE + url, opts);
  if (res.ok) return res.json();
  let err;
  try {
    const data = await res.json();
    err = new Error(data.error || `请求失败 (${res.status})`);
    err.data = data;
  } catch {
    err = new Error(`请求失败 (${res.status})`);
  }
  err.status = res.status;
  throw err;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  patch: (url, body) => request('PATCH', url, body),
  del: (url) => request('DELETE', url),
  upload: (url, formData) => request('POST', url, formData, true),
};

/** 下载文件（用于导出） */
export async function download(url, fallbackName) {
  const res = await fetch(BASE + url);
  if (!res.ok) {
    let msg = `导出失败 (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
