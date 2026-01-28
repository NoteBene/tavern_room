export const Schema = z.object({
  当前时间: z.string().prefault('2026年1月1日 周一 08:00'), // 格式: xx年x月x日 周X xx:xx
  近期事务: z.array(z.string()).prefault([]), // 记录重要代办事件

  主角资金: z.coerce.number().prefault(1000), // 初始资金，人民币

  公寓知名度: z.coerce
    .number()
    .transform(value => _.clamp(value, 0, 100))
    .prefault(10),
  酒吧知名度: z.coerce
    .number()
    .transform(value => _.clamp(value, 0, 100))
    .prefault(10),

  可监控区域: z.record(z.string().describe('监控区域名称'), z.string().describe('监控画面描述')).prefault({}),

  物品栏: z
    .record(
      z.string().describe('物品名'),
      z
        .object({
          描述: z.string(),
          数量: z.coerce
            .number()
            .transform(value => Math.max(0, value))
            .prefault(1),
        })
        .transform(obj => (obj.数量 <= 0 ? null : obj)),
    )
    .transform(record => _.pickBy(record, value => value !== null))
    .prefault({}),

  房客: z
    .record(
      z.string().describe('房客姓名'),
      z.object({
        基本信息: z
          .object({
            种族: z.string().prefault('人类-程序员'),
            等级: z.string().prefault('超赞'),
            身高: z.coerce.number().prefault(160), // 厘米
            三围: z.string().prefault('88-58-86'), // B-W-H格式
            罩杯: z.string().prefault('C'),
            年龄: z.coerce.number().prefault(20),
          })
          .prefault({}),

        好感度: z.coerce
          .number()
          .transform(value => _.clamp(value, 0, 100))
          .prefault(0),
        堕落度: z.coerce
          .number()
          .transform(value => _.clamp(value, 0, 100))
          .prefault(0),

        着装: z
          .object({
            上装: z.string().prefault(''),
            下装: z.string().prefault(''),
            内衣: z.string().prefault(''),
            袜子: z.string().prefault(''),
            鞋子: z.string().prefault(''),
            饰品: z.string().prefault(''),
          })
          .prefault({}),

        当前心情: z.string().prefault('普通'),
        正在干嘛: z.string().prefault('在房间休息'),
        当前计划: z.string().prefault('无'),

        当前解锁阶段: z.number().int().min(0).prefault(0),
        解锁路线: z.array(z.string()).prefault([]),
      }),
    )
    .prefault({}),
});

export type Schema = z.output<typeof Schema>;
