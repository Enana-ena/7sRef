# 7sRef — 植物大战僵尸风格的 Canvas 塔防测试项目

纯前端、无构建、无第三方依赖的 HTML5 Canvas 小游戏。所有数值与美术路径都写在数据文件里，改数据就能改玩法；逻辑按"一个场景一个文件"组织。当前版本号见 [update.md](update.md) 顶部（更新日志自 v0.0.1 起、一条指令一个版本号）。

## 在线游玩

**https://enana-ena.github.io/7sRef/** —— GitHub Pages，来源是 `main` 分支的仓库根目录（`Deploy from a branch`），推 `main` 就自动重新发布，没有构建步骤。根目录那枚空的 `.nojekyll` 是必需的：留着它 Pages 才会把 `sounds/World's end BLACKBOX.mp3`、`images/cards/card_らん.png` 这类带空格、括号和日文的文件名原样当静态文件发出去；删掉它 Pages 会走 Jekyll 构建，那些文件会被吞或转义成 404。

## 运行

直接用 Chromium 系浏览器（Chrome / Edge）打开 [index.html](index.html) 即可，不需要服务器、不需要编译；上面的 Pages 地址就是同一批文件直出，本地双击打开的效果一致（存档各存各的浏览器，互不相通）。

- 载入顺序有依赖：`info/info.js` → `scenes/menu.js` → `scenes/test.js` → `save.js` → `progress.js` → `game.js`。新增场景文件要插在 `game.js` 之前（`progress.js` 用到 `save.js` 的 `cacheRead` / `cacheWrite`，又必须早于 `game.js` 里的启动流程）。因为它早于 `game.js` 求值，那时顶层 `const CFG` 还在 TDZ，所以 `progress.js` 只能引用 `CFG` 于函数体内。
- 「导入 / 导出」存档用的是 File System Access API（`window.showDirectoryPicker`），只有 Chromium 系支持；不支持时只在控制台警告，不影响游戏。
- 存档写在浏览器 `localStorage`，键名 `apollo7s:save:<关卡 key>`（如 `test1`）。只在**离开关卡**（回主菜单 / 结算演出结束 / 结算面板返回）和**「重新开始」**时写盘，游玩过程中不写；「重新开始」是 `resetRun()` 之后才写，所以会把上一局的进度直接覆盖成新局。四个菜单开关（`opts`：快速模式 / 关闭自然出怪 / 无冷却无花费 / 自动收集）不进存档。
- 全局记录是**另一把单键** `apollo7s:progress`（`progress.js`，形如 `{"cleared":{"test1":true},"slots":6}`）：`cleared` 在领取首通奖励的那一刻直接写盘，`slots` 是本机已解锁的顶栏卡槽数。两者都不嵌在关卡存档里，因此不随「导入 / 导出」走，也不受 `resetRun()` 影响。`cleared` 只认 `=== true`，解析失败或数据脏一律当"没通过"、不抛错；`slots` 不是数字就当"从没写过"、由 `getSlots()` 退回 `CFG.cardSlots`，`setSlots()` 写入时夹到 `[CFG.cardSlots, CFG.cardSlotsMax]` = `[6, 10]`。**当前没有任何玩法途径会调 `setSlots()`**，所以实际永远是 6。旧键 `apollo7s:cleared` 已废弃、按约定不迁移（旧存档直接丢弃）。

## 操作

