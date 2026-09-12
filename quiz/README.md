# 口算挑战（math-quiz）

面向小学生的分阶段口算练习应用：按学期/单元逐步解锁，支持选择与手填两种作答方式、错题本、每日统计与多使用者档案。

## 技术栈

- React 18 + Vite 5（纯前端 SPA）
- 腾讯云 CloudBase PostgreSQL（云端主存储）+ 浏览器 localStorage（本地缓存）
- @cloudbase/js-sdk（PG / rdb 模式）

## 本地开发

```bash
npm install
npm run dev      # 本地开发
npm run build    # 构建到 dist/
npm run lint     # oxlint 检查
```

## 数据存储与云端同步

- **云端（主存储）**：CloudBase PostgreSQL，单表 `public.app_state`（`doc_id` 主键 + `payload` jsonb）：
  - `users`：全部使用者档案
  - `u_<uid>`：单个用户的答题记录、错题本、每日统计、解锁阶段与设置
- 前端使用 **Publishable Key**（anon 角色）+ RLS Policy 授权读写，建表与授权脚本见 `db/schema.sql`
- **浏览器访问路径**：线上同源访问 `/tcb/*`，由 EdgeOne Pages 边缘函数（`edge-functions/tcb/[[default]].js`）反向代理到 CloudBase 网关，绕开体验版「安全域名」无法加自定义域名的限制；localhost 开发时直连网关（默认放行）
- **同步时机**：登录/打开页面时云端优先拉取；答题结束、退出登录、调整年级/模式、修改解锁规则时自动推送
- 同一账号在多台设备错开使用即可无缝衔接、积分连续累计；未配置云端时自动回退纯本地模式
- 连通性自测：`node scripts/selftest-cloud.mjs`
- 更换密钥：控制台不提供删除入口，可用 CloudBase CLI：
  `tcb env apikey list/delete/create -e <envId>`

## 部署

纯静态站点，可部署到 Netlify / EdgeOne Pages / 任意静态托管：

```bash
npm run build      # 产物在 dist/
```

部署后需在 CloudBase「环境配置 → 安全来源 → 安全域名」中加入站点域名（localhost 默认放行）。
