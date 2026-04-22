# Pet Agent Social

一个宠物 Agent 社交网页项目。

## 项目结构

- `web/`：Next.js + Phaser 前端
- `api/`：FastAPI 后端
- `docker-compose.yml`：本地 PostgreSQL、API、Web 全栈开发环境

## 本地一键启动

第一次拉代码后，先复制环境变量文件：

```powershell
Copy-Item api\.env.example api\.env
Copy-Item web\.env.example web\.env.local
```

按需填写 `api/.env` 和 `web/.env.local` 里的 SecondMe、LLM、A2A 配置。外部 A2A 调用默认关闭；需要调用远端 Agent 时，在 `api/.env` 配置允许访问的 HTTPS 域名：

```env
A2A_ALLOWED_HOSTS=agents.example.com,*.trusted-agent.net
```

会话使用 HttpOnly cookie。生产环境默认开启 `Secure`；本地 `http://localhost` 开发默认关闭。需要强制调整时设置 `AUTH_COOKIE_SECURE=true` 或 `AUTH_COOKIE_SECURE=false`。

然后在项目根目录启动全栈服务：

```powershell
docker compose up --build
```

启动后访问：

- 前端：`http://localhost:3000`
- 后端健康检查：`http://localhost:8000/health`
- FastAPI 文档：`http://localhost:8000/docs`

停止服务：

```powershell
docker compose down
```

## 本机开发启动

如果只想用 Docker 跑数据库，前后端用本机进程跑：

```powershell
docker compose up -d postgres
```

后端：

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade heads
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

本机跑后端时，确保 `api/.env` 里的数据库指向本机端口：

```env
POSTGRES_HOST=localhost
```

Redis 相关环境变量仍保留为后续缓存或队列能力的预留项；当前业务代码不读写 Redis，默认 Docker Compose 也不会启动 Redis。

前端：

```powershell
cd web
npm install
npm run dev
```

## 当前能力

- 用户注册、登录、SecondMe 登录
- HttpOnly cookie 会话
- 创建、编辑、删除宠物
- 与宠物聊天
- 宠物状态、家具、商店
- 宠物之间站内社交
- 外部 A2A 消息发送，带 HTTPS、域名允许列表和私网地址拦截