| 输入 | 作用 |
| --- | --- |
| 点击卡槽 / 数字键 `1`~`6` | 选中卡片（费用不足或冷却中不可选），半透明跟随鼠标；再点一次同一张取消 |
| 点击传送带上的卡 | 传送带关卡没有卡槽，改成点带上的卡拿在手里（无费用、无冷却），手感与卡槽一致：可取消、有跟随预览与绿/红格提示、悬停弹名称框；数字键在这关不生效，带两端只露一半的卡不可点 |
| 点击空格子 | 放置；点击卡片本身 / 右键 / `Esc` 取消 |
| 点击牛奶 | 收集（顶栏最左是牛奶计数框，其右是 `slotCount()` 个卡槽——默认 6 个，冷却表现为自上而下的黑遮罩；传送带关卡整块不画奶读数，但奶在幕后照常累计） |
| 点击地上的奖励（钱袋） | 领取：标记首通 → 收掉场上存量奶 → 爆出一批奶 → 播结算演出回主菜单（见下方「领取与结算演出」；空中还在飞的奖励也能点） |
| `` ` `` 或点击断网槽位 | 取出"断网"工具，再点某个伙伴即移除它（不触发它的身亡特效） |
| `菜单` 按钮 | 会话内开关：快速模式（时间 ×2）、关闭自然出怪、无冷却无花费、自动收集；退出 / 重新开始（带确认）/ 继续 |

> 手动出怪按钮已经在 v0.1.81 撤掉，所有关卡都没有手动放怪入口了；`manualSpawn()` 按约定保留成"有定义、无调用点"的接口。

## 目录结构

```
index.html          画布 + 脚本载入
.nojekyll           空文件，告诉 GitHub Pages 别跑 Jekyll（见「在线游玩」）
game.js             CFG 全局可调参数、画布/输入/主循环、通用绘制函数
save.js             存档快照、校验、localStorage 读写、导入导出
progress.js         全局记录（单键 apollo7s:progress = { cleared, slots }，独立于关卡存档、不进导入导出）
info/info.js        数据：卡片 / 子弹 / 怪物 / 防具 / 奖励 / 关卡 / 牛奶 / BGM
scenes/menu.js      主菜单场景
scenes/test.js      战斗场景（网格、伙伴、怪物、子弹、牛奶、奖励与结算演出、选卡、全景展示、波次、传送带、HUD、弹窗）
images/             cards / partners / enemies / backgrounds / others（防具图标与钱袋 moneybag.png 也在 others/）
sounds/             lawnbgm(1).mp3（场景1 + 全局默认）/ 躯樹の墓守.mp3（场景2）/ World's end BLACKBOX.mp3（已无关卡引用，文件暂留）
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
- **命中判定一律用贴图框而不是格子编号**：范围类机制是"怪物贴图与区域矩形相交"，纵向用脚线落在哪一行。例外是子弹（同行 + 中心距 ≤ `CFG.hitDist`）、二类防具挡弹（同行 + 中心距 ≤ `CFG.hitDist × armors[key].hitbox`，见下方防具约定）、怪物啃食（列取整）、判负线（贴图左边缘 ≤ 0）。

## 玩法循环（数据 → 行为）

`INFO` 里的字段基本就是玩法本身，代码只读取不硬编码：

- **卡片** `INFO.cards`：`id / name / hp / cd / costmilk` + 各自的特性字段。`cd` 是档位名，查 `INFO.cdTiers`（fast 7.5s / slow 30s / very slow 50s）；开局时只有 `slow` 与 `very slow` 档带首张冷却，为档时长 × `cdFirst = 2/3`，`fast` 卡起手即可用。当前 7 张卡（id 1、2、3、4、5、6、8，7 是缺号），顶栏槽数由 `slotCount()` 给出（关卡写了 `cardSlots` 就用它，否则取全局 `getSlots()`：初始兼下限 `CFG.cardSlots = 6`、上限 `CFG.cardSlotsMax = 10`，解锁途径还没接上），所以槽数少于卡数时进关会先经过选卡界面；传送带关卡（`conveyor: true`）不选卡也不看槽。
  - 有 `atkMin / atkMax / bullet / bulletSpeed` 的是射手：`atkMin~atkMax` 秒一发，`bulletSpeed` 单位是"格/秒"，伤害查 `INFO.bullets[*].damage`，`slow` 是给怪物挂减速；`shots: 2` 会上下各偏 `CFG.bulletSpread`。射手只在同视线内有怪时开火。
  - 有 `produce` 的产奶（首次 3~12.5s，之后 23.5~25s；产奶前 1s 起有金光渐变，见 `CFG.glow`）。`life` + `burst` 是定时自爆的范围卡：放置 `life` 秒后爆炸，`burst.radius` 以**格**为单位、以本格为中心覆盖 `2r+1` 格见方，纵向按怪物脚线认行；`immune: true` 表示啃不动它（touchhold）。**`ash` 标在这位的右邻**（布尔，7 张卡全部明写），意思是"这张卡的伤害算灰烬伤害"：灰烬伤害如果**严格大于**怪物当时的剩余血量，怪就化灰而不是倒地（见下面的离场演出）。只有 touchhold 是 `true`，Guy 的 `boom` 虽然同为 1800 但没有这个标记，所以行为与普通击杀一致。`charge` / `wake` / `boom` 是三段卡：放置后 `charge` 秒内未激活（贴图还在地面下），随后 `wake` 秒出土（怪物照常啃咬，但这段时间不给伤害），出土完进入已激活，此后任意怪物贴图与它相交即按 `boom.damage` / `boom.radius` 引爆并当帧移除自己。没有 `bullet` 也没有上面这些字段的卡就是纯墙，能挨多少啃咬看 `hp`。
  - `flip: true` 只镜像场上贴图，卡面与源图不动。`effect` / `place` 描述特效图与缩放。
