// EdgeOne Pages · Edge Function：CloudBase 网关反向代理
// 路由：/tcb/* → https://rain-d3ggdsj6a9cc1c4ea.api.tcloudbasegateway.com/*
//
// 背景：CloudBase「安全域名」白名单只校验浏览器来源，体验版无法添加自定义域名；
// 边缘节点以服务端身份转发，不受该限制。前端同源访问 /tcb/* 即可无感读写云端。
//
// 文件位置对应：edge-functions/tcb/[[default]].js → 捕获 /tcb/ 后的任意层级路径

const UPSTREAM = 'https://rain-d3ggdsj6a9cc1c4ea.api.tcloudbasegateway.com';

// 这些浏览器侧/逐跳头不应转发给上游
const STRIP_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'origin',
  'referer',
  'cookie',
  'content-length',
]);

export default async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  // 去掉 /tcb 前缀，保留剩余路径与查询串
  const rest = url.pathname.replace(/^\/tcb\/?/, '');
  const target = `${UPSTREAM}/${rest}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  // Edge Function 请求体上限 1MB，本应用数据远小于此，直接缓冲转发
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const respHeaders = new Headers(upstream.headers);
  // 同源访问无需 CORS，移除上游相关头避免重复
  respHeaders.delete('access-control-allow-origin');
  respHeaders.delete('access-control-allow-credentials');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}
