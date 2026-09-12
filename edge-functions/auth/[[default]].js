// EdgeOne Pages · Edge Function：CloudBase Auth V2 网关反代
// 路由：/auth/* → https://rain-d3ggdsj6a9cc1c4ea.api.tcloudbasegateway.com/auth/*
//
// 背景：CloudBase JS SDK 注册 GATEWAY 端点后，Auth 请求（signin/verification 等）
// 会发到同源 /auth/v1/*。边缘函数以服务端身份转发，不受「安全域名」限制。
//
// 文件位置对应：edge-functions/auth/[[default]].js → 捕获 /auth/ 后的任意层级路径

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
  // 保留 /auth/ 前缀，完整路径转发到网关
  const target = `${UPSTREAM}${url.pathname}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  // Edge Function 请求体上限 1MB，登录/验证码请求远小于此，直接缓冲转发
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