- **怪物** `INFO.monsters`：`id`（100 段起，与伙伴 id 不冲突）、`hp`、`threshold`（不写则取 `Math.floor(hp / 3)`，见 `monThreshold`）、`atkInterval / atkDamage`（啃食节奏与单次伤害，减速时按 `CFG.monster.slow` 放慢）、`speedMin / speedMax`（每只出生掷一次，px/s）、`weight` 是抽种权重、`level` 是每波预算的计价单位（**正整数**，见下方约定）、**`tier` 目前只是数据标签，代码不读它**；`scale` 是贴图缩放、`hitbox` 单独缩放碰撞箱（脚线不动，所以行判定不变）；`armor1 / armor2` 填 `INFO.armors` 的 key，不穿防具也要写 `null`（出生时把表里的 `hp` 拷成实体的 `m.a1hp / m.a2hp`）。贴图**原生朝左**，怪物数据里已经不再有 `flip` 字段（朝向烘进 PNG，见 v0.1.62）。血量跌破自己的 `threshold` 后停止啃食（清空 `m.eat`、原地冻住）进入垂死，并按 `CFG.monster.bleedGap` 每跳掉 `bleedDmg` 点直到死；`hp <= 0` 当帧从 `state.monsters` 里移除，所以"清场 / 催波 / 判负"看的都等价于 `state.monsters.length === 0`，地上的尸体与残骸不参与任何判定。
- **防具** `INFO.armors`：用 key 索引，条目里**没有 `id`**。字段是 `name / hp / img / scale / dx / dy` —— 贴图按 `scale` 挂在"怪物贴图框中心 + `dy`"处（`dy` 为负即往上抬，当前 `prs` 与 `ftr` 都是 `scale 0.54`、`dx 0`、`dy -193`），图标就是 `images/others/difficulty-*.png`。
  - **一类 `armor1` = 单体吸收**：这只怪受到的任何伤害先由一类全额吃掉，**只有超出部分**才落到本体（`hurtBody`）；一类掉光就消失，之后正常扣本体。推论是一类没破时本体永远满血、既不进垂死也不流血，看着像无敌，其实一直在掉防具的血。当前 `中二企鹅-prs`（id 103，`level 2`，一类 370）与 `中二企鹅-ftr`（id 105，`level 4`，一类 1100）挂的都是**一类**，两者都只进测试场景2 的出怪表。
  - **二类 `armor2` = 独立挡弹**：只有飞向它本身的子弹会被它吃掉（`bulletHitKind` 先认二类再认本体），**溢出直接丢弃、不转给本体**，这颗子弹照常消耗，而且它附带的减速在这发上失效。**现在没有任何怪物使用二类**，这条路还缺一个字段，见下方约定。
  - **范围伤害**（touchhold 的 `burst`、Guy 的 `boom`）命中本体时连带二类，两者**各自全额**扣血（`hurtArea`），本体那一份仍先被一类吸收；范围判定只看本体贴图框。防具**不挡**两种掉血：跌破 `threshold` 后的流血只扣本体，金牛奶是整只怪直接清除（防具跟着消失、不掉落）。`hurtArea(m, dmg, ash)` 的第三个参数**只有 `burstDamage` 传**（取 `!!CARDS[p.card].info.ash`），`boomDamage` 与子弹路径不传 ⇒ 恒为假。一类、二类都**不参与**"够不够格化灰"的比较，比的永远是伤害数字 vs 本体当前 `m.hp`。
