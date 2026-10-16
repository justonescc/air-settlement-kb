# 给开发同事 / Cursor

## 浏览器同事（含钉钉）

把本站首页链接发到钉钉群即可，对方用手机或电脑浏览器打开阅读，**不需要安装 Cursor**。

## Cursor 同事（知识库 + Skill）

1. Clone 本仓库到本地  
2. 用 Cursor 打开仓库根目录  
3. Skill 路径：`.cursor/skills/diagnosing-air-settlement-missing-orders/`  
4. 知识库路径：`docs/settlement-kb/air/`  
5. 在 Agent 中说例如：「机票结算报表缺单，OrderID=……」

Agent 会按 skill 加载 Playbook（P0–P6）进行只读排查。

## 本地预览文档站（可选）

```bash
npm install
npm run docs:dev
```

浏览器打开终端提示的本地地址即可。

## 安全提醒

- 不要把含明文数据库密码的排查脚本提交进本仓库  
- 文档与示例 SQL 禁止写入真实主机、账号、密码、连接串  
