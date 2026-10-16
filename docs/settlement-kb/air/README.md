# 机票结算知识库

## 范围（v1）

- 业务线：机票（国内 / 国际）
- 主题：结算报表「缺单」与相关事实（表、链路、坑）
- 非范围：酒店/火车；自动连库出结论；生产写操作

## 怎么用

| 角色 | 用法 |
|---|---|
| 人 | 从本页进目录；缺单排查直接打开 `missing-order-playbook.md` |
| Agent | 由 skill `diagnosing-air-settlement-missing-orders` 按约定顺序加载本库 |

## 目录

| 文档 | 内容 |
|---|---|
| [pipeline.md](./pipeline.md) | 订单如何进入结算报表；两种失败形态 |
| [tables.md](./tables.md) | 库表、分表、关键字段 |
| [missing-order-playbook.md](./missing-order-playbook.md) | 「有单无报表 / 有行不可见」核对清单 |
| [pitfalls.md](./pitfalls.md) | 已知坑 |

## 安全

- 本文档与示例 SQL **禁止**写入真实 DB 主机、账号、密码、连接串
- 查询使用占位符（如 `?` / `:orderId`）；连接信息放本地环境，不进 Git
- 原料脚本若含明文口令，只抽取结论，不复制配置块