- **受击与离场演出**（纯画面，不改判定）：怪物被打中的那一帧起，被打的那一部分（本体 / 一类 / 二类）叠一层 `CFG.monster.hitAlpha` 的 `hitColor` 白，`CFG.monster.hitFlash = 0.05` 秒后硬切回原样；同一次里多个部分都在挡伤就一起闪，子弹被二类挡住时**只有二类闪**、本体安然无恙。因为是叠加而不是覆盖，处在减速中的怪会闪成浅蓝白。伙伴的闪看的是"被咬"不是"掉血"：每口咬下都给目标挂 `hitT`，所以 `immune` 的 touchhold、还在出土的 Guy 照样闪；跟手拖着的预览卡不算，流血与金牛奶清除也不闪。零血量的怪进 `state.deaths` 播倒地 —— `CFG.monster.death = { fall: 0.3, hold: 0.5, fade: 0.3, angle: 90, slide: 40 }`，`fall` 秒内绕脚线左转 90° 并左移 `slide` 像素，停 `hold` 秒、`fade` 秒淡出，整套 **1.1 秒**；带减速时动画时间走 `CFG.monster.slow` 倍速 ⇒ 看着 **2.2 秒**。防具被打穿的那一刻进 `state.drops` 掉落残骸 —— `CFG.armor.death = { fall: 0.15, hold: 0.5, fade: 0.3, run: 90, push: 0.45 }`，从挂载位置落到底边贴地、同时向右飘 `run` 像素，整套 **0.95 秒**。两种情况不播倒地：自己走出左边界（`x <= -60`）的怪照旧直接消失；被 `burst` / `boom` 炸死的怪连防具残骸都不留（`noCorpse`，并回滚当帧新增的掉落）。倒地与掉落期间不画防具、不画影子。`CFG.artPad` 按贴图路径给出空白边 `[左, 上, 右, 下]`（缺省 `[0,0,0,0]`），用来让倒下的脚真的贴到脚线上。
- **化灰**（与倒地互斥的第二条离场管线）：`hurtArea` 的第一行是 `if (ash && dmg > m.hp) { ashKill(m); return; }`，位置**在写 `m.hitT` 之前**，所以化灰的怪连受击闪白都不闪。`ashKill()` 把 `m.hp` 置 0 并把 `makeAsh(m)` = `{ type, x, row, t: 0, a1, a2 }` 推进 `state.ashes`；接住 `hp <= 0` 的仍是 `burstDamage` 里原有的 `noCorpse = true` + `state.drops.length = nd`，于是**无尸体、无防具残骸**，怪同一帧离开 `state.monsters`（不再走、不啃、不被啃、后续伤害打不到它，也不挡清场 / 催波 / 奖励）。画法是 `drawAsh(a)` 与 `drawCorpse` 同层：图源走独立缓存表 `ashImgs` / `ashSprite(key, s)`（`source-in` 合成 `CFG.monster.ash.color`；**不能复用受击闪白的 `flashImgs`**，否则闪白会被重新染黑），本体按 `plantSize` + `feetLine(a.row)` 定位、`globalAlpha` 恒 1、不 rotate、不减 `slide` ⇒ 站直、原地、不淡出，第 0 帧就是纯黑，`a.t` 只用于计时；没掉下来的防具（`a1` / `a2`）用 `drawArmor` 那两行公式（`cx = box.x + dx`、`cy = box.y + box.h/2 + dy`）跟着一起黑——`drawArmor` 本身没有新增参数或分支，`monsterBox` 只读 `type / x / row`，所以快照对象可以直接喂给它复用定位；化灰不画地面影子。计时是 `CFG.monster.ash = { dur: 2.5, color: '#000000' }`，跑**裸 `dt`**（记录里没有 `sf`，所以减速不影响它，快进 ×2 自然生效），到点整条删掉、没有 fade。`state.ashes` 与 `state.deaths` 是两条互斥管线，化灰不进 `state.deaths`。**本代数据只会看到化灰**：三只怪本体 hp 都是 270 而灰烬伤害是 1800，`1800 > 270` 恒成立，`dmg <= m.hp` 的降级分支（走一类吸收 + 普通倒地）是为以后 hp ≥ 1800 的怪保留的。`state.deaths` 与 `state.ashes` 都列在 `SAVE_KEYS` 末尾（v0.1.83 新加的两项），所以会随「导入 / 导出」走，读档时剩余的那段演出（倒地最多 1.1 秒、化灰最多 2.5 秒）会补播完再消失。还有一点要知道：`const stopped = !!(state.reward || state.ceremony)` 只挡传送带补卡、自然掉奶与 `produce`，**不挡**尸体 / 残骸 / 化灰这段计时，所以奖励与白幕期间这三条动画照旧推进。
- **关卡** `INFO.tracklist`：`name`（右下角关卡名）、`bg`、`bgm`、`startMilk`、`waves`、`firstReward`（本关首通专用奖励的 key，不用就写 `null`）、`spawnMul`、`spawnTable`（按 `weight` 加权决定怪物种类）、`cardSlots`（本关顶栏槽数，明写它才能绕开"全局槽数 ≥7 就静默关掉选卡"这颗地雷，两关现在都写 6）、`showMonsters` / `deckSelect` / `conveyor` 组合出四种开局：选卡 → 只做阵容全景展示 + 自动配卡 → 直接进战斗 → 传送带（全景 + 倒计时后上带，不选卡）。**约定：`deckSelect: true` 只在 `showMonsters: true` 时才有意义；`conveyor` 是能力开关，普通关整键不写，`isConveyor()` 只认 `=== true`。** `bgm` / `startMilk` 用 `??` 退回全局默认（`INFO.bgm` / `INFO.milk.start`），所以 `startMilk: 0` 是合法值；`startMilk` 只作用于新开局的局与"重新开始"，读档回来的局按存档奶量恢复。
- **传送带**（`conveyor: true`，当前只有测试场景1）：顶栏那 10 格不画卡槽而画一条带子，几何与节奏全在 `CFG.belt = { x: 256, y: 24, cells: 10, speed: 100, interval: { normal: 4, over: 10 }, overAt: 8, countPenalty: [3, 4], penaltyValues: [5, 1], lastMul: 0.5, panelColor, stripe }`，带内步距复用 `CFG.cardSlot.w + CFG.cardGap`（没有新增间距常数），面板 / 竖纹 / 卡面边框全代码画（`belt` 里**没有 `img`**）。运动与计时挂在 `updateGame` 既有的非 `stopped` 分支上，`deckPhase`（全景 + 倒计时）期间不推进，也没有第二套快进逻辑。出卡时刻按当前只数取阈值：`count <= 8 → 4s`、`> 8 → 10s`，**满带时 `beltT` 冻结不重置**，所以从 9 只掉回 8 只那一帧会立刻补一张（这是"不重置"的必然结果，没有跨阈值重置）；开局不带卡，第一张等 4 秒。抽哪种卡由 `beltTable` 的 `weight` 加权，再乘两层修正：同 id 在带上攒到 `countPenalty` 的档就把基础权重换成 `penaltyValues`（`20 → 5 → 1`），`beltLast` 命中时再乘 `lastMul` 的 `beltLayers` 次方（连送同一张逐次对折，中间送过别的就清零）；`beltPreset` 是前缀直出序列（即使为空也明写 `[]`），绕过权重但仍更新 `beltLast` / `beltLayers`；绝对最终权重可以用 `scenes/test.js` 里的钩子表 `BELT_ADJUST = {}` 覆盖（返回数字 = 覆盖，`undefined` = 不覆盖；本轮是空对象）。带上的卡**无费用、无冷却、不写 `state.cool`**，一条带项是一次性令牌（放下就 `splice`，同 id 允许并存多张），选中存 `state.beltSel`（不与 `state.selected` 复用），手感与卡槽一致：`heldCard()` 是唯一真相源，所以跟随预览、绿/红格提示、怪物红框、名称气泡四边都同步。顶栏奶读数整块不画（位置留着不回流），但 `state.milk` / `state.milkShown` 照旧累计、产奶伙伴照旧掉奶、奖励爆的 10 颗照旧，只有"草地自然掉奶"这一路 `&& !isConveyor()`。
- **波次** `CFG.wave`：首波 `first`，之后 `gapMin~gapMax` 随机，每 `bigEvery` 波和本关最后一波是大波（大波**之前**那一次等待 `bigGap`，剩 `bigWarnGap` 时给警告横幅）。每波的是**总级别预算** = `min(ceil(wave / div), cap) × spawnMul`，大波再乘一次固定的 `bigMul`（2.5，不再随档位平方），**最后对预算向上取整** ⇒ 预算恒为整数**级别**，注意它不是只数：`level` 大于 1 的怪越多的表，同样预算出的只数越少（测试场景2 混了 1 / 2 / 4 级就是例子，测试场景1 全是 1 级才恰好"预算 = 只数"）。每波先走**两段保底**、最后才进补怪循环，优先级是 **末波保底 > 大波保底 > 加权补怪**：① 本波是最后一波（`state.wave === waves`）时，按 `spawnTable` 的顺序**每种怪各刷一只**，这一段**允许突破预算**（保底把 `sum` 抬过 `budget` 后 `while` 一次都不进）；② 本波是大波时，再补 `min(unit, budget - sum)` 只 `CFG.wave.bigSeed`（当前是普通中二企鹅），这一段**受预算截断**、超了就砍。`unit = min(ceil(wave / div), cap)` 就是大波保底的只数，没有第二套公式。两个注意点：既是大波又是末波的那一波（测试场景1 第 10 波 = 它唯一的大波兼末波、测试场景2 第 30 波），大波保底吃的是**扣掉末波保底之后**的剩余额度，被末波保底压过预算时这一波段一只都不补；`bigSeed` 写的是怪物 key、**不受本关 `spawnTable` 约束**，且那个 `min` 比的是"只数 vs 剩余额度"，只在 `bigSeed` 是 `level: 1` 时才等价于级别不超预算。补怪循环按怪物 `level` 累加、**装不下的怪直接重抽**，因此除末波保底之外，本波总级别既不会超出预算、也不会差零头 —— 前提是出怪表里有一只 `level: 1` 的怪（见下方约定）。出怪行按"上上波 / 上波"的行计数加权，避免连续堆同一行（`rowInit` 是这两个计数器的初值，必须播种，否则权重恒为 0）。催波：下一波不是大波时本波剩余血量低于 `hpCut` 就压到 `cutGap`，下一波是大波时场上全空压到 `bigCutGap`。**本波血量的分子与分母用同一个式子** `monWaveHp = hp + a1hp × armor1Weight + a2hp × armor2Weight`（当前 `1.00 / 0.20`，两个倍率各自独立可调），所以带防具的波需要打掉更多东西才会提前催波 —— 满血一只按 无防具 **270** / prs **640** / ftr **1370** 计入；两段保底刷出来的怪也逐只累进分母，所以末波真的超预算时，这一波要打掉更多东西才会提前催波。所有计时走**游戏时钟**（`state.clock`），快速模式下真实时间折半。
- **牛奶** `INFO.milk`（起始值 / 单颗面值 / 上限）+ `CFG.milk`（掉落间隔公式的四个常数、下落速度、存活与淡出时间、点击判定余量、抛物线 `arc`、飞向计数器的动画、`halo` 光晕）。自然掉落间隔 = `min(已掉落数量 × dropStep + dropBase, dropCap) + random × dropRand`（毫秒）。"自动收集"在勾选的那一瞬间就把场上所有未收集的奶记入账（含在落、在抛物线里的）。每颗奶底下一圈 `CFG.milk.halo = { radius, alpha, color }`（当前 `0.7 / 0.30 / 白`）的径向白光随它一起画（半径 = 贴图长边 × `radius`），因为与贴图共用同一个 `globalAlpha`，临过期那 `CFG.milk.fade` 秒是**光晕跟着奶一起淡出**，不会留一块不透明的白；它覆盖 `state.milks` 的全部条目，所以钱袋爆出的那批也有光晕，而金牛奶（`state.gmilks`，另一条绘制循环）没有。
- **金牛奶** `state.gmilks`：每行一颗停在场地左缘，**未进入死亡状态**（`hp >= threshold`）的怪物贴到它就被"发射"，向右 `CFG.gmilk.speed` px/s 推进并清除沿途怪物，飞出右边界后消耗掉。它是最后一道防线。
- **奖励** `INFO.rewards`：按 key 索引、条目里**没有 `id`**，字段是 `name / img / scale / milk` —— `scale` 相对 `CFG.milk.size`（所以奖励与奶共用尺寸口径），`milk` 属于"能力开关"型字段（这枚奖励爆多少奶；不想爆的奖励**整行不写 `milk`**，与卡片的 `produce` / `burst` 同口径）。当前只有 `moneybag`（钱袋，`scale 1.00`、`milk 250`，贴图 `images/others/moneybag.png`）。发哪一枚由 `rewardKey()` 决定：本关 `tracklist.firstReward` 非 `null` **且这关还没通过**时用它，否则退回 `CFG.reward.defaultKey`（当前两关的 `firstReward` 都是 `null`，所以现在永远发钱袋）。
- **奖励的掉落与拾取**：末波了结（`lastWaveSettled()` = 本波是最后一波，且末波的怪**没有一只**还在自己的 `threshold` 以上）时 `rewardCheck()` 先把场上跌破 `threshold` 的垂死怪**整批删掉**（不进 `state.deaths`、不掉防具、不画影子），删完若 `state.monsters` 仍非空（比如将来接上入口后由 `manualSpawn()` 塞进来的健康怪）就这一帧先不掉；清空后从**最右**那只垂死怪的贴图头顶抛出 `state.reward`，没有源点时落在 `CFG.reward.rest`。抛物线与奶**共用** `arcPoint` / `stepArc`（吃 `CFG.milk.arc` 的 `dur / h / spread`，落点同样贴脚线），`rewardHit` = 贴图框四周再放宽 `CFG.reward.hitPad`，**还在飞的时候就能点**。奖励不在 `state.milks` 里 ⇒ 永不过期、也不被"自动收集"收走；`state.reward` 存在或演出中时**自然掉奶与咪璐库产奶一起停产**（`resetRun()` 清掉后自动恢复）。
- **领取与结算演出**：点击奖励后依次是 `markCleared()` 记首通 → 收掉场上所有**还没起飞**的存量奶 → `burstReward()` 沿上半圆弧爆出 `Math.round(奖励.milk / INFO.milk.value)` 颗奶（当前 250 / 25 = **10 颗**，半径 `CFG.reward.burst.radius`、`h: 0` ⇒ 那条抛物线退化成纯径向直线），每颗先飞 `burst.dur` 秒、再在空中停 `burst.hold` 秒才一起飞向计数器 → 建 `state.ceremony` 并暂停 BGM。演出总长 `CFG.reward.cer.dur`（5 秒）：`fly`（3 秒）内用现成的 `smooth()` 从拾取点飞到屏幕正中 `(CFG.W/2, CFG.H/2)`，全程按 `u = t / dur` 线性放大到 `scaleTo` 倍、白光半径从 `glowFrom` 涨到 `glowTo`，最后 `white`（2 秒）全屏白涨满；`t >= dur` 时 `resetRun() → writeRun()` 回主菜单（落盘是干净新局，与「重新开始」同口径）。演出期间**悬停 / 点击 / 右键 / 按键全部屏蔽**，但判负面板仍点得动、且画在白幕之上；`ceremony` **不进存档**，地上的 `reward` 进（`SAVE_KEYS` 末尾的 `reward`）—— 读档时字段非法就整份丢成 `null`（当帧由 `rewardCheck()` 幂等补回），还在飞的弧线就地结算到落点、不重播抛物线。
- **胜负**：只剩**判负** —— 任一怪物贴图左边缘越过 `x = 0` → `state.result = 'lose'`；打完末波不再弹胜利面板，改成上面的掉奖励 + 演出，所以 `state.result` 的取值只有 `'lose'`。判负的式子与 `lastWaveSettled()` 都只读 `state.monsters`，所以倒地中的尸体、地上的残骸与被删掉的垂死怪都不会推迟这两件事。右下角进度条从第一波起显示，按大波在本关的位置摆放评级图标（`CFG.meter.ranks`，从最后一波往前数，数量不够就停在最后一档），图标越过之后从压在条底抬到条上沿；SYNC 光标跟着按 `meter.anim` 平滑后的进度走。

