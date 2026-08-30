/* =========================================================
   Rainlet 应用中心 - 应用数据配置
   新增应用只需在这里追加一个对象即可，无需改动页面结构。
   ========================================================= */

const APPS = [
  {
    name: "数学口算",
    desc: "针对小学生的口算训练工具，可自由选择数字范围与难度，反复练习、即时判对。",
    icon: "🧮",
    url: "https://math-quiz.rainlet.cn",
    domain: "math-quiz.rainlet.cn"
  },
  {
    name: "时钟学习",
    desc: "帮助孩子认识时钟、理解时分读法的小游戏，直观、有趣、易上手。",
    icon: "⏰",
    url: "https://clock.rainlet.cn",
    domain: "clock.rainlet.cn"
  }
];

/* 渲染应用卡片 */
function renderApps() {
  const container = document.querySelector(".apps");
  if (!container) return;

  container.replaceChildren();

  APPS.forEach((app) => {
    const card = document.createElement("a");
    card.className = "app-card";
    card.href = app.url;
    card.target = "_blank";
    card.rel = "noopener";

    const icon = document.createElement("span");
    icon.className = "app-icon";
    icon.textContent = app.icon;

    const meta = document.createElement("span");
    meta.className = "app-meta";

    const name = document.createElement("span");
    name.className = "app-name";
    name.textContent = app.name;

    const desc = document.createElement("span");
    desc.className = "app-desc";
    desc.textContent = app.desc;

    const domain = document.createElement("span");
    domain.className = "app-domain";
    domain.textContent = app.domain;

    meta.append(name, desc, domain);
    card.append(icon, meta);
    container.appendChild(card);
  });

  const count = document.getElementById("appCount");
  if (count) count.textContent = APPS.length;
}

document.addEventListener("DOMContentLoaded", renderApps);

/* 页脚年份 */
document.getElementById("year").textContent = new Date().getFullYear();