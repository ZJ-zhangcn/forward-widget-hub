# Forward Widget Hub

自托管 [Forward App](https://apps.apple.com/app/id6503940939) 的模块 / `.fwd` 订阅托管平台。  
Fork 自 [`InchStudio/forward-widget-hub`](https://github.com/InchStudio/forward-widget-hub)。

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/ZJ-zhangcn/forward-widget-hub |
| 默认分支 | `main`（部署） |
| 上游 | https://github.com/InchStudio/forward-widget-hub |
| 镜像 | `ghcr.io/zj-zhangcn/forward-widget-hub:latest`（另有 `:sha`） |
| 自用站 | https://fwd.942645.xyz |
| 上游演示 | https://forward-widget-hub.danmu.workers.dev （勿当生产） |

**当前文档对应分支：`feat/single-user-mode`（历史/特性）。日常部署请用 `main`。**

## 与上游的主要区别

| 能力 | 说明 |
|---|---|
| 访问保护 | `ACCESS_PASSWORD` 后上传 / URL 转存 / 代理接口校验 Cookie·令牌 |
| SSRF 防护 | 限制远程体积；拦 localhost / 内网 / link-local / 非 HTTP(S) / 带用户信息 URL |
| 合集可见性 | `public` / `unlisted` / `private` + 可选配额 |
| 单用户模式 | `SINGLE_USER_MODE` + `OWNER_TOKEN`，多设备同一套合集 |
| 管理后台 | `/admin`：合集/模块、备份恢复、同步预览、历史版本 |
| 首页 | 合集展示开关、隐藏 disabled、图标从客户端网络加载等 |
| 镜像与发布 | GHCR `docker-publish.yml`；可选 Netcup SSH 自动部署 secrets |
| 构建 | Dockerfile 可用 ECR 公共 Node 镜像源，减轻 Docker Hub 限流 |

## 部署方式

### 方式 A：Docker Compose（自建 VPS，推荐）

```bash
git clone -b main https://github.com/ZJ-zhangcn/forward-widget-hub.git
cd forward-widget-hub
```

生产建议改成 **拉 GHCR 镜像**（不要在 VPS 上 build）：

```yaml
services:
  forward-widget-hub:
    image: ghcr.io/zj-zhangcn/forward-widget-hub:latest
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./data:/data
    environment:
      SITE_URL: https://fwd.example.com
      ACCESS_PASSWORD: "你的访问密码"
      # ADMIN_PASSWORD: "管理后台密码"
      # SINGLE_USER_MODE: "true"
      # OWNER_TOKEN: "fwt_..."   # python3 -c "import secrets; print('fwt_'+secrets.token_urlsafe(32))"
      # PUBLIC_COLLECTION_SLUGS: all
    restart: unless-stopped
```

```bash
docker compose pull
docker compose up -d
curl -sS -o /dev/null -w '%{http_code}
' http://127.0.0.1:3000/
```

仓库自带 `docker-compose.yml` 默认是 `build: .`，适合开发；生产请改用上面的 `image:`。

### 方式 B：GitHub Actions → GHCR（+ 可选自动 SSH 部署）

推送 `main` 触发：

1. 构建并推送 `ghcr.io/zj-zhangcn/forward-widget-hub`  
2. 若配置了 `NETCUP_HOST` / `NETCUP_USER` / `NETCUP_SSH_KEY`（及可选 `NETCUP_PORT`）则 SSH 到 VPS 更新  

未配置 secrets 时只发镜像、跳过远端部署。

### 方式 C：Cloudflare Workers

可用 Cloudflare 一键/Wrangler 路径（D1 + R2）。  
`SITE_URL`、访问密码等与 Docker 类似；Worker 专有绑定见 `wrangler.toml`。

## 使用流程

1. 打开站点；若设了 `ACCESS_PASSWORD` 先登录  
2. 首次上传会生成 **管理令牌链接**（务必收藏）  
3. 上传 `.js` / `.fwd`，或粘贴远程 URL 转存  
4. 合集页复制 `.fwd` 订阅链接 → Forward App 导入  
5. 管理维护走 `/admin`（需 `ADMIN_PASSWORD`）

## 环境变量速查

| 变量 | 作用 |
|---|---|
| `SITE_URL` | 对外根 URL（影响订阅链接） |
| `ACCESS_PASSWORD` | 全站访问/上传保护 |
| `ADMIN_PASSWORD` | `/admin` |
| `SINGLE_USER_MODE` / `OWNER_TOKEN` | 单用户多设备 |
| `PUBLIC_COLLECTION_SLUGS` | 首页公开合集过滤 |
| `MAX_COLLECTIONS_PER_USER` / `MAX_MODULES_PER_COLLECTION` | 配额 |

## 验证

```bash
curl -sS -o /dev/null -w '%{http_code}
' "$SITE_URL/"
curl -sS -o /dev/null -w '%{http_code}
' "$SITE_URL/api/auth"
# 合集订阅
curl -sS "$SITE_URL/api/collections/<slug>/fwd" | head
```

## 其它分支

| 分支 | 说明 |
|---|---|
| `main` | 生产 |
| `feat/single-user-mode` | 单用户模式演进历史 |
| `optimize-security-admin-features` | 安全/后台增强历史 |

新改动请落到 `main`。
