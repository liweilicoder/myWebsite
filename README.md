# 毛泽东选集随机阅读器

一个零依赖 Web 阅读器。它从 `article/` 中读取 Markdown 文章，随机展示一篇文章，并将正文、分页与注释分开展示。可在本地运行，也可部署到 Vercel。

## 功能

- 每次打开首页随机加载一篇本地文章
- 支持“换一篇”、文章目录跳转与翻页阅读
- 自动解析文章标题、日期、正文、引文、小标题和注释
- 正文渲染前转义 HTML，只把受控的 `〔数字〕` 注释标记显示为脚注引用
- 适配窄屏阅读

## 运行

要求：Python 3（只使用标准库，无需安装依赖）。

```bash
python3 main.py
```

启动后在浏览器打开 <http://127.0.0.1:8000>。请保持该终端运行；使用 `Ctrl+C` 停止服务。

## 目录结构

```text
article/          Markdown 文章数据源
main.py           HTTP 服务与 Markdown 解析
index.html        页面结构
static/app.js     随机加载、目录、分页和注释渲染
static/style.css  样式与响应式布局
static/*.png      本地图片资源
```

`article/` 内的内容是原始数据源，不应由服务或页面代码改写、迁移或重命名。

## API

| 路径 | 说明 |
| --- | --- |
| `GET /` | 阅读器首页；加载后请求随机文章 |
| `GET /api/random` | 返回随机一篇可用文章 |
| `GET /api/articles` | 返回全部可用文章的 ID 和标题 |
| `GET /api/article/<id>` | 按文章 ID 返回指定文章；不存在时返回 404 |

文章响应包含以下字段：

```json
{
  "id": "001",
  "title": "文章标题",
  "date": "（日期）",
  "body": [
    { "kind": "paragraph", "text": "正文" },
    { "kind": "heading", "text": "小标题" },
    { "kind": "quote", "text": "引文" }
  ],
  "notes": [
    { "number": "1", "text": "注释内容" }
  ]
}
```

服务只会在启动目录下已发现的文章 ID 中查找文章，不会把 URL 参数直接当作文件路径。

## 验证

在一个终端启动服务后，另一个终端执行：

```bash
python3 -m py_compile main.py
curl -fsS http://127.0.0.1:8000/api/random
```

再在浏览器检查首页加载、“换一篇”、目录跳转、分页和注释区域是否正常工作。

## 部署到 Vercel

1. 使用 GitHub 登录 [Vercel](https://vercel.com/)，选择 **New Project**。
2. 导入本仓库，选择 **Other** 作为 Framework Preset，Root Directory 保持仓库根目录。
3. 不需要 Build Command、环境变量或第三方依赖；点击 **Deploy**。

Vercel 会通过 `main:handler` 服务首页、静态资源和现有文章 API。每次推送到生产分支会更新生产站点；其他分支和 Pull Request 会创建预览部署。

### 绑定自定义域名

在 Vercel 项目的 **Settings → Domains** 中添加根域名与 `www` 子域名，并在现有 DNS 服务商处按 Vercel 页面给出的精确值配置记录。将 `www` 设为主域名，再把根域名重定向到 `www`。验证通过后，Vercel 会自动签发 HTTPS 证书。