## 改数值 / 加内容

1. 加一只怪：把贴图命名为 `images/enemies/enm_<key>.png`（**朝左画**，怪物数据里已经没有 `flip` 了），在 `INFO.monsters` 里补一条（`id`、`name`、`level / weight / tier`、`hp`、`threshold`、`armor1 / armor2`、`atkInterval / atkDamage`、`speedMin/Max`、`img`、`scale`、`hitbox`），再把 key 加进关卡的 `spawnTable`。`level` 是**正整数**：出怪表里必须至少有一只 `level: 1` 的怪，也不许出现 `level: 0`（两条都是硬约束，见下方约定）。不穿防具就两行都写 `null`；要穿则填 `INFO.armors` 里已存在的 key（防具条目只有 `name / hp / img / scale / dx / dy`，没有 `id`）。
2. 加一张卡：贴图 `images/cards/card_<key>.png` + `images/partners/ptn_<key>.png`，在 `INFO.cards` 里按 **id 升序**插入（文件顺序就是卡槽顺序和 `1`~`6` 按键映射，运行时不重排）。布尔三件套 `immune / ash / flip` 一律明写 `true` / `false`，位置顺序照现有 7 张卡（`immune` 在前、`ash` 紧跟其右）。
3. 加一关：`INFO.tracklist` 里补一条（「玩法循环」小节列的那些字段都写全，`firstReward` 不配也要明写 `null`；`cardSlots` 明写本关槽数，不做传送带关就**整行不写** `conveyor` / `beltTable`），贴图放 `images/backgrounds/`、音乐放 `sounds/`；主菜单的两枚关卡按钮是 `scenes/menu.js` 里按 key 写死的，要加第三关得在那里补。
4. 加一枚奖励：贴图放 `images/others/`，`INFO.rewards` 里补一条（`name / img / scale / milk`，**没有 `id`**），再把它填进某关的 `firstReward`（只在"这关还没通过"时生效）或改成 `CFG.reward.defaultKey`（常驻）。尺寸与抛物线复用 `CFG.milk`（`size` / `arc`），只有点击余量 `CFG.reward.hitPad` 与光晕 `CFG.reward.halo` 单列；爆出的奶只数不写死，由 `milk / INFO.milk.value` 推导。
5. 全局参数（判定距离、影子、减速倍率与减速染色、特效、顶栏槽数下限 `cardSlots` / 上限 `cardSlotsMax`、传送带几何与出卡节奏 `CFG.belt`、波次档位 / 大波倍率 / 大波保底怪 key / 防具血量倍率 `CFG.wave`、受击闪白、倒地与化灰参数 `CFG.monster`（化灰是 `CFG.monster.ash = { dur, color }`，颜色只在 `ashSprite` 里读，绘制代码不写死黑色）、防具掉落参数 `CFG.armor`、奖励与结算演出参数 `CFG.reward`、牛奶光晕 `CFG.milk.halo`、倒地贴地补偿 `CFG.artPad`、相机平移量 `deck.cam`、阵容展示间距 `deck.showGap` 等）都在 [game.js](game.js) 顶部的 `CFG`。

