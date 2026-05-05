# Simon Blog

我的个人 IT 技术博客源码仓库，基于 `Hexo 8.1.1` 搭建，主题为 `Butterfly 5.5.4`。

线上地址：<https://simon7520.github.io/>

## 项目简介

当前分支为 `hexo-source`，用于保存博客的**源码、配置和构建环境**。

仓库采用双分支维护方式：

- `hexo-source`：Hexo 源码分支，用于文章编写、主题配置、插件管理和站点构建
- `master`：部署分支，用于保存生成后的静态站点文件，并由 `GitHub Pages` 直接发布

日常开发、文章更新、主题修改和配置调整，都应在 `hexo-source` 分支完成；站点构建完成后，再将生成结果发布到 `master` 分支。

## 技术栈

- 博客框架：`Hexo 8.1.1`
- 主题：`Butterfly 5.5.4`
- 包管理器：`pnpm 9`
- Node.js：`>= 20.0.0`
- 部署方式：`hexo-deployer-git` + `GitHub Pages`

## 分支说明

### `hexo-source`

源码分支，主要包含：

- 站点配置文件 `_config.yml`
- 主题配置文件 `_config.butterfly.yml`
- 文章与页面源文件 `source/`
- 脚手架模板 `scaffolds/`
- 依赖配置 `package.json`
- 主题子模块 `themes/butterfly`

### `master`

部署分支，主要包含：

- Hexo 生成后的 HTML 文件
- CSS / JavaScript / 图片 / 字体等静态资源
- `search.xml` 等搜索索引

## 环境要求

开始前请先确认本地环境：

- 已安装 `Node.js 20` 或更高版本
- 已安装 `pnpm 9` 或兼容版本
- 已安装 `Git`
- 已具备 GitHub SSH 推送权限，用于部署到远程仓库

如果是首次拉取仓库，建议同时初始化主题子模块。

## 快速开始

### 1. 克隆仓库

如果你是首次拉取项目，推荐使用：

```bash
git clone --recurse-submodules git@github.com:Simon7520/simon7520.github.io.git
cd simon7520.github.io
git checkout hexo-source
```

如果仓库已经拉取，但主题子模块尚未初始化，可执行：

```bash
git submodule update --init --recursive
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动本地开发环境

项目中已配置以下脚本：

```bash
pnpm start
pnpm dev
pnpm server
pnpm build
pnpm clean
pnpm deploy
```

常用方式如下：

- `pnpm server`：启动 Hexo 本地服务
- `pnpm dev`：以端口 `80` 启动本地服务
- `pnpm build`：生成静态文件到 `public/`
- `pnpm clean`：清理构建产物
- `pnpm deploy`：生成并部署到远程仓库配置的 `master` 分支

如果本地不希望占用 `80` 端口，推荐直接使用：

```bash
pnpm server
```

或者手动指定端口：

```bash
npx hexo server -p 4000
```

## 常用工作流

### 新建文章

```bash
npx hexo new post "文章标题"
```

生成后的文章通常会出现在：

```text
source/_posts/
```

当前仓库已开启：

- `post_asset_folder: true`
- `marked.postAsset: true`

因此文章插图资源可以和文章同目录维护，便于管理本地图片素材。

### 新建页面

```bash
npx hexo new page "about"
```

### 本地预览

```bash
pnpm start
```

默认可在浏览器访问：

```text
http://localhost:80
```

### 构建静态文件

```bash
pnpm run clean
pnpm run build
```

构建结果会输出到：

```text
public/
```

### 部署到 `master`

当前 `_config.yml` 中已配置：

- 部署类型：`git`
- 部署仓库：`git@github.com:Simon7520/simon7520.github.io.git`
- 部署分支：`master`

执行以下命令即可生成并部署：

```bash
pnpm run deploy
```

## 目录结构

```text
.
├── .github/                  # GitHub 配置
├── scaffolds/                # Hexo 脚手架模板
├── source/                   # 站点源文件
│   ├── _posts/               # 博客文章
│   ├── about/                # 关于页
│   ├── categories/           # 分类页
│   ├── tags/                 # 标签页
│   ├── css/                  # 自定义样式资源
│   ├── js/                   # 自定义脚本资源
│   ├── img/                  # 图片资源
│   └── fonts/                # 字体资源
├── themes/
│   └── butterfly/            # Butterfly 主题子模块
├── _config.yml               # Hexo 主配置
├── _config.butterfly.yml     # Butterfly 主题配置
├── package.json              # 项目依赖与脚本
├── pnpm-lock.yaml            # pnpm 锁文件
└── README.md
```

## 主题与自定义内容

项目使用 `Butterfly` 主题，并通过子模块方式引入：

- 子模块路径：`themes/butterfly`
- 子模块仓库：<https://github.com/jerryc127/hexo-theme-butterfly>

当前还有一些额外的自定义资源：

- `source/css/custom.css`
  - 页面头图和背景模糊渐入
  - APlayer 悬浮交互样式
  - 自定义鼠标样式
  - 页脚和头图透明度调整

- `source/js/diytitle.js`
  - 页面切出与返回时动态修改浏览器标签标题

- `source/js/grayscale.js`
  - 特定纪念日全站灰度显示

- `source/js/cursor.js`
  - 动画光标相关预留逻辑

## 关键配置说明

从当前配置来看，站点的几个关键点如下：

- 站点地址：`https://simon7520.github.io`
- 主题：`butterfly`
- 永久链接：`posts/:abbrlink`
- 搜索索引：`search.xml`
- 部署分支：`master`
- 文章资源目录：已开启

如果需要修改站点标题、导航、社交链接、首页背景、代码高亮、版权声明等内容，优先检查：

- `_config.yml`
- `_config.butterfly.yml`

## 发布建议

- 所有内容更新优先在 `hexo-source` 分支完成
- 发布前建议执行一次 `pnpm run clean && pnpm run build`
- 确认本地预览正常后，再执行 `pnpm run deploy`
- 不建议直接在 `master` 分支手工修改静态文件，避免与源码分支脱节
- 如果在 `master` 有紧急修复，建议尽快同步回 `hexo-source`

## 许可证

仓库中的博客内容、图片和自定义资源默认遵循作者自己的使用约定。  
当前站点文章版权声明为 `CC BY-NC-SA 4.0`，转载或复用前请先确认具体文章的版权说明。
