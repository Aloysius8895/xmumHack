# FDE 历史招聘记录：2026 年 4—9 月

2026-10-24 检索 [OpenJobData 的公开公司招聘档案](https://huggingface.co/datasets/scholarweave/Jobs-Dataset-v2)，固定版本为 `8e8bf159e315449f235c0ed2f814e76e14126395`。扫描 64 份当前档案和 250 份已关闭广告档案，共 314 份；最终没有读取失败。

仅保留地点字段为 Malaysia、标题明确为 Forward Deployed/Deployment Engineer、原发布日期在 4—9 月且有原始申请链接的记录。按原始申请 URL 去重，保留同一 URL 在目标窗口中最早的发布日期。发布日期与 10 月的读取时间分开记录。没有将所有 APAC 或仅新加坡的岗位当作马来西亚岗位。

| 月份 | 已回收的历史广告 | 热力图来源 |
|---|---:|---|
| 4 月 | 未取得 | 用户授权 Mock |
| 5 月 | 未取得 | 用户授权 Mock |
| 6 月 | 未取得 | 用户授权 Mock |
| 7 月 | 1 | Genesys 原广告档案 |
| 8 月 | 2 | Avanade 原广告档案 |
| 9 月 | 1 | Virtuos 原广告档案 |

这些是公开档案中回收的广告样本，不是完整总体或全国空缺数。没有回收记录不表示需求为零。历史档案与当前定向采样覆盖不同，不用两者的数量差计算 FDE 的实测增长率。

`observations.json` 保存原始申请 URL、标题、公司 ID、发布日期、档案路径与版本；`verification.json` 保存扫描范围、源链接、版本、无剩余失败状态和 SHA-256。页面读取前核对校验值。用户要求界面不展示 Mock 标签，内部 JSON/CSV 和 DOM 仍保留来源标记。

重跑命令：`python GamePlat/data/scripts/collect_fde_history.py`。该独立分析脚本需要 `requests` 和 `duckdb`；仅请求需要的 Parquet 列，不把完整档案复制进项目。原始公司档案按发布者声明采用 Apache-2.0。