> 约定：**没被点名的数值也显式写进 `info`**，不留给代码兜底 —— 布尔与常量类字段（卡片的 `immune` / `ash` / `flip` / `shots` / 子弹的 `slow` / 关卡的 `bgm` / `startMilk` / `firstReward` / `deckSelect` / `cardSlots` / 怪物的 `hp` / `threshold` / `atkInterval` / `atkDamage` / 怪物的 `armor1` / `armor2`）一律写出来，"默认无防具""默认不配首通奖励"就是明写 `null` 而不是省掉这一行。例外是"能力开关"类字段（`produce` / `place` / `effect` / `burst` / `boom` / `charge` / `wake` / `life` / `bullet` / `atkMin` / `atkMax` / `bulletSpeed` / `conveyor` / `beltTable` / 奖励的 `milk`）：代码拿"有没有这个键"当开关，所以没有该能力的卡**必须整个不写**，填 `0` 或空对象会空跑或抛错（`beltPreset` 是唯一的例外：它是数组、空串 `[]` 才是"没有前缀"，所以即使为空也明写）。

> 出怪表的 `level` 约定（**由数据保证，代码不做兜底分支**）：每关的 `spawnTable` 里至少要有一只 `level: 1` 的怪，且任何怪都不许写 `level: 0`。预算已向上取整成整数，有 1 级怪就保证"总级别严格等于出怪量"必然达成。两条各自破坏后的表现：1 级怪缺席时，剩余额度一旦小于表里最小的 `level`，过滤出来的可选表就是空的，`pickMonster` 抽不到东西、紧接着读 `INFO.monsters[undefined].level` **抛错**（本波直接崩，不会静默少刷）；写 `level: 0` 则永远"装得下"，会被反复抽中而总级别不涨，一波刷出成百上千只、游戏卡死。

