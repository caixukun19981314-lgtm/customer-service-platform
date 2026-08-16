# 客服平台后台 v0.1

这是第一版可运行原型，目标是先把你要求的后台配置中心搭起来：

- 总管理员登录
- 聊天插件管理
- 自动化管理
- 客服小组管理
- 快捷入口生成
- 插件 → 自动化 → 客服组的独立线路
- `/go/...` 平台入口路由验证
- 官方渠道占位（后续接 WhatsApp / Messenger / Instagram / Telegram / Email / YouTube）

## 运行

需要 Node.js 18+。

```bash
npm start
```

然后打开 `http://localhost:3000`

演示账号：
- 邮箱：`admin@demo.local`
- 密码：`admin123`

## 下一阶段

1. 真正的数据库与密码哈希
2. 商家注册 / 多租户
3. 客服子账号与 RBAC
4. 实时 WebSocket 聊天
5. 聊天 Widget 生成与安装代码
6. 可视化 AI 自动化流程
7. 快捷入口与插件绑定校验
8. 客服分配规则
9. 知识库 / AI API
10. 官方社交媒体 OAuth/API 集成
