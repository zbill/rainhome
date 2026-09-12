// 直接加载 edge-functions 里的代理函数真实代码，构造请求验证转发链路
// （边缘函数的路由由平台按约定生成，这里验证函数内部逻辑与 CloudBase 的真实交互）
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

const handlerUrl = pathToFileURL(
  'E:\\math-quiz\\edge-functions\\tcb\\[[default]].js'
).href;
const mod = await import(handlerUrl);
const onRequest = mod.default;

// 从 api.js 提取 Publishable Key
const src = readFileSync('E:\\math-quiz\\src\\lib\\api.js', 'utf8');
const KEY = src.match(
  /const ACCESS_KEY\s*=\s*[\r\n]?\s*'([^']+)'/
)[1];

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const req = new Request(`http://local.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...headers },
    body,
  });
  const res = await onRequest({ request: req });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON */
  }
  return { status: res.status, json, text: text.slice(0, 300) };
}

// 1) GET 空表（期望 200 + 数组）
const g1 = await call('/tcb/v1/rdb/rest/app_state?select=payload');
console.log('1) GET 列表:', g1.status, JSON.stringify(g1.json));

// 2) 写入测试行：SDK upsert 实为 POST + Prefer: resolution=merge-duplicates
const putBody = JSON.stringify({
  doc_id: '_selftest',
  payload: { ok: true, via: 'edge-proxy' },
});
const p1 = await call('/tcb/v1/rdb/rest/app_state?on_conflict=doc_id', {
  method: 'POST',
  body: putBody,
  headers: {
    'content-type': 'application/json',
    prefer: 'resolution=merge-duplicates',
  },
});
console.log('2) POST upsert:', p1.status, p1.text);

// 3) GET 条件查询刚写入的行
const g2 = await call(
  '/tcb/v1/rdb/rest/app_state?select=payload&doc_id=eq._selftest'
);
console.log('3) GET 回读:', g2.status, JSON.stringify(g2.json));

const pass =
  g1.status === 200 &&
  Array.isArray(g1.json) &&
  p1.status >= 200 &&
  p1.status < 300 &&
  g2.json?.[0]?.payload?.via === 'edge-proxy';
console.log(pass ? '\nPASS：代理函数转发 CloudBase 链路正常' : '\nFAIL：见上');
process.exit(pass ? 0 : 1);