> 二类防具还差一个字段（**已知的静默失效点**）：`armor2Hit` 用 `CFG.hitDist * armors[key].hitbox` 算挡弹宽度，而 `INFO.armors` 里 `prs` / `ftr` 两条**都没有 `hitbox`** ⇒ 表达式是 `× undefined = NaN`，比较恒为 `false`。今天看不出问题，因为**没有任何怪物挂 `armor2`**（三只怪 `armor2` 全是 `null`，`ftr` 挂的是一类），这条分支整个跑不到。真要给某只怪填上 `armor2`，必须同时给那条防具补一个正数 `hitbox`（如 `1.00`），否则二类"画在身上却一颗子弹都挡不住"、且不报错 —— 这是全项目唯一一个"数据缺字段会静默失效"的位置，其余缺字段都是直接抛错。

> 注意：存档里记录的是 `CARDS` 数组下标。在中间插入新卡会让旧存档静默地指向别的伙伴，按项目约定旧存档直接丢弃，不做迁移。

## 协作约定

改动前先读 [00_MASTER_PROMPT.md](00_MASTER_PROMPT.md)：只做当条指令点名的机制，隐含规格先确认，不做未经要求的验证动作（浏览器由本人自己开）。每次改动都要在 [update.md](update.md) 顶部追加一个版本号条目（新增 / 修改 / 修复 / 说明），记下改动原因和可调字段名。

