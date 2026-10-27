# 7sRef — 植物大战僵尸风格的 Canvas 塔防测试项目

纯前端、无构建、无第三方依赖的 HTML5 Canvas 小游戏。所有数值与美术路径都写在数据文件里，改数据就能改玩法；逻辑按"一个场景一个文件"组织。当前版本号见 [update.md](update.md) 顶部（更新日志自 v0.0.1 起、一条指令一个版本号）。

## 在线游玩

**https://enana-ena.github.io/7sRef/** —— GitHub Pages，来源是 `main` 分支的仓库根目录（`Deploy from a branch`），推 `main` 就自动重新发布，没有构建步骤。根目录那枚空的 `.nojekyll` 是必需的：留着它 Pages 才会把 `sounds/World's end BLACKBOX.mp3`、`images/cards/card_らん.png` 这类带空格、括号和日文的文件名原样当静态文件发出去；删掉它 Pages 会走 Jekyll 构建，那些文件会被吞或转义成 404。

## 运行

直接用 Chromium 系浏览器（Chrome / Edge）打开 [index.html](index.html) 即可，不需要服务器、不需要编译；上面的 Pages 地址就是同一批文件直出，本地双击打开的效果一致（存档各存各的浏览器，互不相通）。

- 载入顺序有依赖：`info/info.js` → `scenes/menu.js` → `scenes/test.js` → `save.js` → `game.js`。新增场景文件要插在 `game.js` 之前。
- 「导入 / 导出」存档用的是 File System Access API（`window.showDirectoryPicker`），只有 Chromium 系支持；不支持时只在控制台警告，不影响游戏。
- 存档写在浏览器 `localStorage`，键名 `apollo7s:save:<关卡 key>`（如 `test1`）。只在**离开关卡**（回主菜单 / 结算面板返回）和**「重新开始」**时写盘，游玩过程中不写；「重新开始」是 `resetRun()` 之后才写，所以会把上一局的进度直接覆盖成新局。两个开关（`opts`）不进存档。

## 操作

