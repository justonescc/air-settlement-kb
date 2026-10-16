# 机票结算报表链路（pipeline）

本文描述订单数据如何进入结算报表，以及「缺单」排查时常见的两种失败形态。

## 页面入口（UI）

- **系统：** CRM `crm-web`
- **路径：** 新结算账单 → 机票
- **参考模板：** `newfinance/settle/air-settlementStatement.html`（仓库内：`crm-web/crm-accountcheck/src/main/resources/templates/newfinance/settle/air-settlementStatement.html`）

## 导出 / 查询读路径（已知）

从页面导出或查询整表数据时，已知调用链如下：

| 环节 | 说明 |
|---|---|
| HTTP | `GET /api/finance/airreport/excelWhole` |
| 服务 | `AirReportServiceImpl.excelWhole` |
| SQL | `AirReportMapper.xml` 中 `<select id="excelWhole">` |
| 数据源 | `financenewdb.airreport`（**单表查询**，无外部 JOIN；分页子查询为自连接） |

**说明：** 读路径只从 `airreport` 取数；若某订单在该表中无行，导出与页面列表均不会出现该单（见失败形态 A）。

## 生成侧（已知缺口）

- **`finance-service` 内有写入 SQL：** `AirReportMapper.xml` → `<insert id="insertBatch">`（`insert into airreport(...)`）。
- **待补：** 哪个 job / service / caller 调用 `insertBatch`（或等价写入路径），以及哪些订单满足写入条件的规则。
- **排查含义：** 「有业务订单但 `airreport` 无行」时，需沿业务订单表 → 实际调用写入的任务/服务（**待补**）→ `airreport` 向上游查，而非只查 `excelWhole`。

可选背景（只读参考，不含连接信息）：`ticket-report-investigation/机票结算报表导出新增产品类型字段-开发说明.md`。

## 失败形态

排查「结算报表缺单」时，先区分下列两类：

### A. 表内无行

- **现象：** `financenewdb.airreport` 中不存在该订单的 `OrderID`（或等价主键字段）。
- **含义：** 生成链路未落库或未覆盖该单；读路径（`excelWhole`）无法「查出来」。
- **方向：** 确认业务订单是否存在 → 查生成任务 / 同步（**待补**）→ 再查 `airreport`。

### B. 表内有行但 UI / 导出不可见

- **现象：** `airreport` 已有该 `OrderID`，但 CRM 页面或导出结果中看不到。
- **常见原因（非穷尽）：**
  - 页面筛选条件（公司、日期范围、账单状态等）
  - 导出参数与页面查询不一致（日期 / 公司范围）
  - 账单或结算状态过滤导致列表隐藏
- **方向：** 用与页面一致的筛选条件直接查 `airreport` 对比；再核对前端查询接口与 `excelWhole` 入参。

## 端到端数据流（概览）

```text
业务订单表（具体表名 待补）
        │
        ▼
  报表生成任务（任务名 / 服务 待补）
        │
        ▼
 financenewdb.airreport  ←── 缺单形态 A：此处无行
        │
        ▼
 AirReportServiceImpl.excelWhole / 页面列表查询
        │
        ▼
 CRM 新结算账单 → 机票  ←── 缺单形态 B：有行但筛选/状态导致不可见
```

**numbered 等价：**

1. 业务侧产生机票订单（订单表 **待补**）。
2. 离线或定时任务将订单汇总写入 `airreport`（生成侧 **待补**）。
3. `finance-service` 通过 `excelWhole` 等对 `airreport` 只读查询。
4. CRM 展示或导出；用户感知的「缺单」对应形态 A 或 B。
