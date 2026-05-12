# TV+ Galaxy - Apple TV 剧集聚合

## 数据源方案

### 推荐：TMDB (The Movie Database) + 本地定时更新

TMDB 是互联网最大的影视数据库，免费，数据全，包含 Apple TV+ 所有剧集的海报、简介、评分、分类、更新状态。

#### 第一步：获取 TMDB API Key

1. 访问 https://www.themoviedb.org/
2. 注册账号
3. 进入 `Settings -> API` 页面
4. 申请 API Key（免费，即时通过）
5. 复制 `API Read Access Token`

#### 第二步：配置

打开 `config.json`，填入你的 API Key：

```json
{
  "tmdbApiKey": "你的_API_Key",
  "networkId": 2552,
  "updateIntervalHours": 24
}
```

> `networkId` 2552 是 Apple TV+ 在 TMDB 上的 ID。如果后续发现数据不对，可以上 TMDB 搜 Apple TV+ 确认。

#### 第三步：拉取数据

```bash
cd tv-galaxy
node scripts/fetch-data.js
```

运行后会生成 `data.json`，页面自动读取这个文件展示数据。

#### 第四步：Windows 定时自动更新

1. 打开 `任务计划程序`
2. 创建基本任务 -> 每天运行
3. 操作：启动程序
4. 程序：`node`
5. 参数：`scripts/fetch-data.js`
6. 起始于：`C:\Users\quanquan.shang\CodeProject\tv-galaxy`

或者更简单：双击运行 `scripts/update.bat`

---

### 备选方案：前端直调（不推荐长期使用）

如果你只想快速看一下效果，可以不跑脚本，直接改 `index.html` 里的 `TMDB_API_KEY` 常量，页面会在浏览器里实时调用 TMDB API。

缺点：API Key 暴露在源码里，刷新频繁会触发限流。

---

### 数据来源说明

| 数据项 | 来源 | 说明 |
|--------|------|------|
| 剧集列表 | TMDB discover API | 按 network=Apple TV+ 筛选 |
| 海报图片 | TMDB image CDN | `image.tmdb.org/t/p/w300/` |
| 简介 | TMDB overview | 中文简介取决于 TMDB 上是否有翻译 |
| 评分 | TMDB vote_average | 0-10 分 |
| 分类/标签 | TMDB genres | 剧情、科幻、喜剧等 |
| 更新状态 | TMDB last_episode_to_air | 最新集播出日期 |

---

## 文件结构

```
tv-galaxy/
  index.html          # 前端页面（纯静态，可直接双击打开）
  data.json           # 剧集数据（由 fetch-data.js 生成）
  config.json         # 配置文件（API Key）
  scripts/
    fetch-data.js     # 数据拉取脚本
    update.bat        # Windows 一键更新脚本
```