## 已知未完成

- 伙伴攻击动画（01 目标里标"部分完成"）。怪物那侧的受击表现已经做完了（闪白 + 倒地 + 化灰 + 防具掉落），不再挂在待办里。
- **卡槽解锁还没有途径**：`CFG.cardSlotsMax = 10` 与 `progress.js` 的 `getSlots()` / `setSlots()` 都写好了，但**没有任何玩法代码调用 `setSlots()`**（与留着的 `manualSpawn()` 同为"有定义、无调用点"的接口），所以 `slotCount()` 现在永远等于关卡明写的 6。真要往上抬之前先记住这颗地雷：`needPick()` 判的是 `slotCount() < CARDS.length`，全局槽数一到 7，普通关的选卡界面就会**静默关掉**——两关明写 `cardSlots: 6` 就是防它。另一个缺口是数字键只映射 `1`~`6`，第 7 格起没有键盘入口。
- **化灰的降级分支今天跑不到**：判定是 `dmg > m.hp` 的严格大于，而唯一的灰烬来源是 1800、三只怪本体 hp 都是 270，`1800 > 270` 恒成立 ⇒ 现在只会看到化灰。`dmg <= m.hp` 那条（一类照常吸收 + 普通倒地）只在沙箱里用 hp 1800 / 2000 的假数据验过，要等一只 hp ≥ 1800 的怪才可能在游戏中出现。
- **二类防具等于还没实测**：没有一只怪挂 `armor2`，`INFO.armors` 也还缺 `hitbox` 字段（见上方约定），所以挡弹、丢减速那条路从未在游戏里跑到过。化灰的防具那一路同理：`drawAsh` 写了 `a2` 分支（抄 `drawArmor` 的定位公式），但今天只有 `a1` 会被真的画出来。
- **首通奖励的分岔还没实测**：两关的 `firstReward` 都是 `null`，所以 `rewardKey()` 里"这关还没通过 ⇒ 改用 `firstReward`"那条分支从未在游戏里走到，实际每关发的都是 `CFG.reward.defaultKey` 那枚钱袋；`INFO.rewards` 也只有 `moneybag` 一条，"不带 `milk` 字段的奖励（只标记首通、不爆奶）"只在沙箱里验过。通关标记存在全局键 `apollo7s:progress` 的 `cleared` 里（旧的 `apollo7s:cleared` 已废弃），是全关卡共用一份，目前没有"看是否已通关"的入口（主菜单不显示）。
- 三段式卡（Guy）的三个状态只靠贴图露出多少来体现（`emergeRatio`：未激活只露上半截、出土中从 `charge` 到 `charge + wake` 升满、已激活全貌），没有倒计时、高亮之类的显式状态标识。
- 主菜单「开始游戏」目前只弹"该内容还未开发"。
- 关卡设计文档里的"预留规格"条目尚未动工。
- `sounds/World's end BLACKBOX.mp3` 已经没有任何关卡在用（场景2 换成了躯樹の墓守），文件暂时还留在仓库里没删。
