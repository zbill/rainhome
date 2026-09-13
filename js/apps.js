/* =========================================================
   Rainlet 应用中心 - 应用数据配置
   新增应用只需在这里追加一个对象即可，无需改动页面结构。

   字段说明：
   - name:   应用名称
   - desc:   应用简介
   - icon:   图标 SVG 路径（复用各应用自己的 favicon.svg）
   - url:    正式应用填站内路径，预告卡片填 null
   - domain: 正式应用的访问域名（卡片底部展示）
   - soon:   true 表示"即将上线"预告卡片，不参与计数、无跳转
   ========================================================= */

const APPS = [
  {
    name: "数学口算",
    desc: "针对小学生的口算训练工具，可自由选择数字范围与难度，反复练习、即时判对。",
    icon: "/quiz/favicon.svg",
    url: "/quiz/",
    domain: "rainlet.cn/quiz"
  },
  {
    name: "时钟学习",
    desc: "帮助孩子认识时钟、理解时分读法的小游戏，直观、有趣、易上手。",
    icon: "/clock/favicon.svg",
    url: "/clock/",
    domain: "rainlet.cn/clock"
  },
  {
    name: "更多应用",
    desc: "规划中，敬请期待。欢迎发邮件提需求～",
    icon: "/icons/coming-soon.svg",
    url: null,
    soon: true
  }
];

/* 渲染应用卡片 */
function renderApps() {
  const container = document.querySelector(".apps");
  if (!container) return;

  container.replaceChildren();

  let appCount = 0;

  APPS.forEach((app) => {
    const isSoon = !!app.soon;

    /* 预告卡片用 div，正式卡片用 a */
    const card = document.createElement(isSoon ? "div" : "a");
    card.className = "app-card" + (isSoon ? " soon" : "");

    if (!isSoon) {
      card.href = app.url;
      card.target = "_blank";
      card.rel = "noopener";
    }

    /* 图标 —— 统一用 <img> 加载 SVG */
    const icon = document.createElement("img");
    icon.className = "app-icon";
    icon.src = app.icon;
    icon.alt = app.name;
    icon.loading = "lazy";

    /* 图标 + 标题同一行 */
    const name = document.createElement("span");
    name.className = "app-name";
    name.textContent = app.name;

    const titleRow = document.createElement("div");
    titleRow.className = "app-title-row";
    titleRow.append(icon, name);

    const desc = document.createElement("span");
    desc.className = "app-desc";
    desc.textContent = app.desc;

    /* 预告卡片不显示 domain 行，换成一个"敬请期待"的 tag */
    if (isSoon) {
      const badge = document.createElement("span");
      badge.className = "app-badge";
      badge.textContent = "即将上线";
      card.append(titleRow, desc, badge);
    } else {
      const domain = document.createElement("span");
      domain.className = "app-domain";
      domain.textContent = app.domain;
      card.append(titleRow, desc, domain);
      appCount++;
    }

    container.appendChild(card);
  });

  const countEl = document.getElementById("appCount");
  if (countEl) countEl.textContent = appCount;
}

document.addEventListener("DOMContentLoaded", renderApps);

/* 页脚年份 */
document.getElementById("year").textContent = new Date().getFullYear();
