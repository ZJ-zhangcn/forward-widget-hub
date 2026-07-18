# Forward Widget Hub

自托管 Forward App 模块/订阅托管。

**当前分支 `optimize-security-admin-features`**：安全/后台特性分支；日常部署请用 `main`。

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/ZJ-zhangcn/forward-widget-hub |
| 上游 | https://github.com/InchStudio/forward-widget-hub |
| 自用站 | https://fwd.942645.xyz |

## 部署

### Docker

```bash
git clone https://github.com/ZJ-zhangcn/forward-widget-hub.git
cd forward-widget-hub
# 按需改 docker-compose.yml 的 SITE_URL
docker compose up -d
# http://localhost:3000
```

### Cloudflare Workers

推送 `main` 或按仓库 `deploy.yml` / Cloudflare 按钮部署。会用到 D1 + R2。

## 常用环境变量

| 变量 | 作用 |
|---|---|
| `SITE_URL` | 对外访问根 URL（影响生成的订阅链接） |
| `ACCESS_PASSWORD` | 开启后上传/转存/代理需校验 |
| `MAX_COLLECTIONS_PER_USER` | 单用户合集上限（可选） |
| `MAX_MODULES_PER_COLLECTION` | 单合集模块上限（可选） |

## 使用

1. 打开站点，首次上传会生成管理令牌（请保存链接）  
2. 上传 `.js` / `.fwd`，或粘贴远程 URL 转存  
3. 合集页复制 `.fwd` 订阅链接，导入 Forward App  

## Fork 增强（摘要）

访问密码保护、远程导入 SSRF 防护、合集可见性（public/unlisted/private）、备份恢复、GHCR 镜像发布。

