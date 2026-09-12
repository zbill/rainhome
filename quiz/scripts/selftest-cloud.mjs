// CloudBase 连通性自测：与前端 api.js 完全相同的链路（Publishable Key + rdb）
// 用法：node scripts/selftest-cloud.mjs
import { readFileSync } from 'fs';
import cloudbase from '@cloudbase/js-sdk';

const ENV_ID = 'rain-d3ggdsj6a9cc1c4ea';
const src = readFileSync(
  new URL('../src/lib/api.js', import.meta.url),
  'utf8'
);
const ACCESS_KEY = src.match(
  /const ACCESS_KEY\s*=\s*[\r\n]?\s*'([^']+)'/
)[1];
const TABLE = 'app_state';
const DOC = '_selftest';

const app = cloudbase.init({ env: ENV_ID, accessKey: ACCESS_KEY });
const rdb = app.rdb();

async function getRow() {
  const { data, error } = await rdb
    .from(TABLE)
    .select('payload')
    .eq('doc_id', DOC)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0].payload : null;
}

async function putRow(payload) {
  const { error } = await rdb
    .from(TABLE)
    .upsert({ doc_id: DOC, payload }, { onConflict: 'doc_id' });
  if (error) throw error;
}

try {
  const before = await getRow();
  console.log('1) 初始读取（期望 null）:', before);

  const marker = { ok: true, at: new Date().toISOString() };
  await putRow(marker);
  console.log('2) upsert 写入成功');

  const after = await getRow();
  const pass = after && after.ok === true;
  console.log('3) 回读（期望写入内容）:', after);

  await putRow({ cleaned: true });
  console.log('4) 已清理测试行');

  console.log(pass ? '\nPASS：云端读写链路正常' : '\nFAIL：回读内容不符');
  process.exit(pass ? 0 : 1);
} catch (e) {
  console.error('\nFAIL：', e);
  process.exit(1);
}
