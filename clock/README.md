# 时钟学习应用

一个功能完整的时钟学习应用，支持多种学习模式，适合儿童和初学者学习认识时钟。

## 功能特性

- **读指针模式**：根据指针位置输入正确的时间
- **拨指针模式**：根据给定的时间调整指针位置
- **认表模式**：自由调整指针和数字时间，学习时钟原理
- **实时钟表模式**：显示当前实际时间，指针和数字同步更新
- **响应式设计**：适配电脑和移动设备
- **触摸支持**：在平板等触摸设备上支持触摸操作
- **指针控制按钮**：提供按键控制指针转动，支持长按加速

## 技术栈

- React 18
- Vite
- CSS3

## 环境要求

- Node.js 16.0 或更高版本
- npm 7.0 或更高版本

## 环境安装

### Windows 系统

1. **下载 Node.js 安装包**：
   - 访问 [Node.js 官方网站](https://nodejs.org/en/download/)
   - 下载适合 Windows 的 LTS 版本（推荐）
   - 运行安装程序，按照提示完成安装

2. **验证安装**：
   - 打开命令提示符（CMD）或 PowerShell
   - 运行以下命令：
     ```bash
     node -v
     npm -v
     ```
   - 应显示安装的 Node.js 和 npm 版本

### macOS 系统

1. **下载 Node.js 安装包**：
   - 访问 [Node.js 官方网站](https://nodejs.org/en/download/)
   - 下载适合 macOS 的 LTS 版本（推荐）
   - 运行安装程序，按照提示完成安装

2. **验证安装**：
   - 打开终端
   - 运行以下命令：
     ```bash
     node -v
     npm -v
     ```
   - 应显示安装的 Node.js 和 npm 版本

## 项目安装步骤

1. **克隆仓库**：
   ```bash
   git clone https://github.com/your-username/clock-learning-app.git
   cd clock-learning-app
   ```

2. **安装依赖**：
   ```bash
   npm install
   ```

3. **启动开发服务器**：
   ```bash
   npm run dev
   ```

4. **构建生产版本**：
   ```bash
   npm run build
   ```

## 使用方法

1. **选择模式**：在主界面选择所需的学习模式
2. **操作指针**：
   - 电脑：鼠标拖动指针
   - 平板/手机：触摸拖动指针或使用控制按钮
3. **控制按钮**：
   - 点击按钮：指针转动一格
4. **实时模式**：自动显示当前时间，无需手动操作

## 项目结构

```
clock-learning-app/
├── src/
│   ├── App.jsx          # 主应用组件
│   ├── index.css        # 样式文件
│   └── main.jsx         # 应用入口
├── public/               # 静态资源
├── package.json          # 项目配置
├── vite.config.js        # Vite 配置
├── .gitignore           # Git 忽略文件
└── README.md             # 项目说明
```

## 浏览器支持

- Chrome (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- Edge (最新版本)

## 许可证

MIT License