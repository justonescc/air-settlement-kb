---
layout: home
hero:
  name: 机票结算知识库
  text: 缺单排查与结算事实
  tagline: 浏览器直接阅读；钉钉转发本站链接。开发同事可配合 Cursor Skill 使用。
  actions:
    - theme: brand
      text: 缺单排查 Playbook
      link: /missing-order-playbook
    - theme: alt
      text: 生成链路
      link: /pipeline
    - theme: alt
      text: 给 Cursor 同事
      link: /for-developers
features:
  - title: 人读
    details: 按 Playbook 逐步核对「有订单、无报表」或「有行但页面看不到」。
  - title: Agent
    details: 仓库内附带 diagnosing-air-settlement-missing-orders skill，用 Cursor 打开本仓库即可。
  - title: 安全
    details: 文档不含数据库密码与连接串；查询一律用占位符。
---

## 文档目录

| 文档 | 内容 |
|---|---|
| [生成链路](./pipeline) | 订单如何进入结算报表；失败形态 A / B |
| [库表与字段](./tables) | 库表、分表、关键字段 |
| [缺单排查 Playbook](./missing-order-playbook) | 「有单无报表 / 有行不可见」核对清单 |
| [已知坑](./pitfalls) | 易混字段与排查误区 |
| [给开发 / Cursor](./for-developers) | 如何 clone、启用 skill、发钉钉 |

## 范围（v1）

- 业务线：机票（国内 / 国际）
- 主题：结算报表「缺单」与相关事实
- 非范围：酒店 / 火车；自动连库出结论；生产写操作