| 输入 | 作用 |
| --- | --- |
| 点击卡槽 / 数字键 `1`~`6` | 选中卡片（费用不足或冷却中不可选），半透明跟随鼠标 |
| 点击空格子 | 放置；点击卡片本身 / 右键 / `Esc` 取消 |
| 点击牛奶 | 收集（顶栏最左是牛奶计数框，其右是 6 个卡槽，冷却表现为自上而下的黑遮罩） |
| `` ` `` 或点击断网槽位 | 取出"断网"工具，再点某个伙伴即移除它（不触发它的身亡特效） |
| `出怪` 按钮 | 立刻手动放一只怪（记为 `wave: 0`，不计入本波血量与胜负判定；但大波前"场上全空"的催波看的是怪物数组是否为空，手动放的怪同样会挡住它） |
| `菜单` 按钮 | 会话内开关：快速模式（时间 ×2）、关闭自然出怪、无冷却无花费、自动收集；退出 / 重新开始（带确认）/ 继续 |

## 目录结构

```
index.html          画布 + 脚本载入
.nojekyll           空文件，告诉 GitHub Pages 别跑 Jekyll（见「在线游玩」）
game.js             CFG 全局可调参数、画布/输入/主循环、通用绘制函数
save.js             存档快照、校验、localStorage 读写、导入导出
info/info.js        数据：卡片 / 子弹 / 怪物 / 关卡 / 牛奶 / BGM
scenes/menu.js      主菜单场景
scenes/test.js      战斗场景（网格、伙伴、怪物、子弹、牛奶、选卡、全景展示、波次、HUD、弹窗）
images/             cards / partners / enemies / backgrounds / others
sounds/             lawnbgm(1).mp3 / World's end BLACKBOX.mp3
data/               导出到磁盘的存档样例 save_test1.json / save_test2.json
00_MASTER_PROMPT.md 约束（严格范围、必须写更新日志）
01_FIRST_PLAYABLE.md阶段目标（"预留规格"条目只是规格，不代表许可）
update.md           更新日志（一条指令一个版本号）
update_7sRef.md     面向玩家的内容日志（数值逻辑 / 修复 / UI美术 / 关卡角色四类，不写判定像素）
```

## 舞台与坐标

`CFG.W × CFG.H = 2048 × 1152`（16:9），画布按 CSS 等比缩放，鼠标坐标用 `CFG.W / r.width` 换算，所以逻辑分辨率与实际窗口大小无关。

- 网格 `CFG.grid = { x, y: 200, cw: 200, ch: 186 }`，`x` 由 `CFG.W - CFG.visibleCols × cw` 推导（`visibleCols = 9.3`）。
- 5 行 × 10 列，其中只有前 `plantCols = 9` 列可种植；第 10 列是屏幕外的出怪列（出生点 `x = CFG.W + 60`）。
- 伙伴/怪物贴图框统一由 `plantSize(img, scale)` 给出：高 = `grid.ch × scale`，宽按图片比例。脚线（地面）= `grid.y + (row+1) × ch - footMargin`，怪物脚线由 `CFG.monster.feet` 给出。
- **命中判定一律用贴图框而不是格子编号**：范围类机制是"怪物贴图与区域矩形相交"，纵向用脚线落在哪一行。例外是子弹（同行 + 中心距 ≤ `CFG.hitDist`）、怪物啃食（列取整）、判负线（贴图左边缘 ≤ 0）。

## 玩法循环（数据 → 行为）

`INFO` 里的字段基本就是玩法本身，代码只读取不硬编码：

- **卡片** `INFO.cards`：`id / name / hp / cd / costmilk` + 各自的特性字段。`cd` 是档位名，查 `INFO.cdTiers`（fast 7.5s / slow 30s / very slow 50s）；开局时只有 `slow` 与 `very slow` 档带首张冷却，为档时长 × `cdFirst = 2/3`，`fast` 卡起手即可用。当前 7 张卡（id 1、2、3、4、5、6、8，7 是缺号）而卡槽只有 `CFG.cardSlots = 6` 个，所以进关会先经过选卡界面。
  - 有 `atkMin / atkMax / bullet / bulletSpeed` 的是射手：`atkMin~atkMax` 秒一发，`bulletSpeed` 单位是"格/秒"，伤害查 `INFO.bullets[*].damage`，`slow` 是给怪物挂减速；`shots: 2` 会上下各偏 `CFG.bulletSpread`。射手只在同视线内有怪时开火。
  - 有 `produce` 的产奶（首次 3~12.5s，之后 23.5~25s；产奶前 1s 起有金光渐变，见 `CFG.glow`）。`life` + `burst` 是定时自爆的范围卡：放置 `life` 秒后爆炸，`burst.radius` 以**格**为单位、以本格为中心覆盖 `2r+1` 格见方，纵向按怪物脚线认行；`immune: true` 表示啃不动它（touchhold）。`charge` / `wake` / `boom` 是三段卡：放置后 `charge` 秒内未激活（贴图还在地面下），随后 `wake` 秒出土（怪物照常啃咬，但这段时间不给伤害），出土完进入已激活，此后任意怪物贴图与它相交即按 `boom.damage` / `boom.radius` 引爆并当帧移除自己。没有 `bullet` 也没有上面这些字段的卡就是纯墙，能挨多少啃咬看 `hp`。
  - `flip: true` 只镜像场上贴图，卡面与源图不动。`effect` / `place` 描述特效图与缩放。
- **怪物** `INFO.monsters`：`id`（100 段起，与伙伴 id 不冲突）、`hp`、`threshold`（不写则取 `Math.floor(hp / 3)`，见 `monThreshold`）、`atkInterval / atkDamage`（啃食节奏与单次伤害，减速时按 `CFG.monster.slow` 放慢）、`speedMin / speedMax`（每只出生掷一次，px/s）、`weight / tier / level` 决定出场分布与每波预算的计价单位，`scale` 是贴图缩放、`hitbox` 单独缩放碰撞箱（脚线不动，所以行判定不变）。血量低于自己的 `threshold` 后停止啃食、进入死亡状态，并按 `CFG.monster.bleedGap` 每跳掉 `bleedDmg` 点直到死；死亡或走出左边界当帧移除，不留尸体，所以"清场"等价于 `state.monsters.length === 0`。
- **关卡** `INFO.tracklist`：`name`（右下角关卡名）、`bg`、`bgm`、`startMilk`、`waves`、`spawnMul`、`spawnTable`（按 `weight` 加权决定怪物种类）、`showMonsters` / `deckSelect` 组合出三种开局：选卡 → 只做阵容全景展示 + 自动配卡 → 直接进战斗。**约定：`deckSelect: true` 只在 `showMonsters: true` 时才有意义。** `bgm` / `startMilk` 用 `??` 退回全局默认（`INFO.bgm` / `INFO.milk.start`），所以 `startMilk: 0` 是合法值；`startMilk` 只作用于新开局的局与"重新开始"，读档回来的局按存档奶量恢复。
- **波次** `CFG.wave`：首波 `first`，之后 `gapMin~gapMax` 随机，每 `bigEvery` 波和本关最后一波是大波（大波**之前**那一次等待 `bigGap`，剩 `bigWarnGap` 时给警告横幅）。每波数量预算 `min(ceil(wave / div), cap) × spawnMul`，大波再乘一次固定的 `bigMul`（2.5，不再随档位平方），**最后对预算向上取整**，所以预算永远是整数只。生成循环按怪物 `level` 累加、**装不下的怪直接重抽**，因此本波总级别既不会超出预算、也不会差零头 —— 前提是出怪表里有一只 `level: 1` 的怪（见下方约定）。出怪行按"上上波 / 上波"的行计数加权，避免连续堆同一行（`rowInit` 是这两个计数器的初值，必须播种，否则权重恒为 0）。催波：下一波不是大波时本波剩余血量低于 `hpCut` 就压到 `cutGap`，下一波是大波时场上全空压到 `bigCutGap`。所有计时走**游戏时钟**（`state.clock`），快速模式下真实时间折半。
- **牛奶** `INFO.milk`（起始值 / 单颗面值 / 上限）+ `CFG.milk`（掉落间隔公式的四个常数、下落速度、存活与淡出时间、点击判定余量、抛物线 `arc`、飞向计数器的动画）。自然掉落间隔 = `min(已掉落数量 × dropStep + dropBase, dropCap) + random × dropRand`（毫秒）。"自动收集"在勾选的那一瞬间就把场上所有未收集的奶记入账（含在落、在抛物线里的）。
- **金牛奶** `state.gmilks`：每行一颗停在场地左缘，**未进入死亡状态**（`hp >= threshold`）的怪物贴到它就被"发射"，向右 `CFG.gmilk.speed` px/s 推进并清除沿途怪物，飞出右边界后消耗掉。它是最后一道防线。
- **胜负**：任一怪物贴图左边缘越过 `x = 0` → 判负；最后一波的怪全部跌破自己的 `threshold` → 判胜。右下角进度条从第一波起显示，按大波在本关的位置摆放评级图标（`CFG.meter.ranks`，从最后一波往前数，数量不够就停在最后一档），图标越过之后从压在条底抬到条上沿；SYNC 光标跟着按 `meter.anim` 平滑后的进度走。

## 改数值 / 加内容

1. 加一只怪：把贴图命名为 `images/enemies/enm_<key>.png`，在 `INFO.monsters` 里补一条（`id`、`name`、`level / weight / tier`、`hp`、`threshold`、`atkInterval / atkDamage`、`speedMin/Max`、`flip`、`img`、`scale`、`hitbox`），再把 key 加进关卡的 `spawnTable`。`level` 是**正整数**：出怪表里必须至少有一只 `level: 1` 的怪，也不许出现 `level: 0`（两条都是硬约束，见下方约定）。
2. 加一张卡：贴图 `images/cards/card_<key>.png` + `images/partners/ptn_<key>.png`，在 `INFO.cards` 里按 **id 升序**插入（文件顺序就是卡槽顺序和 `1`~`6` 按键映射，运行时不重排）。
3. 加一关：`INFO.tracklist` 里补一条（上面那九项都写全），贴图放 `images/backgrounds/`、音乐放 `sounds/`；主菜单的两枚关卡按钮是 `scenes/menu.js` 里按 key 写死的，要加第三关得在那里补。
4. 全局参数（判定距离、影子、减速倍率、特效、波次档位与大波倍率 `CFG.wave`、相机平移量 `deck.cam`、阵容展示间距 `deck.showGap` 等）都在 [game.js](game.js) 顶部的 `CFG`。

> 约定：**没被点名的数值也显式写进 `info`**，不留给代码兜底 —— 布尔与常量类字段（`immune` / `flip` / `shots` / 子弹的 `slow` / 关卡的 `bgm` / `startMilk` / 怪物的 `hp` / `threshold` / `atkInterval` / `atkDamage`）一律写出来。例外是"能力开关"类字段（`produce` / `place` / `effect` / `burst` / `boom` / `charge` / `wake` / `life` / `bullet` / `atkMin` / `atkMax` / `bulletSpeed`）：代码拿"有没有这个键"当开关，所以没有该能力的卡**必须整个不写**，填 `0` 或空对象会空跑或抛错。

> 出怪表的 `level` 约定（**由数据保证，代码不做兜底分支**）：每关的 `spawnTable` 里至少要有一只 `level: 1` 的怪，且任何怪都不许写 `level: 0`。预算已向上取整成整数，有 1 级怪就保证"总级别严格等于出怪量"必然达成。两条各自破坏后的表现：1 级怪缺席时，剩余额度一旦小于表里最小的 `level`，过滤出来的可选表就是空的，`pickMonster` 抽不到东西、紧接着读 `INFO.monsters[undefined].level` **抛错**（本波直接崩，不会静默少刷）；写 `level: 0` 则永远"装得下"，会被反复抽中而总级别不涨，一波刷出成百上千只、游戏卡死。

> 注意：存档里记录的是 `CARDS` 数组下标。在中间插入新卡会让旧存档静默地指向别的伙伴，按项目约定旧存档直接丢弃，不做迁移。

## 协作约定

改动前先读 [00_MASTER_PROMPT.md](00_MASTER_PROMPT.md)：只做当条指令点名的机制，隐含规格先确认，不做未经要求的验证动作（浏览器由本人自己开）。每次改动都要在 [update.md](update.md) 顶部追加一个版本号条目（新增 / 修改 / 修复 / 说明），记下改动原因和可调字段名。

## 已知未完成

- 伙伴攻击动画、怪物受击动画（01 目标里标"部分完成"）。
- 三段式卡（Guy）的未激活 / 激活中 / 已激活没有视觉区分，只有激活那 0.5s 有出土动画。
- 主菜单「开始游戏」目前只弹"该内容还未开发"。
- 关卡设计文档里的"预留规格"条目尚未动工。
