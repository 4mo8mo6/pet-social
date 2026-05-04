# Railway 两服务部署

更新时间：2026-04-22

这个方案适合 Railway 里只保留 2 个服务的情况：

1. `postgres`
2. `app`

其中：

- `postgres` 是 Railway 托管数据库
- `app` 是一个合并服务，同时跑：
  - Next.js 前端
  - FastAPI 后端

不要再额外建：

- `web`
- `api`
- `redis`

---

## 1. 仓库里已经准备好的文件

两服务部署依赖这些文件：

- 根目录 [Dockerfile](/D:/download/下载/pet-agent-social1/pet-agent-social/Dockerfile)
- 根目录 [railway.json](/D:/download/下载/pet-agent-social1/pet-agent-social/railway.json)
- 启动脚本 [start-app.sh](/D:/download/下载/pet-agent-social1/pet-agent-social/deploy/start-app.sh)
- 自动化脚本 [railway-two-service.ps1](/D:/download/下载/pet-agent-social1/pet-agent-social/deploy/railway-two-service.ps1)
- 联动健康检查 [route.ts](/D:/download/下载/pet-agent-social1/pet-agent-social/web/app/api/deploy-health/route.ts)

---

## 2. Railway 里怎么建

### 服务 1：`postgres`

在 Railway Project 里：

1. 点击 `New`
2. 选择 `Database`
3. 选择 `PostgreSQL`
4. 把服务名改成 `postgres`

### 服务 2：`app`

如果代码已经在 GitHub：

1. 点击 `New`
2. 选择 `GitHub Repo`
3. 选择这个仓库
4. 把服务名改成 `app`

然后在 `Settings` 里确认：

- Root Directory: `/`
- Config as Code File: `/railway.json`

---

## 3. `app` 服务需要的环境变量

打开 `app` -> `Variables` -> `RAW Editor`，粘贴：

```env
APP_ENV=production
DATABASE_URL=${{postgres.DATABASE_URL}}
CORS_ALLOWED_ORIGINS=https://${{RAILWAY_PUBLIC_DOMAIN}}

NEXT_PUBLIC_APP_BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_API_BASE_URL=/api/backend
API_BASE_URL=http://127.0.0.1:8000

SECONDME_CLIENT_ID=<填你的 SecondMe Client ID>
SECONDME_CLIENT_SECRET=<填你的 SecondMe Client Secret>
SECONDME_REDIRECT_URI=https://${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/secondme/callback
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SECONDME_TOKEN_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/code
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh

LLM_BASE_URL=https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1
LLM_API_KEY=<填你的 LLM Key>
LLM_MODEL=qwen-flash

PET_AVATAR_GENERATION_URL=https://open.bigmodel.cn/api/paas/v4/images/generations
PET_AVATAR_API_KEY=<填你的智谱 Image Key>
PET_AVATAR_MODEL=glm-image
PET_AVATAR_IMAGE_SIZE=1280x1280
PET_AVATAR_IMAGE_QUALITY=hd
PET_AVATAR_TIMEOUT_SECONDS=60
PET_AVATAR_MEDIA_ROOT=/app/media
```

关键点：

1. `DATABASE_URL` 直接引用 `postgres`
2. 浏览器侧 API 走 `NEXT_PUBLIC_API_BASE_URL=/api/backend`
3. Next 服务端请求 FastAPI 走 `API_BASE_URL=http://127.0.0.1:8000`
4. 如果你要启用宠物生图，`PET_AVATAR_*` 这一组变量必须一起配置

---

## 4. 宠物图片持久化

宠物生成图片现在会落盘到 `PET_AVATAR_MEDIA_ROOT`，默认就是：

```text
/app/media
```

所以很建议你给 `app` 服务挂一个 Railway Volume，并把挂载路径设置成：

```text
/app/media
```

这样生成出来的宠物头像不会因为服务重启、重新部署或实例替换而丢失。

如果不挂 Volume：

- 生图功能依然能工作
- 但历史生成图片可能会在重新部署后消失

---

## 5. `app` 服务要开公网域名

打开 `app` -> `Settings` -> `Networking` -> `Public Networking`

点击：

- `Generate Domain`

你会拿到一个地址，例如：

- `https://xxxxx.up.railway.app`

这个域名同时用于：

- 网站首页
- 同域 API 代理
- SecondMe 回调

---

## 6. Railway 怎么判断服务健康

这个两服务方案里，Railway 健康检查已经写在根目录 `railway.json` 里：

- healthcheck path: `/api/deploy-health`

这个地址不只是看前端是否活着，它还会继续检查内部 FastAPI 的 `/health`。

也就是说：

- 如果 Next.js 正常但 FastAPI 挂了
- Railway 仍然会把这个服务判断为不健康

---

## 7. 部署顺序

按这个顺序走最快：

1. 建 `postgres`
2. 建 `app`
3. 给 `app` 粘贴环境变量
4. 给 `app` 挂 `Volume` 到 `/app/media`
5. 给 `app` 生成公网域名
6. 部署 `app`
7. 打开 `https://<app-domain>/api/deploy-health`
8. 确认返回 `status: ok`

然后再检查：

- `https://<app-domain>/`
- `https://<app-domain>/support`
- `https://<app-domain>/privacy`
- `https://<app-domain>/login`

---

## 8. SecondMe callback 怎么填

部署成功后，把 SecondMe External App 的 callback 改成：

```text
https://<app-domain>/api/auth/secondme/callback
```

注意：

- 两服务方案里没有单独的 `web-domain`
- 只有一个 `app-domain`

---

## 9. 推荐验证顺序

最省事的验证顺序是：

1. `https://<app-domain>/api/deploy-health`
2. `https://<app-domain>/`
3. `https://<app-domain>/login`
4. 走一遍 SecondMe 登录
5. 创建一个宠物
6. 确认宠物头像能从 `pending` 变成 `ready`

---

## 10. 本地自动化脚本

仓库里已经带了一个自动化脚本：

- [railway-two-service.ps1](/D:/download/下载/pet-agent-social1/pet-agent-social/deploy/railway-two-service.ps1)

这个脚本现在会自动读取本地 `api/.env` 和 `web/.env.local`，并同步这些关键信息到 Railway：

- SecondMe 配置
- LLM 配置
- 宠物头像生图配置 `PET_AVATAR_*`

前提是：

- 你已经安装 Railway CLI
- Railway CLI 已登录

运行方式：

```powershell
cd deploy
.\railway-two-service.ps1
```

---

## 11. 上线后回填的地址

部署成功后，建议把这些地址整理好：

```text
websiteUrl=https://<app-domain>/
supportUrl=https://<app-domain>/support
privacyPolicyUrl=https://<app-domain>/privacy
iconUrl=https://<app-domain>/secondme/pet-agent-social-icon.svg
redirectUri=https://<app-domain>/api/auth/secondme/callback
```
