# 更新日志

## v0.1.88（2026-10-28）
- 按你「点击关卡胜利的奖励时，播放一次 winmusic.ogg + push」：新增**一个具名 CFG 字段 + 一个一次性音频通道 + 一行调用**，战斗逻辑没动
- **资源：`sounds/winmusic.ogg` 原本在目录里但没进版本库**（`git ls-files sounds/` 只有三个 mp3，`git check-ignore` 说它没被忽略，仓库里根本没有 `.gitignore`），所以这一轮**把它一起 add 进来**——否则推上去 Pages 会 404 这个文件。规格：20841 字节、Ogg Vorbis、22050 Hz 双声道、**时长 3.482 秒**（拿 Python 逐页走 Ogg 页表 + 读 identification 头算出来的：末页 granule 76770 / 22050）
- **新字段 `CFG.reward.winMusic = 'sounds/winmusic.ogg'`**（[game.js:31](game.js#L31)，就摆在 `defaultKey` 右边）：路径与"播哪个文件"全在这一处，改这里即可，代码里没有第二处写死文件名
- **播放通道**：[game.js:158](game.js#L158) `const winMusic = new Audio(CFG.reward.winMusic);` 紧跟在 `bgm` 那三行后面，**没设 `loop`**（默认 `false`）⇒ 天然只放一遍；[game.js:165](game.js#L165) `playWinMusic()` 的形状照抄紧邻的 `playBgm()`（先 `winMusic.currentTime = 0` 再 `play()`，`if (p && p.catch) p.catch(() => {})` 兜住浏览器 autoplay 策略拒绝），差别只有多一句归零——**为了让"重播"是从头播而不是接着上次的尾巴**
- **调用点只有一个**：`pickupReward()` 里 `bgm.pause()` 之后（[scenes/test.js:128](scenes/test.js#L128)）。`pickupReward` 全仓只有 [scenes/test.js:1968](scenes/test.js#L1968) 一处调用（mousedown 命中 `rewardHit(p)` 才进），而它自己会把 `state.reward = null`，`rewardHit` 随即假 ⇒ **一局只可能播一次**，不存在连点叠播；下一局重新点奖励会再播一次（`currentTime = 0` 保证从开头）
- **不会和本关 BGM 打架**：`pickupReward()` 本来第一行就 `bgm.pause()`（v0.1.x 起就有），而"点任意处就把 BGM 续上"那句 `if (!state.menuOpen && !state.resumeAsk && bgm.paused) playBgm()` 被前面的 `if (state.ceremony) return;`（[scenes/test.js:1902](scenes/test.js#L1902)）挡在整段结算演出之外 ⇒ 5 秒演出里 BGM 不会被偷偷续播，胜利音乐是独占音道的。**没做音量、淡入淡出、也没在回主菜单时掐它**（没要求）
- **时长与演出的关系**：3.482 秒 < `CFG.reward.cer.dur = 5` 秒 ⇒ 整段在白光结算演出内放完，不会拖着响到主菜单；把 `cer.dur` 调到 3.5 以下才会出现"回菜单还在响"
- **验证**（headless 沙箱把 `Audio` 换成记录事件的桩，真跑 `pickupReward`）：六个 `<script>` 过 `vm.Script`；载入阶段事件表为空（**建对象不等于开播**）；`winMusic.src = 'sounds/winmusic.ogg'`、`winMusic.loop = false`；模拟点击后事件序列是 `seek winmusic.ogg -> 0` → `PLAY sounds/winmusic.ogg`（同一次点击里 `bgm` 的 `PAUSE` 在前），且 `state.reward = null` / `state.ceremony` 起 / `state.milks` 10 颗 / `bgm.paused = true`；同局再点 `rewardHit` 返回假、事件表为空；换到第二局再点，重播一次。**真实解码、实际音量、浏览器自动播放策略未验（未开浏览器）**
- **README 滞后（本轮新增 3 处，未擅自改）**：README.md:26「操作」表里"点击地上的奖励（钱袋）⇒ 领取"那条的流程句该补一步"播一次胜利音乐"；README.md:44 的 `sounds/` 素材清单只列了三个 mp3，没有 `winmusic.ogg`；README.md:83「领取与结算演出」的 `markCleared()` → 收奶 → `burstReward()` → 白光 那个序列里，`bgm.pause()` 之后少了 `playWinMusic()`。v0.1.85 / v0.1.86 / v0.1.87 挂账的五处仍在

## v0.1.87（2026-10-28）
- 按你「传送带首张卡片立刻出现，写入传送带默认逻辑 + push」：只加**一个 CFG 数字 + 一个起点函数**，把"首张何时到"变成带子自己的默认行为，`scenes/test.js` 的 push / 阈值 / 冻结逻辑与关卡数据一行没改
- **新字段 `CFG.belt.first = 0`**（单位**秒**，和同块的 `interval.normal/over` 一个量纲；位置就摆在 `interval` 左边 [game.js:16](game.js#L16)），语义是"开场后多久送第一张"，`0` = 立刻。**想退回旧手感把它填 `4` 即可，实测 `first: 4` 复现出 4.000 秒，与改动前逐帧一致** ⇒ 这一个数字就是唯一杠杆，没有第二个开关
- **实现方式**：带子的计时器 `state.beltT` 本来就是"往上数到阈值就 `beltPush()` 再归零"（[scenes/test.js:518](scenes/test.js#L518)），所以把**起点**设成 `interval.normal - first`（新函数 `beltStartT()`，[scenes/test.js:284](scenes/test.js#L284)）就等于"第一张在 `first` 秒落地"，落完之后照旧 4 秒一张。两个播种点都走这个函数：`makeRun` 建局 [game.js:104](game.js#L104) 与 `resetRun()` [scenes/test.js:699](scenes/test.js#L699)——**没有**给 `state` 添新字段（`beltT` 本来就在 `SAVE_KEYS` 里，导出/读档照旧带走当时的计时器），也**没有**加"是不是第一张"的布尔或分支
- **起点为什么用 `interval.normal`**：播种那一刻带长恒为 0，而阈值判据是 `belt.length > overAt`（`overAt = 8`），开局必然走 `normal` 这一支 ⇒ 用 `interval.normal` 反推是精确的，不需要读阈值函数；满带时"冻结不重置"那段（`if (state.belt.length < b.cells)` 整个跳过）没动，所以这套预置只在开局空带上生效
- **"立刻"是哪一刻**：`loop` 在 `state.deckPhase` 期间不调 `updateGame`（[game.js:288](game.js#L288)），时钟也不推进 ⇒ 首张是在 `3 / 2 / 1 / START!` 落下后的**第一帧**送出；开快进（×2）时同样是第一帧（`dt` 翻倍只压缩后面那 4 秒的真实墙钟）。实测（headless 逐帧 `updateGame(0.016)`）：`first = 0` → 第 1 帧就有 1 张、第 2 张在 4.016 秒；`first = 2.5` → 2.512 秒
- **影响面**：所有 `conveyor: true` 的关（当前只有测试场景1）。`beltPreset` 前缀直出走的是同一条 `beltPush()` 调用，所以配了前缀的关第一张前缀卡也一起提前。非传送带关不受影响：`updateBelt` 挂在 `isConveyor()` 上（[scenes/test.js:2067](scenes/test.js#L2067)），实测测试场景2 跑 100 帧带项仍为 0
- **顺带解掉上一轮那条提醒**：v0.1.86 说过"第 1 波（START 后 1 秒）到达时手上必然没卡"。现在带上第 0 秒就有 1 张，实测 t = 3.2 秒时是 `wave 1` / 3 只怪 / 带上 1 张——起手能立刻放一张，只是第 2 张仍要等到 4 秒
- **验证**：六个 `<script>` 全过 `vm.Script` 解析，并按真实顺序灌进 Proxy 桩沙箱真跑 `resetRun` / `updateGame`（含快进、非传送带关、`first` 三档对照）；`beltStartT() = 4`、`SLOTS.*.beltT = 4`、`resetRun` 后仍是 4。**未开浏览器**
- **README 滞后（本轮新增 2 处，未擅自改）**：README.md:77 的"**开局不带卡，第一张等 4 秒**"现在错了（应改成"首张立刻，之后 4 秒一张"），那句里列举 `CFG.belt = { … }` 的字段清单也缺 `first`。v0.1.85 / v0.1.86 挂账的三处（`20 → 5 → 1`、测试场景1 举的两个例子、关卡字段清单缺 `firstGap` + "首波 `first`"未提关卡覆盖）仍在

## v0.1.86（2026-10-28）
- 按你「修改测试场景1 + push」改两处：`beltTable` 的两枚权重（[info/info.js](info/info.js):232），以及**新增一个关卡字段 `firstGap`** 把本关第一波的等待压到 1 秒（[info/info.js](info/info.js):223）；为它动了三个播种/取值点（[game.js:88](game.js#L88)、[game.js:135](game.js#L135)、[scenes/test.js:533](scenes/test.js#L533)、[scenes/test.js:703](scenes/test.js#L703)）
- **传送带权重** `{1:20 … 8:20}` → `{1:15 3:10 4:10 5:10 6:20 8:25}`，合计**仍是 90**（一减一加刚好抵消），所以四张没点名的卡出率不变：でらっくま `22.2% → 16.7%`、ちびみるく `22.2% → 27.8%`，touchhold / らん / Guy 各 11.1%、めがねっくま 22.2% 照旧。`countPenalty: [3, 4]` / `penaltyValues: [5, 1]` 依然是绝对值覆盖，所以现在三档路径变成 `15 → 5`、`25 → 5`、`10 → 5`
- **新增字段 `firstGap`（关卡级，单位毫秒）**：`test1` 写 `firstGap: 1000`，`test2` **不写这个键** ⇒ 走 `CFG.wave.first = 19000`，表现一字未变。取值用 `??` 退回全局，和 `bgm` / `startMilk` 是同一套约定（见 README 的关卡字段说明），不是"给旧档兜底"
- **代码侧只加了一个函数**：[game.js:88](game.js#L88) `levelFirstGap(key)`，形状照抄紧邻的 `levelStartMilk(key)`（[game.js:84](game.js#L84)）。原来第一波的等待写死在**三处**，现在都走这个函数：① [game.js:135](game.js#L135) `makeRun(key)` 里的初始 `waveGap`（`SLOTS` 建局时）② [scenes/test.js:703](scenes/test.js#L703) `resetRun()` 里的 `state.waveGap`（新开一局 / 重新开始 / 结算后回菜单）③ [scenes/test.js:533](scenes/test.js#L533) `randWaveGap()` 的 `state.wave === 0` 分支。第 ③ 处在当前流程里其实走不到（`randWaveGap` 只在 `state.wave++` 之后被调用，[scenes/test.js:2059](scenes/test.js#L2059)），但留着不改成同一个口径就会变成"两个真相"，所以一并换掉
- **这 1 秒从什么时候起算**：`loop` 在 `state.deckPhase` 期间只跑 `updateDeck`、**不调 `updateGame`**（[game.js:284](game.js#L284)），而 `state.clock` 只在 `updateGame` 里 `+= dt * 1000`（[scenes/test.js:2052](scenes/test.js#L2052)），所以阵容全景 + `3 / 2 / 1 / START!` 全程时钟停在 0 ⇒ 第一波是 **START! 之后 1 秒**（`state.clock - state.lastSpawn > state.waveGap` 判定，[scenes/test.js:2056](scenes/test.js#L2056)）；开快进（×2）时真实时间 0.5 秒。整条链路没引入第二套计时，也没碰 `bigGap` / `gapMin` / `gapMax`
- **连带后果（不是 bug，先说明白）**：带子的第一张卡仍要等 `CFG.belt.interval.normal = 4` 秒，所以现在**第 1 波到达时场上必然还没有卡**（改前是 19 秒，够攒 4 张）。怪物从右边缘走到失守线要几十秒，所以实操上只是"起手看一眼阵容"，但这是数据导致的必然，不是偶发。要连这个一起改（比如让带子第一张提前）等你指令
- **存档无关**：`waveGap` 本来就在 `SAVE_KEYS` 里（[save.js:1](save.js#L1)），读档恢复的是档里存的那个数字、不重新取 `firstGap`——按老规矩旧档直接作废、不做迁移
- **验证**（headless Node 真跑代码，不是手算）：六个 `<script>` 全过 `vm.Script` 解析 OK；把 `info/info.js → scenes/menu.js → scenes/test.js → save.js → progress.js → game.js` 按真实顺序灌进 Proxy 桩沙箱后，`levelFirstGap('test1') = 1000`、`levelFirstGap('test2') = 19000`；`SLOTS.test1.waveGap = 1000` / `SLOTS.test2.waveGap = 19000`（建局即对），各自 `resetRun()` 后仍是 1000 / 19000，`wave = 0` 时 `randWaveGap()` 也返回 1000 / 19000（三条路径口径一致）。带权重合计 90、出率 16.7 / 11.1 / 11.1 / 11.1 / 22.2 / 27.8% 由 `INFO` 现算。**未开浏览器**
- **README 滞后（本轮新增 2 处，未擅自改）**：README.md:76 的关卡字段清单里还没有 `firstGap`（应补成"`firstGap`（本关第一波的等待，ms；不写退回 `CFG.wave.first`）`，并进 `bgm`/`startMilk` 那句 `??` 约定）；README.md:78 波次段开头"首波 `first`"要加一句"关卡可用 `firstGap` 覆盖"。v0.1.85 挂过的那两处（README.md:77 的 `20 → 5 → 1`、README.md:78 拿测试场景1 举的两个例子）仍在，本轮 `15 → 5` / `25 → 5` 让第一处更明显

## v0.1.85（2026-10-28）
- 按你点名的四项数值改 [info/info.js](info/info.js) 的 `tracklist.test1` 一个块（:217–:232），**只改关卡数据，一行代码没动**；`test2`、`INFO.monsters` 三条本体、`CFG` 全表（含 `CFG.belt` / `CFG.wave`）、传送带与出怪的机制代码都没碰
- **波次** `waves: 10 → 20`（:222）。分母没有写死的地方：右下角进度条与"本波打完没"的判断都直接读 `lv.waves`（[scenes/test.js](scenes/test.js):1788、:1797、:601、:2056），所以改一个字段就全跟过去
- **出怪倍率** `spawnMul: 1 → 3`（:224）。预算式原样未动：`budget = ceil( unit × spawnMul × (大波 ? bigMul 2.5 : 1) )`、`unit = min(ceil(波 / div 3), cap 8)`。逐波总级别预算 `1/2/3 段` → 各自 ×3：第 1~3 波 `1 → 3`、第 4~6 波 `2 → 6`、第 7~9 波 `3 → 9`、第 10 波 `10 → 30`，第 11~20 波是新增的（12 / 12 / 15 / 15 / 15 / 18 / 18 / 18 / 21 / 第 20 波 53）。`unit` 现在在第 19 波才爬到 7、第 20 波仍是 7（没顶到 `cap 8`）
- **出怪表** `spawnTable: ['chunipenguin'] → ['chunipenguin', 'chunipenguin_prs', 'chunipenguin_ftr']`（:225），即 101 / 103 / 105 三只全入表（和 `test2` 现在同一张表）。`pickMonster`（:444）按各怪自己的 `weight`（4000 / 4000 / 3500）加权、并用 `level`（1 / 2 / 4）做"装不下的怪直接重抽"的门限：剩余额度 < 4 抽不到 ftr、< 2 只剩无防具那只。数据一个没改，只是这两只带防具的现在才进得来。**注意**：`level` 混档之后"预算 = 只数"这个巧合没了——20 波总预算 281 级，只数约 160（1×85 + 2×52 + 4×23），浮动来自抽签；改前 10 波 28 级 = 28 只、清一色无防具
- **大波与末波**：`CFG.wave.bigEvery = 10` 未动 ⇒ 第 10、20 波是大波，而 `isBigWave` 的 `w === lv.waves` 那半条现在也落在 20 上，所以**第 20 波既是大波又是末波**（原来是第 10 波兼两者）。`bigSeed: 'chunipenguin'` 没改 ⇒ 大波额外撒的仍是无防具那只（第 10 波补 4 只、第 20 波补 `min(7, 53-3) = 7` 只）；末波"按 `spawnTable` 顺序每种各一只"从撒 1 只变撒 3 只（1 + 2 + 4 = 7 级，仍远低于 53，不会顶掉大波保底）
- **传送带权重** `beltTable`（:231）：`{1:20 3:20 4:20 5:20 6:20 8:20}` → `{1:20 3:10 4:10 5:10 6:20 8:20}`，合计 `120 → 90`。基础出率：でらっくま / めがねっくま / ちびみるく 各 `16.7% → 22.2%`，touchhold / らん / Guy 各 `16.7% → 11.1%`。id→key 对照按 `INFO.cards[*].id` 核过：1 dxbear、3 touchhold、4 ran、5 Guy、6 meganekuma、8 chibimilk（2 是 `milk`，本来就不在带上）
- **要提醒的连带效果**：`CFG.belt.countPenalty: [3, 4]` / `penaltyValues: [5, 1]` 是**全局的绝对值覆盖、不是乘法**，这轮没动。原来六张同权 20 时"场上攒到 3 张"是把出率砍到 1/4；现在 10 权重那三张同样一步只砍到 1/2，即**档位罚对低权重卡变轻**。想按比例罚得改 `CFG.belt` 而不是关卡表——等你指令
- `name` / `bg` / `bgm` / `startMilk: 50` / `firstReward: null` / `showMonsters: true` / `conveyor: true` / `cardSlots: 6` / `deckSelect: false` / `beltPreset: []` 全部原样保留
- **验证**：`info/info.js` 过 `vm.Script` 解析 OK；上面的预算分段、总级别 281、约 160 只、出率百分比，是把 `INFO` 真读进沙箱后按 `spawnWave` 的同一条式子（含 `pickMonster` 的权重与 `level` 门限）逐波跑出来的，不是手算。**未开浏览器、未 commit / push**（这轮指令没提发布）
- **README 滞后（本轮新增 2 行，未擅自改）**：README.md:77 那句"同 id 在带上攒到 `countPenalty` 的档就把基础权重换成 `penaltyValues`（**`20 → 5 → 1`**）"举的是旧基数，现在带上有三种卡走的是 `10 → 5 → 1`；README.md:78 两处拿测试场景1 举例的话现在不成立——"`level` 大于 1 的怪越多的表…（测试场景2… **测试场景1 全是 1 级才恰好"预算 = 只数"**）"已经反了（101/103/105 全入表，就是"混了 1/2/4 级"的例子），"既是大波又是末波的那一波（**测试场景1 第 10 波**…）"应读作第 20 波。都是举例句、不影响机制描述

## v0.1.84（2026-10-28）
- 按你「更新readme并push」把 [README.md](README.md) 回填到当前代码口径（v0.1.81–v0.1.83 三轮攒下的滞后一次清完），**只改文档，一行代码没动**；三处挂账的滞后条目此前只写在 update.md 里，现在全部落地
- **文件与键名**：「运行」段的载入顺序 `clears.js` → `progress.js`（test.js → save.js → progress.js → game.js 的依赖说明同步），顺带补了一句"因为它早于 `game.js` 求值、顶层 `const CFG` 还在 TDZ，所以只能引用函数体内的 `CFG`"；「通关记录」整条改写成**全局记录**——单键 `apollo7s:progress`、内容 `{ cleared, slots }`、`cleared` 只认 `=== true`、`slots` 不是数字就退回 `CFG.cardSlots`、`setSlots()` 夹到 `[6, 10]`、并注明**现在没有任何玩法途径会调它**；旧键 `apollo7s:cleared` 标成已废弃、不迁移。「目录结构」里的 `clears.js` 行同样换成 `progress.js`；「已知未完成」里首通奖励那条的键名一并改到 `apollo7s:progress.cleared`
- **顶栏槽数**：「玩法循环 · 卡片」那句"卡槽只有 `CFG.cardSlots = 6` 个"改成 `slotCount()` 口径（关卡 `cardSlots` 优先 → 全局 `getSlots()`，`CFG.cardSlots` 是初始兼下限、`CFG.cardSlotsMax` 是上限），选卡条件写清是"槽数少于卡数才进选卡"；「操作」表里"其右是 6 个卡槽"改成 `slotCount()` 个，并说明传送带关整块不画奶读数但奶照旧累计
- **出怪按钮**：「操作」表里那一整行删掉（v0.1.81 就没有手动出怪入口了），改成表下一句注记说明 `manualSpawn()` 是"有定义、无调用点"的保留接口；「奖励的掉落与拾取」里"比如手动 `出怪` 塞进来的健康怪"跟着改成"将来接上入口后由 `manualSpawn()` 塞进来的"
- **传送带**：新增一条 `**传送带**` 机制说明（`CFG.belt` 全字段、步距复用 `cardSlot.w + cardGap` 故无新增间距常数、`cells: 10`、阈值 `count <= 8 → 4s / > 8 → 10s`、满带 `beltT` 冻结不重置及其"掉回 8 只当帧补一张"的连带后果、`beltTable` 权重 + `countPenalty`/`penaltyValues` 档位罚 + `lastMul^beltLayers` 连送罚、`beltPreset` 前缀直出绕过权重但仍更新 last/layers、`BELT_ADJUST = {}` 钩子语义、带项一次性令牌与 `state.beltSel`、`heldCard()` 让四种反馈与卡槽同步、奶条与 `!isConveyor()` 的屏蔽范围）；「关卡」条目的字段表补 `conveyor` / `cardSlots` / `beltTable` / `beltPreset`，"三种开局"改成**四种**，约定句加上"`conveyor` 是能力开关、普通关整键不写、`isConveyor()` 只认 `=== true`"；「操作」表新增点带项那一行；「改数值 / 加内容」第 3 步的字段清单同步，第 5 步的 `CFG` 清单加上 `cardSlots`/`cardSlotsMax`/`CFG.belt`/`CFG.monster.ash`；末尾那条"布尔与常量 vs 能力开关"的约定清单两边都补全（`ash` / `deckSelect` / `cardSlots` 进前者，`conveyor` / `beltTable` 进后者，`beltPreset` 单独注明"空数组也要明写"这个例外）
- **灰烬与化灰**：「卡片」条写明 `ash` 紧跟 `immune`、7 张卡全明写、只有 touchhold 为 `true`，并说清它只标"这张卡的伤害属于灰烬伤害"、Guy 的 `boom` 同为 1800 但没有该标记；「防具 · 范围伤害」那条补上 `hurtArea(m, dmg, ash)` 的新签名、**第三参数只有 `burstDamage` 传**（`boomDamage` 与子弹不传 ⇒ 恒假）、一类二类都不参与"够不够格化灰"的比较；新增一条 `**化灰**` 说明，覆盖 `dmg > m.hp` 的严格大于与比当前 hp、秒杀检查在写 `m.hitT` 之前（所以不闪白）、`makeAsh` 的字段集、`hp = 0` 由既有 `noCorpse` + 掉落回滚接手、当帧离开 `state.monsters` 后的一系列后果、`ashImgs`/`ashSprite` 独立缓存表且**不能复用 `flashImgs`**、`drawAsh` 与 `drawCorpse` 同层且恒 alpha / 不 rotate / 不减 slide / 无影子、防具按抄 `drawArmor` 公式跟着黑（`drawArmor` 未加参数或分支，`monsterBox` 只读 `type`/`x`/`row` 所以能直接喂快照）、计时跑裸 `dt` 不吃 `sf`、`state.deaths` 与 `state.ashes` 互斥、`deaths`/`ashes` 已进 `SAVE_KEYS`（读档补播剩余演出）、以及 `stopped` **不挡**这三段动画这一实测事实；「受击与离场演出」那条末尾的清单把化灰算进"已做完"
- **已知未完成**新增三条：卡槽解锁无途径（含"全局槽数一到 7 就静默关掉普通关选卡"这颗地雷与数字键只映射 `1`~`6`）、化灰降级分支今天跑不到（`1800 > 270` 恒成立，只在沙箱用假 hp 验过）、二类防具的化灰分支今天画不到（`a2` 只有代码路径没有数据）
- **未动**：`00_MASTER_PROMPT.md`、`01_FIRST_PLAYABLE.md`、`update_7sRef.md`（本轮无玩家可感知变化，不新开段落）与所有 `.js` / `index.html`；README 里既有的正确内容（舞台尺寸、命中判定口径、波次预算、牛奶/奖励/结算、抠图与美术约定等段）只做了与新机制相邻的措辞衔接，没有重写
- 本轮另含一次发布：把未提交的工作区（v0.1.81 传送带 + 槽数解锁、v0.1.82 带上拿卡手感、v0.1.83 灰烬化灰、v0.1.84 文档回填）提交并推到 `origin/main`，触发 GitHub Pages 重新发布——**push 是你这条指令点名的动作**

## v0.1.83（2026-10-28）
- 按交付说明「灰烬伤害类型 + 化灰动画（touchhold）」§1–§6 实现：只有 `touchhold` 一张卡带 `ash`，1800 若严格大于怪物**当前** hp 就化灰（全身染黑 2.5s、无淡出、不产尸体与防具掉落），改的是 [info/info.js](info/info.js)、[game.js](game.js)、[scenes/test.js](scenes/test.js)、[save.js](save.js) 四个文件
- **数据（§1）**：7 张卡各加一个布尔 `ash`，位置固定在 `immune` 右侧、字段顺序全表一致（`... cd, costmilk, immune, ash, flip ...`）——info.js:21 `dxbear` false、:34 `milk` false、:48 `touchhold` **true**、:65 `ran` false、:78 `Guy` false、:100 `meganekuma` false、:118 `chibimilk` false。全部明写 `true`/`false`，不留缺省。`touchhold.burst` 仍是 `{ damage: 1800, radius: 1 }`、`Guy.boom` 仍是 `{ damage: 1800, radius: 0.5 }`，数值一字未动。**怪物数据一个字段都没加**：没有 `ashResist`、没有阈值字段、hp 全不变
- **§1.4 必须提醒读者的事**：三只怪物本体 hp 都是 **270**，而唯一的灰烬来源伤害是 **1800**，`1800 > 270` 恒成立 ⇒ **降级分支（`hurtArea` 里 `ashKill` 之后的原路径）在当代数据下永远不会被走到**。它保留是为了以后 hp ≥ 1800 的怪物；看代码别误以为两种表现都现在可测
- **CFG（§2）**：game.js:27 `CFG.monster` 内、紧挨 `death` 之后加 `ash: { dur: 2.5, color: '#000000' }`。`dur` 是"从纯黑到整条记录消失"的总时长，中途**没有 fade**（到时直接 `filter` 删掉）；黑色只从 CFG 读，绘制代码里没有任何硬编码 `#000`；未新增美术字段、未放占位图
- **伤害路径（§3）**：`hurtArea(m, dmg)` → `hurtArea(m, dmg, ash)`（test.js:368），第一行是 `if (ash && dmg > m.hp) { ashKill(m); return; }`（:369）——**在 `m.hitT = hf` 之前**，所以化灰的怪物连受击闪白都不会闪（实测 `hitT` 为 0）。这行之后到函数结尾与原文件逐字节相同。第三个参数**只有 `burstDamage` 传**（:176 `hurtArea(m, b.damage, !!CARDS[p.card].info.ash)`）；`boomDamage`（:224）与子弹路径 `hurtBody(hit, b.dmg)`（:2233）都不传 ⇒ `undefined` 为假 ⇒ Guy 的 1800 自爆行为与改动前完全一致。语义按你确认的三条：比的是**当前 `m.hp`**（不是上限）、**一类与二类防统都不参与**这个比较、**严格大于**（`dmg === m.hp` 走降级、出普通倒地）
- **死亡记录（§4）**：test.js:359 `makeAsh(m)` 返回 `{ type, x, row, t: 0, a1: !!m.a1hp, a2: !!m.a2hp }`；:363 `ashKill(m)` 做两件事——`m.hp = 0` 与 `state.ashes.push(...)`。**`hp = 0` 就是死亡判定**，接住它的是 `burstDamage` 里原有的 `if (m.hp <= 0) { m.noCorpse = true; state.drops.length = nd; }`（:177-180），这两行按你的要求未改，于是无尸体、无防具掉落。`state.monsters` → `hp <= 0` → `continue` → `alive` 那条管线逐字节未动 ⇒ 化灰的怪同一帧就离开 `state.monsters`：不再走、不啃、不被啃、对后续伤害免疫，也不阻塞清场/催波/奖励结算，而波次进度条分子仍靠 `state.monsters` 推进。`a1`/`a2` 只是"当时有没有挂着这层防具"的绘图布尔，不存 hp 快照；记录里**没有 `sf`**（化灰计时跑裸 `dt`，不受减速影响）。初始化：game.js:113 `makeRun` 里 `ashes: []`（紧挨 `deaths`/`drops`），test.js:679 `resetRun` 里 `state.ashes = []`
- **绘制（§5）**：新增独立缓存表 `const ashImgs = {}` + `ashSprite(key, s)`（test.js:1283-1297，你给的原文），`source-in` 合成 `CFG.monster.ash.color`。**没有复用 `flashImgs`**（那张是白色受击闪，共用会把闪白重新染黑），`flashSprite` 本体未动；缓存键只有 `key`，依据是尺寸只由 `INFO.monsters[type].scale` / `INFO.armors[key].scale` 决定。`drawAsh(a)`（:1355，紧跟 `drawCorpse`）与 `drawCorpse` 同层：`render()` 里 :1691 `for (const c of state.deaths) drawCorpse(c);` 之后立刻加 :1692 `for (const a of state.ashes) drawAsh(a);`。本体走 `plantSize` + `feetLine(a.row)`，**恒定 `globalAlpha = 1`、不 rotate、不减 `d.slide`** ⇒ 站姿、原地、不淡出；无地面阴影；第 0 帧就是纯黑，`a.t` 只用于计时。
  - **§5.2 的定位选择（现读现取后定的）**：先读了 `monsterBox` / `hitBox` / `drawArmor`——`monsterBox` 只读 `type`/`x`/`row` 三个字段，所以**快照 `a` 直接喂进去复用定位**（实测 `monsterBox(a)` 给出 `cx 1000, cy 553`）；但 `drawArmor` 内部用 `flashSprite`/`armorSprite` 上色，产出不了黑图，而你又禁止给它加参数或分支 ⇒ 未改它，改为在 `drawAsh` 里**抄那两行公式**（`plantSize(imgs['arm_'+key], ar.scale)`、`cx = box.x + ar.dx`、`cy = box.y + box.h/2 + ar.dy`）再换上图源。抄的等价性已量过：同一只挂一类防具的怪，抄出来的矩形与 `drawArmor` 自己算的 `x 934.700, y 502.780, w 130.600, h 100.440` 完全一致。防具循环写 `[a.a1 && mi.armor1, a.a2 && mi.armor2]`，二类今天没有怪用但照你要求一并写了、没留 TODO
  - **`CFG.artPad` 的 px/py 为什么在 `drawAsh` 里不出现**：`drawCorpse` 先 `translate(x - s.w/2 + px, feetLine - py - s.h)` 再 `drawImage(img, -px, py - s.h)`，两次偏移互相抵消（`k = 0`、无 rotate/slide 时），净落点正是 `x - s.w/2, feetLine - s.h`。数值验证：`px 35.663 / py 22.136`，`890.552 - 35.663 = 854.889`、`500.664 + 22.136 = 522.800`，与 `drawAsh` 的 `854.889 / 522.800` 相同 ⇒ 直接用 `drawCorpse` 的净坐标即可，不需要重抄 pad
- **计时与存档（§6）**：test.js:2265-2267 紧跟 deaths 管线之后加 `const ash = CFG.monster.ash; for (const a of state.ashes) a.t += dt; state.ashes = state.ashes.filter(a => a.t < ash.dur);`——用 `dt` ⇒ 快进（×2）自然生效（实测 1× 在第 **2.517s** 过期、2× 在 **1.25s**）。存档：save.js:3 `SAVE_KEYS` 追加 `'deaths'`、`'ashes'`（你明确要求"进，将原来的倒地动画也计入"）；两者都是扁平小对象，走 `snapshotRun` 的通用循环，没有 `monsters` 那种特判。`applyRunText` **没加**新校验分支（与 `banners`/`effects`/`drops` 同例）。
  - **§6.1 的前提与实测不符，报给你**：说明里写"`state.reward` / `state.ceremony` 期间 `dt` 已被 `stopped` 挡住"。实际 `const stopped = !!(state.reward || state.ceremony)` 只挡传送带补卡、自然掉奶与 `produce`，**没挡尸体/掉落/化灰这段计时**。实测：奖励期跑 30 帧后 `ashT 0.5 / deathT 0.5`，白幕期 `ashT 0.5`。因为倒地动画本来就是这个行为（v0.1.61 起尸体照走），我按你的"照抄 deaths 管线"实现、**没有另加判断**——要不要让 `stopped` 也冻结这段动画，等你指令。
  - 连带副作用（记一次）：菜单「导出」的 json 现在会带 `deaths` 与 `ashes` 两个数组；又因为 `deaths` 以前不存档，导入一存档会把它当时剩余 ≤1.1s 的倒地动画播完（`2265` 的 filter 到点自清），属预期、非 bug
- **§7 陷阱自查**：①秒杀判定在 `m.hitT` 之前 ✔（实测 `hitT 0`）；②`noCorpse` + `state.drops.length = nd` 未动 ✔（实测 `dropsGrew false`、防具 hp `370` 原封不动）；③未共用 `flashImgs` ✔（化灰帧后 `flashKeys ""`、`ashKeys "enm_chunipenguin_prs,arm_prs"`）；④灰烬记录只进 `state.ashes`，`deaths` 恒 0 ✔；⑤`ash` 没进 `INFO.bullets`、也没进 Guy 的 `boom` ✔；⑥断网回归：`lifeT 30` 的 touchhold 手动移除 ⇒ 场上 `found 0`、植物 1→0、`ashes 0`、`effects 0`（没引爆、没黑、没 `cp.png`）、怪 hp 仍 270 ✔；⑦挂一类防具被 1800 打 ⇒ 化灰、防具同黑、无掉落无碎裂 ✔，`dmg == m.hp`（今天数据不可能）⇒ 走一类吸收 + 普通倒地 ✔（强制 hp 1800 实测 `ashes 0`、`hp 0`；hp 2000 + 1800 ⇒ `hp 200`、`ashes 0`、正常闪白 `hitT 0.05`）；⑧Guy 自爆回归：`ashes 0`、`hp -1160`、`hitT 0.05`、`noCorpse true`、下一帧 `deaths 0`（自爆从来不留尸体）⇒ 与改动前一致 ✔；另测真实射手（dxbear 打 tap）`hp 270 → 210`、`ashes 0`，子弹路径未被波及 ✔
- **语法**：`info/info.js`、`game.js`、`scenes/test.js`、`save.js`、`index.html` 引用的 6 个脚本逐个 `vm.Script` 过解析，全部 OK；未开浏览器、未 commit/push
- **README 滞后（未改，等你指令）**：README.md:63 仍写 `CFG.cardSlots = 6`（今天已是可以解锁到 10 的基线值）；「运行」段 lines 13/16/37 与 line 106 仍指已删除的 `clears.js` 与 `apollo7s:cleared`（现为 `progress.js` / `apollo7s:progress`）；line 73 的"三种开局"未含 v0.1.81 的传送带即时开局档
- 玩家日志见 [update_7sRef.md](update_7sRef.md) 同日期段「2026-10-28 · 1800 伤害会把怪烧成灰」

## v0.1.82（2026-10-28）
- 按你「传送带上选中无法取消 / 没有预览 / 没有绿框红框 / 悬停不显示名称，传送带选择应与正常卡槽相同」——把 v0.1.81 遗留的"带上选中只走 `state.beltSel` 一条私有路径"接回公共的选中管线，改的是 [scenes/test.js](scenes/test.js) 与 [game.js](game.js) 两个文件
- **新增单一真相源 `heldCard()`**（test.js:294，紧挨 `slotAt`）：`if (isConveyor()) return state.beltSel >= 0 ? CARDS_BY_ID[state.belt[state.beltSel].id] : null; return state.selected === null ? null : CARDS[state.deck[state.selected]];`。带上返回卡对象（`{ key, info }`，与 `CARDS[ci]` 同形），槽位返回同一形状，所以下游一律拿这一个值、不必再分支。**`state.beltSel` / `state.selected` 两个字段都保留**（§13 那条"不许复用 `state.selected`"仍然成立），统一的是"谁被拿在手里"这件事的读法
- **三处只认 `state.selected` 的选中反馈改为认 `heldCard()`**（都在 `render()` 里，一次算好存 `const held = heldCard()`，test.js:1580）：①鼠标所在格的绿/红底（:1581，原来是 `if (state.selected !== null)`）——带上选中后同样有绿框（可种）与红框（已占/超出可种列）；②压在怪物身上的红色判定框预览（:1693）；③跟随鼠标的半透明伙伴预览（:1706，原来还要再 `CARDS[state.deck[state.selected]]` 解一次，现在直接用 `held.key / held.info.scale / held.info.flip`）。三处的门限、颜色、透明度都没动，只换了"有没有选中"的判据
- **取消路径补齐**（这是第 1 条症状的根因：原来只有"点另一张"会覆盖，没有任何东西能清空 `beltSel`）：再点同一张卡 = 取消（test.js:1940 `state.beltSel = state.beltSel === bi ? -1 : bi;`，与槽位 :1968 的 `state.selected === si ? null : si` 同形，同时 `state.net = false`）；右键取消（game.js:264 在原有 `state.selected = null` 旁加 `state.beltSel = -1`）；Escape 取消（test.js:1986）；`` ` `` 切断网时一并取消（:2005）；点断网按钮时一并取消（:1934）。放置成功仍然只清 `beltSel`（:1951）
- **名称文本框**（test.js:1713-1722）：提示链原本是"槽位 → 断网"两级，现在中间插入带项一级 `else if (bi >= 0) drawTip(带项左缘 + cardSlot.w / 2, CFG.belt.y + cardSlot.h + 8, [CARDS_BY_ID[...].info.name])`，用的还是 `drawTip`（game.js:231）同一套气泡样式与位置（顶栏下沿 8px），**只一行名称**：不带费用行、不带"重新装填中"行，因为带上无费用无冷却。半露在带外的卡 `beltItemAt` 本来就返回 −1，所以既不出现指针、也不出现气泡
- **顺带发现并修掉一个真实的点不动**：`testClick` 里断网按钮的分支写在 `isConveyor()` 块**之后**，而传送带块无条件 `return` ⇒ 上一轮传送带关点断网根本没反应（只有 `` ` `` 能用）。现在把 `netRect` 分支提到 `isConveyor()` 之前（:1931），两种关卡行为一致；带面板横跨 `256..1542`、断网在 `1590` 起，两者不相交，所以提序不会抢点击
- **未动**：`drawBelt` 的选中高亮（:1516 沿用 `drawPickRing`，与槽位选中是同一个 `#ffe14a` 发光式子）；`testHover` 的指针判定（上一轮已含 `beltItemAt(...) >= 0`）；带上放置的字段集、无费用无冷却、`splice` 补位；数字键在传送带关仍然直接 `return`（带上卡是流动的一次性令牌，没有稳定的 1–6 映射）；奶条屏蔽三条、`manualSpawn()` / `setSlots()` 两个无调用点接口、`beltX` 取法、权重与存档一律未动
- **验证**（未开浏览器；`ELECTRON_RUN_AS_NODE=1` + `vm.createContext` 沙箱，六份脚本桩件加载后真调 `testClick` / `testKey` / `render` / `testHover`）：逐文件 `vm.Script` 解析 `info/info.js` `scenes/menu.js` `scenes/test.js` `save.js` `progress.js` `game.js` 全 OK。传送带关：悬停第 1 张 `beltItemAt = 0`、卡间隙 −1；连点同一张 `0 → −1 → 0`；点第 2 张切到 `1`（`heldCard().info.name` 跟着变成 touchhold）；有 `held` 时空格 `canPlant = true`（绿）、占住的格 `canPlant = false`（红）；Escape 后 `beltSel = −1` 且 `heldCard() = null`；右键式子同样清零；点断网 `state.net = true` 且 `beltSel` 归 −1（上一轮做不到）；放置后 `plants +1`、带长 `2 → 1`、`beltSel = −1`、`milk` 仍 50 未扣。普通关：`heldCard()` 起手 null、点槽 2 → `selected = 2` 且 `heldCard().info.name = touchhold`、再点取消回 null、`beltSel` 全程 −1（顺带记一句：清掉冷却前那次点不动是冷却门槛本身，`cool[2] = 33.33 > 0`，不是本轮改坏）。两关各跑 `render() + testHover()` 含"带上已选"与"槽位已选"两种态，异常 0 条
- **README 滞后（未改，等你指令）**：沿用上一轮挂着的那三条（README.md:63 的 `CFG.cardSlots = 6` 硬常数说法、「运行」段 13/16/37 的 `clears.js` → `progress.js` 与 `apollo7s:cleared` → `apollo7s:progress`、73 行"三种开局"缺传送带），本轮无新增失真

## v0.1.81（2026-10-28）
- 本轮 = 你那份「交付说明 · 传送带关卡（conveyor）+ 顶栏卡槽数可解锁」§1–§12 一次性落地，占一个版本号。写日志前按规矩重读 `head -6 update.md`，最新是 v0.1.80 ⇒ 本条记 v0.1.81
- **§1 出怪按钮撤掉、接口留着**：`uiRects.spawnBtn` 矩形、它的 `drawButton`、`testHover`（scenes/test.js:1808）里的命中项、`testClick`（:1826）里的分支四处删净，所有关卡都不再有手动出怪入口；`manualSpawn()`（:402，就在 `spawnMonster` 旁边）按说明原式 `spawnMonster(pickRow(), INFO.tracklist[state.slot].spawnTable[0], 0)` 保留且**当前没有任何调用点**——不绑键、不留空矩形、不做隐藏入口。`spawnMonster` / `pickRow` / 「关闭自然出怪」开关一字未动
- **§2 `clears.js` → `progress.js`**：文件重命名，`index.html:29` 引用同步、位置仍在 `save.js` 之后 `game.js` 之前；旧键 `apollo7s:cleared` **不迁移**（按老规矩直接丢弃）。新单键 `apollo7s:progress` = `{ cleared: {}, slots: CFG.cardSlots }`，接口五个：`initProgress`（解析失败 → 回默认 + `console.warn`）/ `isCleared` / `markCleared`（只认 `=== true`）/ `getSlots` / `setSlots`。一个必然的写法差异：`progress.js` 早于 `game.js` 求值，那时顶层 `const CFG` 还在 TDZ，所以模块初值是 `slots: null`（含义 = "从没写过"），`CFG.cardSlots` 只在函数体内引用（progress.js:29 取默认、:33 夹到 `[CFG.cardSlots, CFG.cardSlotsMax]` = `[6,10]`）。即时写盘 / 不嵌进关卡存档 / 不随导入导出 / 不受 `resetRun()` 影响四条照旧。**本轮没有任何玩法途径能加卡槽** ⇒ `setSlots()` 与 `manualSpawn()` 同为"留着的无调用点接口"
- **§3 CFG**（game.js）：`cardSlots: 6`（:11）语义由"固定值"变成"初始值兼下限"，数值没动；新增 `cardSlotsMax: 10`（:12）与 `belt`（:14-19）= `{ x: 256, y: 24, cells: 10, speed: 100, interval: { normal: 4, over: 10 }, overAt: 8, countPenalty: [3, 4], penaltyValues: [5, 1], lastMul: 0.5, panelColor: 'rgba(70,50,25,0.65)', stripe: 'rgba(255,255,255,0.08)' }`。**没有新增任何间距常数**：带内步距复用 `CFG.cardSlot.w + CFG.cardGap = 131`；`belt` 里**没有 `img` 字段**，面板、竖纹、卡面边框全代码画；`档`（`countPenalty` / `penaltyValues`）与 `罚`（`lastMul`）保持两组独立字段；门限按只数：`count <= 8 → 4s`、`count > 8 → 10s`。`netSlot`（:21）删掉 `x`，只剩 `y / w / h`
- **§4 关卡字段**：`conveyor` 是能力开关，普通关**整键不写**，`isConveyor(k)`（test.js:261）只认 `=== true`；`cardSlots`（:265 `slotCount()`）优先关卡值、缺省回退 `getSlots()`；`beltTable` 用 **id** 寻址、每项 `weight` 明写（本轮全是 20），配套 `CARDS_BY_ID`（game.js:53-54，紧挨 `const CARDS`）；`beltPreset` 即使为空也明写 `[]`，语义 = 前缀直出、之后回到加权表，不写 `null` 占位的混排 preset；传送带关 `deckSelect: false` 明写
- **§5 替换点清单（数量与残留）**：`CFG.cardSlots` 的 12 个读取点 → `slotCount()`：test.js `slotAt`(:295)、`fullDeck`(:710)、`emptyDeck`(:716)、`deckTarget`(:724)、`needPick`(:805)、`deckRemove`(:927)、`deckClick`(:1108)、`drawCardHud` ×2(:1417、:1438)、`testKey`(:1981) + save.js:55；`fullDeck(k)` / `emptyDeck(k)` / `deckCool` 这条链改带 key，是因为 `makeRun`（game.js:96、:121 都传 `key`）与 `applyRunText` 跑在 `state` 建立之前。残留的 `CFG.cardSlots` 只有三处——game.js:11 的定义本身、progress.js:29 的默认、progress.js:33 的下限，都不是布局读取。`CFG.netSlot.x` 的 5 个读取点 → `netRect()`（test.js:270）：`drawTopHud`(:1522)、`render` 的断网提示命中(:1706)、`render` 的鼠标跟随预览(:1719)、`testHover`(:1818)、`testClick`(:1938)。**§5 自检通过**：n=6 时 `netRect().x = 1066`，与被删掉的 `CFG.netSlot.x` 逐位相同；撤掉出怪按钮后 n=10 ⇒ 断网占 1590..1750，与 `ui.menuBtn`(1888) 之间还剩 138px，`[6,10]` 全都放得下
- **§6 传送带几何**：`beltSpan()`(:276) `= 10 × 131 − 24 = 1286`；入带左边缘 `CFG.belt.x + beltSpan() = 1542`（整只在带外）；面板 `roundRect(belt.x-16, belt.y-12, 1286+32, cardSlot.h+24, 20)` 用 `panelColor` + `rgba(255,255,255,0.35)` 描边；竖纹间距 131、随 `state.beltScroll = (beltScroll + speed*dt) % 131` 与卡同速滚；每只卡面 `imgs['card_' + key]` 画在 `(it.x, belt.y + CFG.cardFace.offset, cardSlot.w, cardSlot.w)`。逐只绘制包在 `ctx.save(); ctx.beginPath(); ctx.rect(belt.x, belt.y, beltSpan, cardSlot.h); ctx.clip(); … ctx.restore();`（drawBelt，:1491）里，`restore` 收尾一处不漏——§13 第一条。运动与计时都在 `updateGame` 既有的 `const stopped = !!(state.reward || state.ceremony)` 同一条非 stopped 分支上（:2008 `if (!stopped && isConveyor()) updateBelt(dt);`），`deckPhase` 期间同样不推进，没有第二套快进。**满带时 `beltT` 冻结不重置**（:499 `if (state.belt.length < b.cells)` 整块跳过），阈值按当前只数取 `over` / `normal`。**不预放卡**，第一张等 4 秒
- **⚠ 一处按说明的散文改写了你的字面式子**：§6 写 `beltX(i) = CFG.belt.x + (CFG.belt.cells - 1 - i) * 131`（`belt[0]` 的家在最右格），但同一份说明的「最左格是墙」「入带左边缘 1542」「每帧 `x -= speed*dt`」「放置后 `splice(idx,1)`，后面的卡自然跟带滑上去」只有在"左端是墙、卡自右向左堆"时才自洽：按字面式子，第 2 只的家是 1304，它得向左穿过已经停在 1435 的第 1 只 ⇒ 必然重叠；中间 splice 后左侧那几只还会向右漂，逆着带向。所以实现为 `beltX(i) { return CFG.belt.x + i * (CFG.cardSlot.w + CFG.cardGap); }`（test.js:280）。要回字面式子只改这一行：`return CFG.belt.x + (CFG.belt.cells - 1 - i) * (CFG.cardSlot.w + CFG.cardGap);`。**实测**（90 秒 @60fps）：任意时刻相邻两只的最小间距恰为 131，从不重叠；满带停在 `[256, 387, 518, 649, 780, 911, 1042, 1173, 1304, 1435]`
- **§13 点名的连带后果保留不修**：从 `>8` 掉回 `<=8` 那一帧 `beltT` 已攒到 10 ⇒ 立刻补发一张，这是"不重置"的直接后果，没有加跨阈值重置。实测：9 只、`beltT = 7` 时移走一只变 8 只，3 帧内就多发了一张；满带期间连续 20 秒补发 0 张。带上的出卡时刻实测为 4.02 / 8.03 / 12.05 / 16.07 / 20.08 / 24.10 / 28.12 / 32.13 / 36.15，第 10 只在 **46.15**（9 > `overAt` 8 ⇒ 10 秒）
- **§7 交互**：带上的卡无费用、无冷却、不写 `state.cool`；点带项 → `state.beltSel = idx`（不与 `state.selected` 复用，§13），点格子 → `CARDS_BY_ID[id]` 走现有 `canPlant` / `plantAt`，推进 `state.plants` 的字段集与卡槽路径**逐键相同**（实测键集合就是 `row, col, card, atkT, prodT, lifeT, placeT, armT, hitT, hp`），随后 `splice` + `beltSel = -1`；一条带项是一次性令牌，同 id 可在带上并存多张；不画费用文字、不做灰化，选中沿用 `#ffe14a` 描边环。`beltItemAt(x, y)`（:284）= 卡矩形 ∩ 带可视矩形，被裁掉的半只不可点（实测 `belt.x - 5` 与右边缘外都返回 −1），已加进 `testHover` 的指针表达式。数字键在传送带关直接 `return`（:1979），`` ` `` 与 Escape 未动。奶条在传送带关**整块不画**（不是画 0）：`drawTopHud` 在 :1521 分流，`drawCardHud` 根本不进
- **§8 牛奶只屏蔽三条**：①顶部 HUD 的奶面板在传送带关整块跳过、位置不让出（`CFG.milkSlot` 与其余布局未改，不回流）；②自然掉奶门 `&& !isConveyor()`（:2009）；③**照样计算、只是不显示**——`state.milk` / `state.milkShown` 照旧累加，produce 伙伴（id 2）照旧产可拾取的奶，奖励爆 10 颗照旧，没有任何"奶冻结"
- **§9 传送带强制跳过选卡**：`needPick()`（test.js:803-806）首行 `if (isConveyor()) return false;`，其余原样 —— `return INFO.tracklist[state.slot].deckSelect !== false && slotCount() < CARDS.length;`。`beginDeck(needPick())`、阵容全景 + `3/2/1/START!` 倒计时都保留，带只在 `deckPhase` 结束后走；传送带关 `state.deck = emptyDeck(key)`（:817）。你点出的地雷按 §13 处理：`CFG.cardSlots < CARDS.length` → `slotCount() < CARDS.length` 之后，全局槽数一旦 ≥7 会静默关掉普通关的选卡，所以两关都**明写** `cardSlots: 6`；`testClick` 的传送带分支（:1921）结尾 `return`，槽位路径与带路径不会在同一帧双执行
- **§10 权重**：`beltCount`(:442) / `beltWeight`(:448) / `pickBeltId`(:456) 逐字照说明，档 = `n >= cp[1] ? pv[1] : n >= cp[0] ? pv[0] : base`、罚 = `state.beltLast === id ? Math.pow(CFG.belt.lastMul, state.beltLayers) : 1`，两者相乘；preset 优先、绕过权重但仍更新 `beltLast` / `beltLayers`（新 id ⇒ `layers = 1`，同 id ⇒ `++`）。钩子表 `const BELT_ADJUST = {}` 在 `scenes/test.js:440`（不在 info.js），本轮是空对象——test1 没有要说的，按"没有东西可说就整块不写"处理；返回数字 = 覆盖"档×罚"的绝对最终权重，`undefined` = 不覆盖，ctx 只读 `{ id, weight, belt, plants, monsters, clock, milk, count }`（局部命名 `bctx`，避免遮蔽全局 2D `ctx`）；关卡没写 `beltTable` 时 `pickBeltId` 不会被调到。取样循环镜像 `pickRow`、末尾 `return lv.beltTable[lv.beltTable.length - 1].id`，**没有** `total <= 0` / NaN 兜底。实测：base 20；带上同 id 3 只 ⇒ 5、4 只 ⇒ 1；`beltLast` 命中时 `0.5^1` ⇒ 10、`0.5^2` ⇒ 5；`beltLast` 换成别的 id ⇒ 回 20。preset 实测前两张按序直出（`beltPresetAt` 记进度），第三张起回加权表
- **§11 存档**：`SAVE_KEYS`（save.js:1-3）尾部追加 `belt, beltT, beltLast, beltLayers, beltPresetAt, beltSel, beltScroll` 七项（`beltScroll` 采纳你标的"推荐进"）；`makeRun`（game.js:99-105）与 `resetRun`（test.js:678）同样初始化这七项。`applyRunText`（save.js:40-65）的丢弃谓词不再检查 `deck.length !== CFG.cardSlots`：长度不符改成按 `slotCount(key)` 补 `null` / 截断，`cool` 同位补 `0`，其余谓词（`plants` / `monsters` / `CARDS[ci]` / deck 项合法）原样。实测：`deck [0,1,2] → [0,1,2,null,null,null]`、`cool [1,2] → [1,2,0,0,0,0]`；7 项 deck 截成 6 且存档仍判有效（不再整份丢弃）；`beltSel` 越界夹到带尾、带空时回 −1；`beltScroll` 原值恢复
- **§12 关卡**：`tracklist.test1`（info/info.js:220-224）+= `conveyor: true, cardSlots: 6, deckSelect: false, beltPreset: [], beltTable: [{id:1,weight:20},{id:3,weight:20},{id:4,weight:20},{id:5,weight:20},{id:6,weight:20},{id:8,weight:20}]`（不含 id 2 那只产奶的），`waves 10` / `spawnTable` / `startMilk 50` 未动；`test2`（:236）只 += `cardSlots: 6`，不写 `conveyor`
- **验证（未开浏览器，按你 §0）**：本机没有 `node.exe`，node-repl 内核又被一次同步死循环卡死，所以语法与行为都走打包的 Electron-as-Node（`ELECTRON_RUN_AS_NODE=1`，Node v24.18.0）+ `vm.createContext` 沙箱，六份脚本桩掉 2D 上下文 / `Image` / `Audio` / `localStorage` / `requestAnimationFrame` 后整体加载并真跑被改的函数。逐文件 `vm.Script` 解析：`info/info.js` OK、`scenes/menu.js` OK、`scenes/test.js` OK、`save.js` OK、`progress.js` OK、`game.js` OK。顺带记一句给以后：**沙箱里 `while (state.beltT < 7) updateBelt(dt)` 永不返回**，那正是"满带冻结"的必然结果而不是 bug，跑带上的模拟要用有界帧循环。集成实测：test1 连跑 30 秒 `updateGame` + 周期 `render` + `testHover` 无异常（带上 7 只、自然奶 0 颗、`state.milk` 仍 50、第 1 波正常出怪），数字键 `3` 被忽略、点已占用的格子不吃带上的卡、断网点选路径仍可达；test2 连跑 30 秒无异常（自然奶 4 颗、`deck` 6、`cool` 6），`` ` `` 切换断网、Escape 取消如旧；`markCleared('test1')` 写出 `{"cleared":{"test1":true},"slots":6}`
- **未动**：`rowWeight` / `pickRow` / `spawnMonster` 保持你手改现在的样子（下限 `0.01`、上限 `100`）；`CFG.milkSlot` / `CFG.cardSlot` / `CFG.cardGap` / `netSlot.y/w/h` 未改；胜负判定、结算演出、奖励、防具、波次预算、`progress` 之外的存档键全部未动；没有新增快捷键、没有带卡拖拽、没有新美术、没有兜底分支、没有顺手重构
- **README 滞后（未改，等你指令）**：README.md:63 那句「当前 7 张卡…而卡槽只有 `CFG.cardSlots = 6` 个，所以进关会先经过选卡界面」已不再是硬常数——现在是 `slotCount()`（关卡 `cardSlots` > 全局 `getSlots()`），`CFG.cardSlots` 退成"初始值兼下限"、`CFG.cardSlotsMax: 10` 是上限，而 test1 因为 `conveyor: true` 根本不进选卡；「运行」段（README.md:13、:16、:37）的 `clears.js` 已改名 `progress.js`、单键 `apollo7s:cleared` 已换成 `apollo7s:progress`（内容 `{ cleared, slots }`），README.md:73 那句"三种开局"也要按 `conveyor` / `deckSelect: false` 补第四种（传送带）

## v0.1.80（2026-10-27）
- 按你「将Last与SecondLast初始值改为0」：`CFG.wave.rowInit` `2 → 0`（game.js:19），代码只改这一个字面量
- **四个引用点一次改完**：`makeRun`（game.js:118-119）与 `resetRun`（scenes/test.js:581-582）都是 `Array(CFG.rows).fill(CFG.wave.rowInit)`，所以 `state.rowLast` / `state.rowSecondLast` 的起表值全走这个常数，没有第二处硬编码；`rowWeight`（test.js:369）与 `spawnMonster`（test.js:352）里的计数器推进逻辑一字未动
- **之所以现在可以为 0**：`rowInit: 2` 当初是为了绕开"五行权重同时归零"的退化（正权重需要 `6L + S + 7 > 4 × 行数`，5 行时 `7×2 = 14 > 13` 刚好越线）。你前一步把 `rowWeight` 的下限从 `Math.max(pl + psl, 0)` 提成了 `0.01`，于是任何行最差也是 `0.2 × 0.01 = 0.002`，起手全 0 不再产生零权重 —— 实测连续 50 万只里五行权重总和的最小值是 `0.0100`（起表 2 时是 `0.0500`），`pickRow` 的归零分支不可达。**这条依赖是双向的：若把下限改回 `0`，起表 0 会让第 1 只重新撞上那个退化。**
- **改动只作用于开局**（10 万局 × 每局前 10 只实测，起表 0 → 起表 2 的对照）：开局相邻两只同行的概率 `20.00% → 0.22%`；逐只回落为第 2、3 只 `20.0%`（这两只五行权重全等，所以是纯随机）→ 第 4 只 `17.9%` → `13.3%` → `9.3%` → `7.2%` → `5.3%` → 第 10 只 `2.2%`；前 10 只平均覆盖 `4.46 → 4.99` 行、覆盖满 5 行的局 `45.1% → 98.4%`；最长连击均值 `1.458 → 1.002`，出现过至少一次连续同行的局 `61.0% → 0.2%`
- **稳态不变**：连续 50 万只不重开时两种起表的同行率都是 `0.47%`，即公式在大约第 13–15 只之后收敛回原样，中后期出怪与改动前无差别；`起表 1` 与 `起表 0` 同形（`20.04%` / 覆盖 `4.45` 行），说明门槛就是原来的 `≥ 2`
- **未动**：`SAVE_KEYS` 仍含 `rowLast` / `rowSecondLast`，存档里存的是当时的计数器实际值，所以读档回来的局按存档恢复、不受本次起表改动影响（旧档按你的规矩直接丢弃，不做迁移）；`div / cap / bigEvery / bigMul / bigSeed / first / gapMin / gapMax / bigGap / hpCut / cutGap / bigCutGap / bigWarnGap / armor1Weight / armor2Weight` 与 `rowWeight` 里的 `0.01`、`1` 两个字面量全部照旧
- **README 滞后（未改，等你指令）**：README.md:74 那句「出怪行按"上上波 / 上波"的行计数加权，避免连续堆同一行（`rowInit` 是这两个计数器的初值，**必须播种，否则权重恒为 0**）」现在两处失真——值已经是 `0`，而"必须播种"的理由也被权重下限顶掉了，现在的说法应该是"起表决定公式从第几只开始生效"

## v0.1.79（2026-10-27）
- 按你「查看更新记录，修改一下README，然后push」——纯文档轮，**代码一行没动**。把 v0.1.71 起各轮在 `README.md 未改` 段落里挂账的滞后清单一次性收干净（v0.1.71 的七处 + v0.1.72–v0.1.78 各轮补记的五处），改的是 `README.md` 一个文件
- **新增/重写的段落**：①「运行」的载入顺序补上 `clears.js`（`save.js` 之后、`game.js` 之前，因为它调 `cacheRead` / `cacheWrite`），并单列一条讲 `apollo7s:cleared` 这把**单键**通关记录（领取首通那刻直接写盘、不嵌在关卡存档里、不随导入导出、不受 `resetRun()` 影响、只认 `=== true`）；②「操作」表新增"点击地上的奖励"一行，`出怪` 那行补上新出现的连带——末波了结时若还留着跌破不了 `threshold` 的手动怪，奖励压着不掉；③目录结构补 `clears.js` 与 `images/others/moneybag.png`，`info/info.js` 的清单加"防具 / 奖励"、`scenes/test.js` 的清单加"奖励与结算演出"；④玩法循环新插入**奖励 / 奖励的掉落与拾取 / 领取与结算演出**三条（`INFO.rewards` 只有 `name / img / scale / milk` 且**无 `id`**、`milk` 归"能力开关"所以不爆奶的奖励整行不写；`rewardKey()` = `firstReward` 非 `null` 且未通关 ? 用它 : `CFG.reward.defaultKey`；`rewardCheck` 先整批删垂死怪（不进 `state.deaths`、不掉防具）再从最右那只头顶抛、无源点用 `CFG.reward.rest`、抛物线复用 `arcPoint` / `stepArc` 与 `CFG.milk.arc`、`hitPad` 放宽且空中就能点；领取顺序＝标记首通→收存量未起飞的奶→按 `milk / INFO.milk.value` 爆 10 颗→停 `burst.hold` 才起飞→建 ceremony 并停 BGM；演出 `dur 5 / fly 3 / white 2 / scaleTo 3`、`resetRun() → writeRun()` 回菜单；`state.reward` 或演出期间自然掉奶与 `produce` 一起停产；`reward` 进 `SAVE_KEYS` 而 `ceremony` 不进，读档时非法字段整份丢成 `null`、在飞的弧线就地结算）；⑤「胜负」条改成**只剩判负**（`state.result` 只有 `'lose'`，末波打完走奖励与演出而不是胜利面板），进度条那句原样保留
- **改掉的错**：`运行` 段那句"两个开关（`opts`）不进存档"是旧数，`OPTS` 现在四条 ⇒ 写成四个并列出名字；「波次」那句"本波总级别既不会超出预算、也不会差零头"从 v0.1.75 起对末波不成立 ⇒ 改成"除末波保底之外…"，并把两段保底补齐（末波每种各一只**可超预算** > 大波补 `min(unit, budget - sum)` 只 `CFG.wave.bigSeed` **受预算截断** > 加权补怪，`unit` 复用同一式子、没有第二套公式；`bigSeed` 是写死的 key、不受本关 `spawnTable` 约束；那个 `min` 比的是只数 vs 剩余额度，只在 `bigSeed` 是 `level: 1` 时才等价于级别不超；两段刷出来的怪逐只累进 `state.waveHp` 分母）；「牛奶」补 `CFG.milk.halo`；`加一关` 的"上面那九项"改成十项；`改数值` 新增第 4 条"加一枚奖励"（原 CFG 那条顺移成第 5）并在 CFG 清单里补 `bigSeed` / `CFG.reward` / `CFG.milk.halo`
- **数值全部回代码取真值**（不信日志）：`CFG.milk.halo` 写 v0.1.78 之后的 `0.7 / 0.30`、`burst.hold 0.2`（v0.1.73）、`cer.fly 3`（v0.1.74）、`test1.waves 10`（v0.1.72 ⇒ 它的第 10 波同时是唯一的大波兼末波，就拿这个当两段保底优先级的例子）、保底顺序按 v0.1.77 对调后的现状、`INFO.milk.value 25` 与 `moneybag.milk 250` 推 10 颗、`index.html` 的六个 `<script>` 顺序、`clears.js` / `test.js` / `save.js` / `game.js` 里 `rewardKey` / `stopped` / 四处输入屏蔽 / `applyRunText` 的归一化各读取点
- **约定段**：`firstReward` 进"默认无也要明写 `null`"那一档（与 `bgm` / `startMilk` / `armor1` / `armor2` 同口径），奖励的 `milk` 进"能力开关"那一档；`> 二类防具还差一个字段` 那条**原样没动**——`armors` 至今没有 `hitbox`、也没有怪物挂 `armor2`，所以"要不要补 `hitbox`"仍然挂着等你发话；「已知未完成」新增一条"首通奖励的分岔还没实测"（两关 `firstReward` 都是 `null`，`rewardKey()` 的未通关分支与不带 `milk` 的奖励都只在沙箱里跑过，`apollo7s:cleared` 也没有任何查看入口）
- 未动：`update_7sRef.md`（文档对账不是玩家可感的改动）；`index.html`、`game.js`、`save.js`、`clears.js`、`info/info.js`、`scenes/test.js` 一字未改
- **push 说明**：这次提交把并行会话 v0.1.71–v0.1.78 的工作区改动一起带上（含两个此前未跟踪的文件 `clears.js` 与 `images/others/moneybag.png` —— 少了 `clears.js` 线上会 404 且启动直接断），推 `main` 等于给 Pages 发新版
- 验证：`git status --short` 与逐文件 diff 复查无凭据类内容；本轮没有改动 js，语法检查沿用各轮自己的 `vm.Script` 结论

## v0.1.78（2026-10-27）
- 按你「将 milk 的光晕加深一点」——`CFG.milk.halo.alpha 0.22 → 0.30`（game.js:35）。只动浓度这一个数：`radius 0.7`、`color '255,255,255'` 未改（"加深"不是"变大"，范围保持 v0.1.75 定的那圈）
- 读取点唯一：牛奶渲染循环 test.js:1515 的 `CFG.milk.halo`，它只喂给光晕那圈渐变的第一个色停，所以改动不外溢到牛奶本体、影子或判定
- 参照：伙伴产奶前的金光 `alpha 0.8`、钱袋金光 `0.55` ⇒ 现在这圈白光在两者之下、比上一版明显一点。还想再深就直接调这一个数
- 快速模式下的过期淡出不受影响（淡出走 `ctx.globalAlpha`，与这圈的 `hl.alpha` 相乘）
- `game.js` 过 `vm.Script`；观感由你实测
- `update_7sRef.md` 双写：顶部新开 `## 2026-10-27 · 牛奶光晕加深`；v0.1.75 那节"小而淡"的描述留作历史
- `README.md` 未改（滞后清单不变，仍是五处）

---

## v0.1.77（2026-10-27）
- 按你「更改顺序，最后一波时先刷新每种各一只，再刷新固定 n 只（受出怪量约束）」——`spawnWave`（test.js:417）里两段保底**整体对调**：`if (state.wave === lv.waves)` 的每种一只在前，`if (isBigWave(state.wave))` 的固定 n 只在后，`while` 仍在最后。两段内部一字未改（`seed = Math.min(unit, budget - sum)`、`sum += level`、`state.waveHp += monWaveHp(m)` 都是原样搬动），`CFG.wave.bigSeed` 与其余常数没碰
- **语义变化只发生在"既是大波又是末波"的那一波**：固定 n 只现在排在末波保底之后，于是它受的是**扣掉保底之后**的剩余额度约束；末波保底（可超预算）一旦把 `sum` 抬过 `budget`，`Math.min(unit, budget - sum)` 就是负数，`for` 一次不进 ⇒ **这一波的大波保底完全不刷**。优先级从此是：末波保底 > 大波固定 n 只 > 加权补怪
- **沙箱实测**（真 `spawnWave` + 真数据，4000 次）：
  - 非末波的波次逐字不变：场景2 第 10 波仍是企鹅 4~10 / 只数 6~10 / 级别 10，第 20 波 8~16 / 11~17 / 18，第 29 波与上一版同分布（只数 2~8、覆盖 1563/4000）——这些波末波段根本不进，对调无影响
  - 场景2 第 30 波（大波+末波，额度 20，n=8）：只数 13~16、企鹅 10~14、总级别恒为 20、三种各至少一只仍 100% ⇒ **与 v0.1.76 的分布相同**（保底和 7 没吃掉 8 只企鹅的额度，`min(8, 20-7)` 仍是 8），改的只是出怪数组里的先后（现在开头三只是 `chunipenguin, chunipenguin_prs, chunipenguin_ftr`）与行计数器的推进顺序
  - 场景1 第 10 波（大波+末波，额度 10）：仍是 10 只、级别 10，无变化
  - 差别被放大的验证：临时 `test1.spawnMul = 0.3`（额度 3）时，末波保底先花掉 1+2+4=7 ⇒ 大波段**一只都不补**，该波总只数 **3 只 / 级别 7**；换成 v0.1.76 的旧顺序则是 6 只 / 级别 10。所以"受出怪量约束"现在是真的会让位于末波保底
- `scenes/test.js` 过 `vm.Script`；未开浏览器，末波构成由你实测
- `update_7sRef.md` 双写：顶部新开 `## 2026-10-27 · 末波保底优先于大波保底`；v0.1.76 那节写的"先刷 n 只再每种一只"留作历史
- `README.md` 未改（滞后清单不变，仍是 v0.1.76 末尾列的那五处）

---

## v0.1.76（2026-10-27）
- 按你「大波时必定先刷新 n=min(ceil(波次/3),8) 只中二企鹅（普通），再进 while 抽其他怪；这条刷新会被出怪量限制」
- **新常数 `CFG.wave.bigSeed: 'chunipenguin'`**（game.js:19，紧跟 `bigMul`）——大波保底刷的那只怪的 key，你要换成别的怪只改这里
- **`spawnWave`（test.js:417）**：在 `budget = Math.ceil(...)` 之后、v0.1.75 那段末波保底之前插入 `if (isBigWave(state.wave))` 的刷怪段，`seed = Math.min(unit, budget - sum)` 只 `bigSeed`，每只同样 `sum += level`、`state.waveHp += monWaveHp(m)`，然后才轮到末波保底段与原来的 `while`。**`n` 直接复用现成的 `unit`**（`unit = Math.min(Math.ceil(state.wave / CFG.wave.div), CFG.wave.cap)` 就是你写的式子，`div 3 / cap 8`，没有新增第二套公式）
- **"会被出怪量限制"落成 `Math.min(unit, budget - sum)`**：与末波保底那条"可以突破预算"形成对照，这里超了就截。沙箱验证截断真的生效：把 `test1.spawnMul` 临时压到 0.3 时预算=3 而 `unit`=4 ⇒ 只刷 3 只（第 4 只普通企鹅是末波保底补的，因为那条允许超）。口径上这个 `min` 比的是**只数 vs 剩余额度**，只有在 `bigSeed` 是 `level: 1` 时才等价于"级别不超"；将来把 `bigSeed` 换成 2 级怪，这批保底自己就能超预算（沙箱里 budget 3、级别和 14），到时候要么改成按 `Math.floor((budget - sum) / level)` 截，要么由你确认——现在没写，因为你点的是普通企鹅
- **两段保底的先后**：大波段在前、末波段在后（你那句"必定先刷新……再进 while"），所以某一波既是大波又是末波时（场景1 第 10 波、场景2 第 30 波）顺序是 n 只普通企鹅 → 出怪表每种各一只 → 加权补满。副作用：普通企鹅会被两段各算一次，末波保底那一只并不因为前面已经刷过企鹅就省掉
- **沙箱实测**（真 `CFG.wave` + 真 `INFO` + 真 `spawnWave/pickMonster/pickRow/spawnMonster/monWaveHp`，新旧代码各 4000 次抽样）：
  - 场景2 第 10 波（大波，额度 10，`unit` 4）：企鹅只数 **0~10 → 4~10**（至少 4 只成为必然），该波总级别仍恒为 10，只数 3~10 → 6~10
  - 第 20 波（大波，额度 18，`unit` 7）：企鹅 **0~12 → 8~16**，总级别仍 18，只数 5~15 → 11~17
  - 第 30 波（大波 + 末波，额度 20，`unit` 8 撞 `cap`）：企鹅 **2~10 → 10~14**，只数 7~14 → 13~16，总级别仍 20，三种怪各至少一只仍 100%
  - 非大波（第 5/9/11/29 波）新旧分布逐字一致 ⇒ 闸门只管大波
  - 场景1 全程无变化（出怪表只有普通企鹅 1 级，保底与抽出来的是同一种），第 10 波仍是 10 只 / 总级别 10
  - 连带代价：额度先被企鹅占掉 `unit` 级，其他怪在**大波**露面的概率下降——第 10 波"三种都露面"从 50.0% → 25.4%，第 20 波从 87.5% → 76.5%
- 注意 `bigSeed` **不受本关 `spawnTable` 约束**：写死的是怪物 key，所以将来哪一关的出怪表里没有普通企鹅，它的大波照样会冒出普通企鹅（当前两关都列了它，所以现在看不出差别）。要改成"只刷本关表里有的"是另一件事，没擅自动
- 波次血量/催波分母 `state.waveHp` 把保底刷出来的每只一起累加，与分子同式，没有新口径；`isBigWave` 的判定与横幅时机未动
- `game.js / scenes/test.js` 过 `vm.Script`；未开浏览器，构成由你实测
- `update_7sRef.md` 双写：顶部新开 `## 2026-10-27 · 大波先刷一批普通企鹅`
- `README.md` 未改，本轮新增一处滞后（连同 v0.1.75 的两处、v0.1.71 的三处一起等你下令）：:71 波次段完全没提"大波先刷 n 只普通企鹅"和"末波每种至少一只、可超预算"这两条新保底

---

## v0.1.75（2026-10-27）
本轮两个点名项，一处数据 + 一处绘制 + 一处出怪逻辑。

**1. 牛奶加白色光晕**
- `CFG.milk` 新增 `halo: { radius: 0.7, alpha: 0.22, color: '255,255,255' }`（game.js:35，跟在 `arc` 之后）。口径与 `CFG.glow`（伙伴产奶前的金光 `radius 0.8 / alpha 0.8`）、`CFG.reward.halo`（钱袋金光 `1.1 / 0.55`）对齐，所以"比较小、比较淡"落成这两个数，你觉得刺眼就直接调 `radius / alpha`
- 绘制只改一处：牛奶渲染循环（test.js:1503-1518）在 `drawImage(imgs.milk …)` 之前用 `createRadialGradient` 铺一圈 `rad = max(ms.w, ms.h) × halo.radius` 的圆，色停与 `drawReward`（:1215）完全同式。因为画在同一个 `ctx.globalAlpha` 里，**光晕跟着牛奶一起淡出**（临过期那 `CFG.milk.fade` 秒）而不是一块不透明的白
- **覆盖范围 = `state.milks` 里的全部**，即自然掉落 `spawnMilk`、咪璐库 `produceMilk`、以及钱袋爆出的那 10 颗（三者本来就是同一个数组、同一处绘制）；要在空中停顿阶段不留光就得给爆出的奶单独加标记，未做，等你下令。**金牛奶 `state.gmilks` 没动**（另一条循环 :1488、另一种机制）
- 点击判定、`hitPad`、下落、`arc`、20 秒过期、自动收集一概未动 —— 光晕是纯绘制，不进 `milkHit`

**2. 最后一波保证每种怪至少一只，且可突破预算**
- `spawnWave`（test.js:417）在 `budget = Math.ceil(...)` 之后、`while (sum < budget)` 之前插入：`if (state.wave === lv.waves)` 时先按 `lv.spawnTable` 的顺序每种各刷一只（走同一个 `pickRow()` + `spawnMonster(pickRow(), key, state.wave)`，并把 `level` 累进 `sum`、`monWaveHp(m)` 累进 `state.waveHp`），然后才让原来的补怪循环继续 —— 保底把 `sum` 抬过预算时 `while` 一次都不进，正是"突破出怪量的限制"
- 判据用现成的 `state.wave === lv.waves`，与 `lastWaveSettled()`（:470）和"最后攻势"横幅同一条件；非末波代码路径一字未动
- **沙箱实测**（把真实 `CFG.wave` + `INFO` + 真的 `spawnWave/pickMonster/pickRow/spawnMonster/monWaveHp` 塞进 vm 跑，新旧代码各 4000 次抽样对照）：
  - 你举的例子原样复现：表 `{1,5,10}`、第 10 波预算 10 ⇒ **恰好 3 只、总级别 16、之后不补**（旧代码这里必然补到 20 级别）
  - 更极端的：`spawnMul 0.5` 时预算 2、保底和 7 ⇒ 仍 3 只、总级别 7（超预算 3.5 倍），且**不会触发"过滤表为空 ⇒ `pickMonster` 抽不到东西"那条崩溃路径**（`while` 根本不进）
  - 测试场景1 最后一波：改动前后都是 10 只、总级别 10（表里只有 1 种 1 级怪，保底那只本来就会出）
  - 测试场景2 最后一波（第 30 波，预算 20，表 `1/2/4`）：总级别仍恒为 **20**（保底和 7 < 20，没超），但只数从 **5~16 收到 7~12**，三种怪各至少一只的概率 **91.1% → 100%**
  - 非末波（第 29 波覆盖 1570/4000 vs 旧 1563/4000、第 5 波 0/4000 两边都一样）分布相同 ⇒ 确认闸门只管末波
- 连带：末波的 `state.waveHp`（催波分母，`waveCutCheck` :449）把保底多出来的级别一起算进去，所以真出现超预算时，这一波要打掉更多东西才会提前催波 —— 分母与分子仍是同一式子，没有新口径
- `game.js / scenes/test.js / info/info.js` 三个文件都过 `vm.Script`；未开浏览器，观感与末波构成由你实测
- `update_7sRef.md` 双写：顶部新开 `## 2026-10-27 · 牛奶光晕 + 最后一波全员保底`
- `README.md` 未改，新增两处滞后（连上轮三处一起等你下令再动）：:71 "本波总级别既不会超出预算、也不会差零头"现在对最后一波不成立（保底可超）；:72 牛奶那段没提 `CFG.milk.halo`

---

## v0.1.74（2026-10-27）
- 按你「将点击奖励后飞向屏幕中心的时间拉长到 3s」——`CFG.reward.cer.fly 0.8 → 3`（game.js:28）。同条里的 `dur 5`（演出总时长）、`white 2`、`scaleTo 3`、`glowFrom/glowTo/glowAlpha/color` 一字未动
- `fly` 全项目只有 `drawCeremony`（test.js:1227 `k = smooth(min(1, c.t / ce.fly))`）一个读取点，钱袋从掉落点插值到 `(CFG.W/2, CFG.H/2)` ⇒ 到位时刻 `0.8 秒 → 3.0 秒`，位移走的是现成的 `smooth()` 缓动，没有新常数
- **连带后果（只讲时间，没动代码）**：白幕仍从 `dur - white = 3 秒` 起涨，所以"停在屏幕中央等白幕"这段从 **2.2 秒 → 0 秒**，钱袋到位的那一帧正好是白幕开始的那一帧。放大与光晕都由 `u = t / dur` 驱动，节奏没变 ⇒ 到位时（u=0.6）缩放已经是 `1 + (3-1)×0.6 = 2.2 倍`，而旧值到位时才 1.32 倍，看起来是"飞到中间时已经很大了"。快速模式（`dt = raw × 2`）下飞行实际 1.5 秒、整段演出实际 2.5 秒，与改动前一样是折半
- 想把"停在中央"的窗口留住的话，动 `cer.dur`（例如 `5 → 7.2`，白幕会自动推到 5.2 秒起）；这是另一个数，本轮没碰，等你下令
- `game.js` 过 `vm.Script`；未开浏览器，观感由你实测
- `update_7sRef.md` 双写：顶部新开 `## 2026-10-27 · 结算飞行拉长到 3 秒`；v0.1.71 那节写的"约 5 秒""飞到屏幕正中"留作历史
- `README.md` 未改（`cer` 的具体秒数它没写过；它滞后的仍是 v0.1.71 的三处：:13 载入顺序缺 `clears.js`、:34 文件表缺该文件、:74 的"判胜"表述）

---

## v0.1.73（2026-10-27）
- 按你「将爆出牛奶后的停顿时间改为 0.2s」——`CFG.reward.burst.hold 0.5 → 0.2`（game.js:27）。同一条里的 `dur 0.2`（散开抛物线时长）与 `radius 130` 未动，`cer/arc/hitPad` 等一概没碰
- 读取点唯一：`burstReward`（test.js:142）把 `b.hold` 写进每颗新爆出的奶，`updateGame` 的 `if (k.hold !== undefined)` 分支（:1862-1865）数完当帧 `collectMilk(k)` 起飞。`grep` 到的另外两处 `b.hold`（:1595 特效、:1959 横幅）各自属于 `state.effects` / `state.banners`，与奖励无关，没被这次改动波及
- 可观测节奏（点击钱袋 ⇒ 10 颗奶开始飞向计数器）：弧线 `dur 0.2` + 空中停 `hold 0.5` = **0.7 秒 → 0.4 秒**；奶在进入 `hold` 分支的同一帧就 `state.milk += INFO.milk.value`，所以到账时刻也跟着提前 0.3 秒。计数器旁的 `CFG.milk.flyWait 0.2` 是"飞到之后停一下再消失"，不是起飞前的等待，未动
- 计时走 `dt = raw * (opts.fast ? 2 : 1)`（test.js:1813）⇒ 快速模式下这 0.2 秒实际是 0.1 秒
- `update_7sRef.md` 双写：顶部新开 `## 2026-10-27 · 钱袋爆奶的空中停顿缩短`；v0.1.71 那节里"悬停约 0.7 秒"的旧数值按你的惯例留作历史
- `README.md` 未改（本轮没动它的任何口径，它目前滞后的仍是 v0.1.71 的三处：:13 载入顺序缺 `clears.js`、:34 文件表缺该文件、:74 的"判胜"表述）

---

## v0.1.72（2026-10-27）
- 按你「场景1 改为 10 波次」——`INFO.tracklist.test1.waves 20 → 10`（info.js:215），**其他任何数值未动**（`spawnMul 1`、`startMilk 50`、`spawnTable` 仍只有 `chunipenguin`、`showMonsters/deckSelect` 照旧；test2 仍 30 波）。这正是 v0.1.71 交付回复里挂起待令的那条，现在按令执行
- `waves` 全项目只有 6 个读取点，逐条连带（用真实 `CFG.wave` 值算的，非估算）：
  - `isBigWave`（test.js:408 `w % bigEvery(10) === 0 || w === waves`）⇒ **第 10 波同时是大波与最后一波**，大波次数 `2（第10、20波）→ 1（第10波）`
  - `spawnWave`（:427-431）预算 `unit = min(ceil(w/div 3), cap 8)` × `spawnMul 1` ×（大波则 `bigMul 2.5`）后取 `ceil` ⇒ 各波只数 **1,1,1,2,2,2,3,3,3,10**（旧 20 波为 …,10,…,7,18），全关总出怪 **94 → 28 只**；末波仍先挂"一大波敌人正在靠近"（`bigWarnGap 7000`）再挂"最后攻势"
  - 波间隔（`randWaveGap` :433-436）：`first 19000` + 8 段 `gapMin~gapMax 25000~31000` + 1 段 `bigGap 52000` ⇒ 名义总时长 **548~650 秒 → 271~319 秒**（催波 `hpCut 0.65`/`cutGap`/`bigCutGap` 规则未变，实际会更短）
  - 右下角进度条（:1568 `pct`、:1577 `total`）分母变 10；评级图标枚数 = 大波次数 ⇒ **2 枚 → 1 枚**
  - 自然出怪闸门（:1818 `state.wave < lv.waves`）与 `lastWaveSettled`（:466 `state.wave === lv.waves`）
- **旧档的可观测后果（按你「旧的存档先丢弃」的惯例，我没写任何兼容代码）**：test1 若已存到 `wave 11~20`，回来时 `state.wave < 10` 为假 ⇒ 不再出任何怪；而 `state.wave === 10` 为假 ⇒ `lastWaveSettled()` 永远不成立、奖励永远不掉，进度条靠 `Math.min(1, …)` 停在满格。想清掉：本关菜单里「重新开始」（走 `resetRun()`，`wave` 归 0），或直接删 localStorage 键 `apollo7s:save:test1`
- 数据文件通过 `vm.Script` 求值复核：`test1.waves = 10 / test2.waves = 30`；未开浏览器，节奏由你实测
- `README.md` 未改（`tracklist` 段里若写着 test1 的波次数需跟着改；本轮没动它是因为你没下令）
- `update_7sRef.md` 双写：顶部新开 `## 2026-10-27 · 场景1 缩到 10 波`

---

## v0.1.71（2026-10-27）
- 按交付说明「关卡首通奖励 + 结算演出（第 3 号需求）」一次实现；写前现读 `head -6 update.md`，头名是 **v0.1.70**（另一会话的 README 校对轮），本次落 **v0.1.71**
- **数据 `info/info.js`**：`INFO.rewards` 新增于 :201（紧跟 `armors`，按 key 寻址、条目**不带 id**）——`moneybag: { name '钱袋', img 'images/others/moneybag.png', scale 1.00, milk 250 }`；`milk` 是能力开关型字段（无该效果的奖励行整行不写，与 `produce/burst/bullet` 同口径）。两关各加 `firstReward: null`（:216 / :228，默认无也明写）
- **`CFG.reward`（game.js:22-29）**：`defaultKey 'moneybag'` / `rest { x: 1024, row: 2, dy: -223.2 }` / `hitPad 55` / `halo { radius 1.1, alpha 0.55, color '255,225,120' }` / `burst { dur 0.2, hold 0.5, radius 130 }` / `cer { dur 5, fly 0.8, white 2, scaleTo 3, glowFrom 260, glowTo 1180, glowAlpha 0.55, color '255,255,255' }`。尺寸、下落、抛物线全部复用 `CFG.milk`（`size 120`、`arc { dur 0.9, h 150, spread 70 }`），只有点击余量单列。**说明里的 `burst.count: 10` 没落地**：只数由 `milk / INFO.milk.value`（250/25=10）推导，不留两处真值
- 装载与局内字段：game.js:289 补 `...Object.keys(INFO.rewards).map(k => loadImage('rew_' + k, ...))`；`makeRun` 加 `reward: null, ceremony: null`（:97-98）
- **新文件 `clears.js`**：单键 `apollo7s:cleared`（不是每关一键，也不进 run 快照，因为 `resetRun()` 会覆盖），`initClears / isCleared / markCleared`，只认 `=== true`，脏数据一律当"没通过"、不抛错。`index.html:29` 插在 `save.js` 之后、`game.js` 之前
- **存档**：`SAVE_KEYS` 末尾加 `'reward'`（save.js:2）；`applyRunText` 在拷贝循环后归一化（:54-58）——`reward` 缺失 / key 不在 `INFO.rewards` / x、y 非数字 ⇒ 整份丢弃为 `null`，丢弃后由每帧的 `rewardCheck()` 幂等补掉一次；另外把还在飞的 `arc` 就地结算（x、y 取 `tx/ty` 后置 `arc = null`），读档既不重播抛物线、也不会悬在半空。`ceremony` **不进** `SAVE_KEYS`；`hasRunRecord`（test.js:440）未动，`clock > 0` 已能让"奖励还在地上"的存档弹继续/重开面板
- **触发**：`resultCheck`（test.js:456）里 `state.result = 'win'` 那行删除，条件原样搬进 `lastWaveSettled`（:464）；新增 `rewardCheck`（:469），调用顺序 `resultCheck()` → `rewardCheck()`（:2044-2045）保证判负优先
- **与说明的两处偏离（都先在沙箱证明过，不是顺手改）**：
  1. `rewardCheck` 的扫怪条件从说明的 `state.monsters.length > dying.length` 改成 `dying.length > 0`。原式在"场上全是临界值以下的怪"时不清场，于是 `state.monsters.length > 0` 直接 return ⇒ `dying` 永远为空 ⇒ `src` 永远 `null`，"从被扫掉的怪头顶抛出"这条主路径**不可达**，与说明自己 §4.1 的"清理无条件执行"矛盾。改后行为：最后一波了结时，临界值以下的怪一律删除（不进 `state.deaths`、不掉防具、不画影子），场上若还剩临界值以上的怪（含手动 `出怪` 的）就先不掉
  2. `testClick` 的 `if (state.ceremony) return;` 放在**判负面板分支之后**（:1677）而不是紧跟 `state.loading`。原位置会卡死：演出途中被判负时 `updateGame` 停摆（ceremony 冻在白幕中途），而 `state.result` 面板的按钮也被这句 return 挡住、点不动。配套加了 game.js:154 `slot.ceremony = null`（`enterRun`）——演出既不进存档，也不该在内存里被"继续本关"带回
- **掉落 / 拾取**：`rewardSize`（:84，`CFG.milk.size × scale` ⇒ 127.72×120，宽按 182×171 源图比例）；`spawnReward`（:96）与 `produceMilk` 同式——源点取被扫怪**贴图头顶**（直接用现成 `monsterBox` 的上沿，不再引入 `monSpriteH`），无源点时用 `CFG.reward.rest`；落点 `feetLine(row) - s.h/2`，`tx` 的 clamp 区间与奶完全相同；`rewardHit`（:111）判定框 = 尺寸 + `hitPad × 2`，弧线飞行途中也算命中；`pickupReward`（:119）顺序＝标记首通 → 先收场上存量奶 → 再 `burstReward`（反过来的话新炸的 10 颗会被紧随其后的 `if (!k.fly) collectMilk(k)` 立刻收走，"停在半空 0.5s"就没了）→ 建 `ceremony` → `bgm.pause()`
- **共用抛物线**：抽出 `arcPoint`（:65）与 `stepArc`（:69），奶与奖励都走它（说明推荐的做法，没有复制两套）；奶的落点、`stopped`、淡出与 20s 过滤一字未改，`state.reward` 不在 `state.milks` 里 ⇒ 永不过期、`autoCollect` 也碰不到它（:28/:62/:1589 三处清扫均未扩展）
- **钱袋爆奶**：`burstReward`（:130）沿上半圆弧铺 10 颗（`th ∈ (0, π)`、半径 130、`h: 0` ⇒ 那条抛物线退化成纯径向直线），`dur 0.2 + hold 0.5 = 0.7s` 后才开始飞计数器；奶循环新增 `hold` 分支（:1862-1865），优先于普通落地态；`collectMilk` 原样复用，10 颗 ⇒ +250
- **停产闸门**：`const stopped = !!(state.reward || state.ceremony)`（:1817），门控自然掉落（:1825）与咪璐库生产（:1921，`p.prodT` 就此冻住）；`resetRun()` 清 `reward/ceremony` ⇒ 下一局自动恢复
- **演出**：`drawReward`（:1208，先径向金光圈后贴图，常亮不脉动）与 `drawCeremony`（:1223，`fly 0.8s` 用现成 `smooth` 飞到 `(1024, 576)` 后不再移动；`k = 1 + (scaleTo-1) × u` 全程线性放大到 3 倍；白光单圈渐变 260→1180，末帧刚盖到四角 √(1024²+576²)≈1175.9；最后 2s 全屏白 `clamp((t-3)/2)` 涨到 1.0，画在本层最上）插在横幅/入场 mark 之后、菜单面板之前（:1603-1604），判负面板仍在更后 ⇒ 压在白幕之上；`t >= CFG.reward.cer.dur` 时 `resetRun() → writeRun() → scene='menu'`（:2046-2052，落盘是干净新局，与"重新开始"同口径）。**世界不冻结**：loop 的 gate（game.js:260）没加 `ceremony`，计时用游戏时钟 ⇒ 快速模式整段 2.5s 真实时间
- **输入屏蔽**：`testHover`（:1640 开头 return，光标 default）、`testClick`（:1677）、`testKey`（:1795 gate 补 `state.ceremony`）、`contextmenu`（game.js:246，`preventDefault` 之后）
- **移除胜利提示框**：`uiRects` 删 `winBack`；面板文案固定 `'失败'`，只画 `loseBack / loseRetry`；`testHover`、`testClick` 的 `=== 'win' ?` 三元去掉，两支失败按钮逻辑原样；`state.result` 从此只有 `'lose'`；loop 与 `testKey` 的 `state.result` gate 保留
- 自检（node-repl 的 vm 沙箱里跑**真实函数**，非另写一份）：`rewardSize` 127.72×120；`spawnReward(src@row2,x=1000)` 源点 y=522.80、落点 (987.07, 686.00)、`arc` 归 null（90 步 × 0.01s = 0.9s）；`spawnReward(null)` = (1024, 522.8)；clamp 区间 [251.86, 1924.14]；混合场（2 垂死 + 1 手动健康）⇒ 垂死的当帧消失且 `deaths`/`drops` 均为 0、不掉奖励；全场皆垂死 ⇒ `src` 取最右那只（x=1200、row 4 头顶 894.80、落点 1058）；`state.result` 存在时 `rewardCheck` 连怪都不删；拾取瞬间 milk 50→75（存量那颗）、炸奶在 **0.70s** 一次 +250、合计 325、`milkShown` 同步 325、奶数组最终清空；`clears` 落盘 `{"test1":true}`；临时塞一颗无 `milk` 字段的假奖励验证解锁型路径 ⇒ 不炸奶、奶量不变、仍标记首通；六个 JS 文件（含新增 `clears.js`）全过 `vm.Script`；未开浏览器，效果由你验
- **没做的一条**：说明 §10 提到"test1 改 10 波的连带（已确认接受）… 除 `waves: 20 → 10` 外不动其他数值"，但 §1–§8 的需求清单里没有这一条，当前数据仍是 `waves: 20`，故**未改**；要改请下令
- `README.md` 未改（本轮之后新增：`INFO.rewards`、`tracklist.firstReward`、`CFG.reward`、`clears.js` 与载入顺序、存档新增 `reward` 键、"胜负"一段应改成"掉奖励 + 演出结算"、操作表新增"点击奖励领取"）
- `update_7sRef.md` 双写：顶部新开 `## 2026-10-27 · 关卡首通奖励与结算演出`

---

## v0.1.70（2026-10-27）
- 按你「对 README 做一次检查和修正，然后 push 项目」——纯文档轮，**代码一行没动**。README 上次整体校对是 v0.1.52，之后 v0.1.53–v0.1.69 的改动没回填过，这次逐条对着 `info/info.js`、`game.js` 的 `CFG`、`scenes/test.js` 重读一遍，纠偏 8 处、补全 6 处
- **改掉的错**：①怪物段那句"死亡当帧移除、不留尸体"已经不成立（v0.1.61 起零血量进 `state.deaths` 播倒地），改成"`hp <= 0` 当帧离开 `state.monsters`，所以清场/催波/判负仍等价于数组为空，地上的尸体与残骸不参与任何判定"；②"预算永远是整数**只**"是我 v0.1.57 自己写错的措辞，预算是整数**级别**不是只数 —— test2 混了 1/2/4 级后同样预算出的只数会变少，test1 全 1 级才恰好相等；③`weight / tier / level` 三合一那句里 **`tier` 其实代码完全不读**（全项目 grep 只有数据文件命中），降级成"只是标签"；④"加一只怪"清单还列着怪物的 `flip`，而 v0.1.62 已经把它从怪物数据删掉了（朝向烘进贴图），改成要求"贴图朝左 + 不穿防具也明写 `armor1: null / armor2: null`"；⑤`sounds/` 目录行漏了 `躯樹の墓守.mp3`（场景2 现役曲）；⑥"已知未完成"里"三段式卡没有视觉区分"与代码不符（`emergeRatio` 让未激活只露上半截、出土中升满、已激活全貌），改成"只靠露出多少体现、没有倒计时/高亮这类显式标识"；⑦"怪物受击动画"已经做完（闪白+倒地+防具掉落），从待办里摘掉；⑧催波那句补上分子分母同式 `monWaveHp = hp + a1hp × armor1Weight + a2hp × armor2Weight`
- **补上的机制**：`INFO.armors` 整节（条目只有 `name / hp / img / scale / dx / dy`、**没有 `id`**；当前 `prs` 与 `ftr` 都是 `scale 0.54`、`dx 0`、`dy -193`，图标即 `images/others/difficulty-*.png`）、一类/二类各自的伤害语义（一类吸收并溢出转本体、二类只挡飞向自己的弹且溢出丢弃 + 那发弹的减速失效）、范围伤害 `hurtArea` 让二类与本体各自全额、流血与金牛奶不吃防具、以及"受击与离场演出"一节（`hitFlash 0.05` / `hitAlpha 0.2` / `hitColor #ffffff`；伙伴的闪看"被咬"不看掉血，`immune` 与出土中的 Guy 也闪；倒地整套 `fall+hold+fade = 1.1` 秒、减速时按 `CFG.monster.slow` 倍速 ⇒ 2.2 秒；防具残骸 `0.15+0.5+0.3 = 0.95` 秒；走出左边界与爆炸致死不播倒地，爆炸还会回滚当帧的掉落；倒地与掉落期间不画防具不画影子；`CFG.artPad` 按贴图路径补空白边让脚贴线）
- **顺带查出的一个静默失效点（本轮只记录、没改）**：`armor2Hit` 算的是 `CFG.hitDist * INFO.armors[key].hitbox`，但 `armors` 里 `prs` / `ftr` **都没有 `hitbox` 字段** ⇒ 表达式是 `× undefined = NaN`，比较恒为 `false`。今天没有怪物挂 `armor2`（三只全 `armor2: null`，`ftr` 挂的是一类），这条分支整个跑不到，所以线上没有症状；一旦有人给怪填 `armor2`，二类会"画在身上却一颗子弹都挡不住"且不报错。已写成 README 的 `> 二类防具还差一个字段` 约定（并标注它是全项目唯一一处缺字段静默失效，其余缺字段都直接抛错），**要不要给 `armors` 补 `hitbox` 等你发话**，我没自己加
- 也补了 `> 约定` 那条显式字段清单：`armor1 / armor2` 归入"默认无也要明写 `null`"的一档（跟 `bgm` / `startMilk` 同一口径）
- 未动：`update_7sRef.md`（README 校对不是玩家可感的改动）；`index.html`、`scenes/*.js`、`info/info.js`、`game.js`、`save.js` 一字未改
- 验证：README 里每个数字都回到代码取（`monThreshold` 的 `??`、`coolStart` 只对 `slow`/`very slow` 生效、`viewX` 视线开火、`immune` 与 `armPhase !== 1` 的啃食豁免、`spawnTable[0]` 手动出怪、`LS_PREFIX = 'apollo7s:save:'`、7 张卡 vs 6 个卡槽）；怪物与防具数据在本轮最后一次重读确认仍是 id 101/103/105、`level` 1/2/4、无 `level: 0` ⇒ 上一版的 `level` 约定仍然成立，README 那段不用改

## v0.1.69（2026-10-27）
- 按你「中二企鹅-ftr 阶数改为 1」——一条数据改动，代码零改动
- `INFO.monsters.chunipenguin_ftr` 的 `tier 2 → 1`（info.js:183）。该怪物行其余字段（`id 105`、`level 4`、`weight 3500`、`hp 270`、`armor1 'ftr'`、`threshold 90`、`speedMin/Max`、`atkInterval/Damage`、`img`、`scale 1.20`、`hitbox 0.90`）未动；另两只 `chunipenguin` / `chunipenguin_prs` 的 `tier` 本来是 1，未动
- **实际影响：零。** 全项目检索 `tier` 只有 info.js 的三条赋值，没有任何读取点——出怪分布读的是 `weight`（`pickMonster`，scenes/test.js:312-315 与 :532-533），每波预算的计价单位读的是 `level`（scenes/test.js:338-346）。所以这一改纯粹是把表里的标注对齐，运行时行为、波次、存档都不变
- `README.md` 未改。顺带记一笔它本就写错的地方：`:64` 说「`weight / tier / level` 决定出场分布与每波预算的计价单位」，把 `tier` 也算了进去，实际 `tier` 无任何读取点；`:73` 的加怪清单同样列了 `tier`
- `update_7sRef.md` 双写；`info/info.js` 通过 `vm.Script` 语法检查；未开浏览器，效果由你验证

---

## v0.1.68（2026-10-27）
- 按你「把 ftr 的位置等参数调整为与 prs 相同，二者不同的仅有名字、贴图、hp；将中二企鹅-prs 的 id 改为 103；将中二企鹅-ftr 的 id 改为 105」——三条全在 `info/info.js`，代码零改动
- **防具参数**：`INFO.armors.ftr` 的 `scale 0.63 → 0.54`、`dx -70 → 0`、`dy -90 → -193`（info.js:199）。改后两行逐字段比对只剩 `name`（prs / ftr）、`img`（Present / Future）、`hp`（370 / 1100）三项不同，`scale / dx / dy` 与键顺序完全相同（vm 里跑过差异字段比对）
- 效果：两件现在挂在同一个挂点上（本体中心正上方），ftr 从左手挪到头顶，与"一类 = 头上"的语义对齐。注意 `plantSize` 以**高度**为基准（`h = ch × scale`），所以同 `scale` 下两件高度相同（100.44）、**宽度不同**（prs 121.53 / ftr 107.31，源图宽高比 121×100 与 125×117 不一样）——"参数相同"不等于"占位相同"，要连宽度也齐得改 `scale` 或裁图
- 连带（演出）：`armorDrop` 的起点 `feetLine + dy` 与落点 `feetLine - s.h/2` 现在两件完全相同，落差统一成 **142.78**（旧 ftr 31.41 / prs 142.78），抛物线起抛角也从 `8.9° / 35.5°` 统一成 **35.5°**（`run 90 / push 0.45` 未动）。上一条 v0.1.65 里"ftr 抛不开"的现象随挂点统一自动消失
- **怪物 id**：`chunipenguin_prs` 的 `id 102 → 103`（info.js:161）、`chunipenguin_ftr` 的 `id 103 → 105`（info.js:179）。改后三行是 **101 / 103 / 105**，仍按 id 升序，文件顺序不用动；102 与 104 成为缺号
- id 的实际影响：**零**。全仓只有卡片的 `info.id` 有读取点（scenes/test.js:672 / :695，用于对卡槽与 `1~6` 按键映射），怪物的 `id` 没有任何代码读它；怪物在出怪表与存档里都按字符串 key（`chunipenguin_ftr`）寻址，所以改号不动存档、不动 `spawnTable`、不动出怪
- 未动：两只怪各自的 `level 2/4`、`weight 4000/3500`、`tier 1/2`、`hp 270`、`threshold 90`、`speedMin/Max`、`atkInterval/atkDamage`、`img`、`scale 1.20`、`hitbox 0.90`、`armor1` 引用与 `name`；`prs` 那一行；`CFG.wave.armor1Weight/armor2Weight`；`test2` 的 `spawnTable`
- 语法自检五个 JS 文件 `vm.Script` 全过，`INFO` 在 vm 里可正常求值；**未开浏览器**

## v0.1.67（2026-10-27）
- 按你「将 ftr 改为一类防具；同步修改 chinipenguin_ftr」——**纯数据改动，代码一行未动**：`INFO.monsters.chunipenguin_ftr`（id 103）的 `armor1: null / armor2: 'ftr'` → **`armor1: 'ftr' / armor2: null`**（info.js:185-186），`INFO.armors.ftr` 删掉 `hitbox: 1.00`（info.js:199，一类的行不带 `hitbox`，与 `prs` 同形：`name/hp/img/scale/dx/dy` 六项）
- 为什么删 `hitbox`：全仓只有 `armor2Hit` 读它（scenes/test.js:262），而该函数第一行 `if (!m.a2hp) return false;` 就短路，所以 ftr 挂到 armor1 之后这个值永远不会被读 —— 与当初"一类的行故意不写 `hitbox`"的口径一致
- 机制随槽位自动切换（无需改码的站点：`spawnMonster` :205-206 按 `armor1/armor2` 建实例血量、`hurtBody` :232 破一类掉 `armor1`、`drawArmors` :1060-1061 一类才跟减速染色、`bulletHitKind` :265-267）：沙箱实测同一件 ftr（hp 1100）挂在两个槽上的差别 —— **伤害 150**：改前 `a2 1100→950`、子弹被盾吃掉且**减速被吞**（`slow=0`）；改后 `a1 1100→950`、**减速生效**（`slow=0.5`）。**伤害 1100**（正好等于防具血量）：两边都是 `a*=0` + 掉落 1 件、本体 270 不掉血。**伤害 1150**：改前溢出 50 **丢失**（本体仍 270）；改后溢出转本体 → **hp 270→220** + 掉落
- **判定变化**（改前只在这里写像素，报告里只给系数）：二类的独立挡弹格 = `m.x + dx(-70)` 处 ±`CFG.hitDist × hitbox(1.00)` = 区间 `[890, 970]`（`m.x=1000`），本体格 = `[960, 1040]`；改后只剩本体格，即子弹可以穿过原来那 70px 的盾前空间、贴到本体框才被拦下（沙箱按 b.x=889/890/931/960/1000/1039/1041 逐点验过）。一类的规则"不增大怪物的判定框"仍然成立，怪物自己的 `hitbox: 0.90` 一字未动
- **波次总血量权重**：`monWaveHp` 分子分母同式（:252），103 这只从 `270 + 1100×0.20 = 490` → `270 + 1100×1.00 = 1370`（**+880**，约 2.8 倍）。这会同时抬高本波总量与催波门槛的分子分母，`CFG.wave.hpCut 0.65` 不变但带 ftr 的波次会更难被催
- 摆位没动：`dx -70 / dy -90 / scale 0.63` 原样保留，所以 ftr 仍画在企鹅左手那个位置 —— 一类只是"吸收＋溢出转本体＋不挡弹"这套**伤害路由**，与画在哪无关。要把它挪到头上就是改 `dy`（`prs` 是 `dx 0 / dy -193`），你说一声
- 未动：`ftr` 的 `hp 1100`、`chunipenguin_ftr` 的 `id/name/level 4/weight 3500/tier 2/hp 270/threshold 90/speedMin·Max/atkInterval/atkDamage/img/scale/hitbox`、`test2` 的 `spawnTable`（key 不变）、`prs` 那一行、`CFG.wave.armor1Weight/armor2Weight`、id 升序（101/102/103）
- 存档口径：`a1hp/a2hp` 是随怪物实例序列化的，所以**旧存档里已有的 103 仍按二类跑**（它的 `a2hp` 还在），按"旧的存档先丢弃"不做迁移。语法自检五个 JS 文件 `vm.Script` 全过，`INFO` 在 vm 里可正常求值；**未开浏览器**

## v0.1.66（2026-10-27）
- 按你「把旋转的基点改为实际贴图的位置，而不是透明部分」——`drawCorpse` 原来的支点是**贴图框的左下角**，而 `enm_chunipenguin.png` 画布四周有透明留白（PIL 实测：左 58 / 上 0 / 右 101 / 下 36，源像素，画布 734×1102），那个角正好落在企鹅轮廓之外的空气里
- **新常数** `CFG.artPad`（game.js:22）：按**贴图文件路径**记四边留白 `[左, 上, 右, 下]`，现值 `{ 'images/enemies/enm_chunipenguin.png': [58, 0, 101, 36] }`。用路径而不是 img key 做键是必须的：`INFO.monsters` 三行（101/102/103）各自 `loadImage('enm_' + k, ...)` 生成三个 img key 却共用同一张贴图，按 key 记会漏掉 `_prs` / `_ftr` 两行
- 支点改为**贴图内容框的左下角**（有效像素包围盒的左下角 = "嘴所在那条竖线 × 脚所在那条横线"）：`px = 左留白 × s.w / img.width`、`py = 下留白 × s.h / img.height`，`translate(c.x - s.w / 2 + px - slide*k, feetLine(c.row) - py)` 配 `drawImage(img, -px, py - s.h, ...)`（scenes/test.js:1081-1096）
- 关键：`translate` 与 `drawImage` 的两个偏移互相抵消，所以**倒地当帧贴图的世界位置一字未变**（实测内容框改前改后都是 `x [937.41, 1053.67]`、`y [-223.20, -7.29]`，与活怪的内容框逐位相同），变的只有旋转中心
- 完全躺平的落位（`m.x = 1000`、脚线记 0）：改前内容占 `x [662.47, 878.38]`、`y [-128.01, -11.75]` —— 底边**悬在脚线以上 11.75px**（绕的是留白里的角，所以身体抬着一截）；改后 `x [681.51, 897.41]`、`y [-123.55, -7.29]` —— 底边正好压在贴图自己的着地线（脚线以上 7.29px，与站着时最低那颗像素同高），整体往后收 19.03px、往下沉 4.46px。躺平后的长 215.91 / 厚 116.26 两个尺寸改前改后相同
- 为什么不是"绕脚底中线"（另一种读法）：实际着地点在源图 `x 277..303`（= 框内 56.10~61.37px），绕它转满 90° 会把嘴所在的前半截甩到支点以下 **47.03px**，即陷入脚线以下 39.70px（头穿进草皮）。内容框左下角是"既贴着贴图、又不让任何像素入地"的最远支点，所以选它；真要按脚底转就得同时把 `angle` 收到 90° 以内
- 未动：`CFG.monster.death` 五个常数（记一笔：`fall` 现值 **0.3** 是你在 v0.1.65 之后自己手改的，我没碰）、防具掉落（无旋转，不读 `artPad`）、判定（`monsterBox` / `hitBox` 仍按整张画布算，留白不参与任何判定，尸体零判定）、`INFO`、贴图文件本身
- 口径：`?? [0, 0, 0, 0]` 的含义是"新贴图没登记留白 = 按整张画布转"，即退回改前的行为；以后加新怪物贴图想要正确的倒地支点，就往 `CFG.artPad` 补一条，取值一行 PIL：`Image.open(p).split()[3].getbbox()` → `[x0, y0, x1, y1]` 换算成四边留白。语法自检五个 JS 文件 `vm.Script` 全过，**未开浏览器**

## v0.1.65（2026-10-27）
- 按你「缩短倒地过程的时间；防具掉落时改为抛物线（往下斜抛）掉落到旁边的地面，而不是垂直下落」——两件事同一条指令，一条版本号
- **倒地时长**：`CFG.monster.death.fall` **1 → 0.5**（game.js:20）。它只管"从站直到完全躺平"那一段；`hold`（躺平后停留）与 `fade`（淡出）是你原话点名的 1s / 0.3s，一字未动，所以一具尸体的总时长 `fall+hold+fade` **2.3s → 1.8s**。缓动 `k = u*u` 与 `slide: 40` 不变，同一条弧线压进一半时间：`t=0.125 → 倾角 -5.6°`、`0.25 → -22.5°`、`0.375 → -50.6°`、`0.5 → -90°`（滑行同步收口到 -40px）。减速怪仍按 `c.sf` 折半计时（0.5s 在真实时间里仍是 1s）
- **防具抛物线**：`CFG.armor.death` 尾部新增两个字段（game.js:21）—— `run: 90` 水平抛程（px，正数 = 向右 = 背离我方阵地那一侧）、`push: 0.45` 起抛瞬间下抛分量占总落差的比例（`0` = 纯平抛，`1` = 匀速直线下落）
- 实现：`drawDrop` 里 x 走线性、y 走"一次项 + 二次项"（scenes/test.js:1102-1104）：`x = f.x + run*u`、`y = f.y + h*(push*u + (1-push)*u*u)`，`h = target - y` 是该件防具自己的落差。**两个端点恒等**：`u=0` 回到原来的挂点（打碎当帧不跳位）、`u=1` 精确落在 `target`（脚线 - 半高，即贴地），所以起终点与落地姿态跟改前逐像素相同，只是中途走抛物线而非垂直线
- 实测（`plantSize` 真值，px）：`prs` 框 121.53×100.44、落差 `h=142.78`、起抛角 **35.5°**，落点由"怪物中心"移到"中心右侧 90"；`ftr` 框 125.19×117.18、落差 `h=31.41`、起抛角 **8.9°**，落点由 `dx -70` 移到 `+20`。两件角度差是数据造成的：`ftr` 的 `dy -90` 本来就离地近，`push` 只按比例分配初速度 —— 想让它也抛得开，调 `INFO.armors.ftr.dy`（更负 = 挂得更高 = 落差更大）或拉长 `fall`
- 飞行时长**没动**：`CFG.armor.death.fall` 仍是 **0.15**。垂直下落时它只是"贴地快慢"，改成抛物线后它同时是整段抛物线的飞行时间，所以现在的观感是"很快被弹到旁边"。嫌急就把它调大（0.3~0.4 量级），`hold/fade` 不受影响，总时长 = `fall + 1.5`
- 不变：`armorDrop` 写入的字段形状（`key/x/y/target/t`，`run/push` 属于 CFG 不进实例）、`state.drops` 零判定、不进存档、计时不随减速折半（`f.t += dt`）、`burst/boom` 击杀不掉落防具、尸体侧的 `angle/slide` 与 v0.1.64 的锚点
- 未动：贴图、`INFO`、`README.md`。语法自检五个 JS 文件 `vm.Script` 全过，**未开浏览器**

## v0.1.64（2026-10-27）
- 按你「倒地时前移变成后移了」——这是 v0.1.62 把镜像烘进贴图带出来的：`drawCorpse` 的支点是**贴图框的左下角**（你伪代码里的写法），框宽 148.66、半宽 74.33，而 `c.x` 是怪物的**中心**，所以尸体的框整个挂在 `c.x` 右边；镜像前企鹅的白肚子在框的左半边、正压着头点，这 74.33px 看不太出来，镜像后肚子挪到了右半边，它就成了肉眼可见的"先往后一沉"
- 改法是把**支点挪到怪物自己的左下角**，而不是把框挪到支点右边：`ctx.translate(c.x - d.slide * k, feetLine(c.row))` → **`ctx.translate(c.x - s.w / 2 - d.slide * k, feetLine(c.row))`**（scenes/test.js:1090），`drawImage(img, 0, -s.h, s.w, s.h)` 一字未动
- 为什么不改成 `-s.w/2` 的居中画法（我先试过、又退回来）：那样支点变成贴图框底边的中点，旋到 90° 时框的左半截会**沉到脚线以下 74.33px**（本行下沿只在脚线以下 12px，等于压进下一行的格子 62px）；挂在左下角则四个角全程 `y <= 脚线`，实测任何一帧都不入地
- 实测（`m.x = 1000`、脚线记作 0，单位 px）：活怪框 `[925.67, 1074.33]`；改前尸体出生帧 `[1000.00, 1148.66]`（整体右移 74.33 = 向后跳），改后 `[925.67, 1074.33]` **与活怪逐位相同**，死亡当帧零跳变。整段倒地随之整体前移 74.33：完全倒地时占 `[662.47, 885.67]`（改前 `[736.80, 960.00]`）
- 不变：`CFG.monster.death` 五个常数一字未改（`fall 1 / hold 1 / fade 0.3 / angle 90 / slide 40`），滑行仍是 `-slide` = 向左 = 前进方向；弧线中途框顶仍抬到脚线以上 39.9px（`k≈0.25`，与改前一致）；`state.deaths` 的数据形状、时间轴、慢速折半 `sf`、尸体零判定都不变
- 未动：贴图（还是 v0.1.62 那张朝左的）、`INFO`、`drawDrop`（防具掉落用的是防具自己的绝对坐标，与这个支点无关）、`README.md`
- 后续可调口径：嫌前移过头/不够就改 `CFG.monster.death.slide`（现 40，唯一的滑行量）；想让它仰面朝后倒则把 `angle` 取负。语法自检五个 JS 文件 `vm.Script` 全过，**未开浏览器**

## v0.1.63（2026-10-27）
- 按你「把项目做成 github 的 pages，把 pages 的连接放入 README.md」——项目本来就是纯静态（`index.html` + 5 个 `<script>`，全部资源路径是相对路径，没有 `fetch`/后端），所以 Pages 用 **Deploy from a branch → `main` / (root)** 直接发即可，无需构建、无需 workflow 文件
- **仓库必须公开**：免费方案下 Pages 不能从私有仓库发布，所以 `Enana-ena/7sRef` 从私有改回公开（这一步只能本人在网页 Settings → General → Danger Zone 做，我没有 gh CLI、也不碰 token）。代价已经确认过：`images/` ≈13 MB 立绘、`sounds/` ≈14 MB（`lawnbgm(1).mp3` / `World's end BLACKBOX.mp3` / `躯樹の墓守.mp3`，其中后两首是第三方曲目）连同 `00_MASTER_PROMPT.md`、`update.md` 和全部提交历史一起变成可直接下载
- 新增根目录空文件 `.nojekyll`：留着它 Pages 才把仓库文件原样当静态资源发；删掉则走 Jekyll 构建，`sounds/World's end BLACKBOX.mp3`（空格 + 括号 + 撇号）、`images/cards/card_らん.png`（日文）、`sounds/躯樹の墓守.mp3` 这些文件名会被跳过或转义成 404。当前文件名的体检结果：没有 `_` / `.` 开头的 basename，所以 Jekyll 的下划线忽略规则这一次没踩到，但带空格/非 ASCII 的那批仍需要 `.nojekyll`
- **README**：新增「在线游玩」小节（放在「运行」之前），写死 `https://enana-ena.github.io/7sRef/`、说明来源分支与"推 `main` 就自动重新发布"，以及 `.nojekyll` 为什么不能删；「运行」补一句 Pages 与本地双击等效（存档各浏览器独立）；目录结构里补 `.nojekyll` 一行
- 这次 push 一并上线了并行会话 v0.1.56–v0.1.62 的工作区改动（`scenes/test.js` 出怪预算与取整、`game.js` 的 `CFG.wave.bigMul`、`info/info.js` 删 `flip`、`enm_chunipenguin.png` 镜像重绘、11 张 `difficulty-*` / `byd,etr,ftr,prs,pst` 图标、`躯樹の墓守.mp3`），所以线上就是当前最新版本；上线后 test2 的 BGM 才有文件可取（`info/info.js` 引用 `sounds/躯樹の墓守.mp3`，之前这个文件没进仓库 ⇒ 开启自然出怪时第二关听不到音乐）
- 验证：5 个 js 文件（`game.js` / `save.js` / `info/info.js` / `scenes/menu.js` / `scenes/test.js`）过 `vm.Script`；发布前扫描改动文本无 token/私钥等凭据；打开前 `https://github.com/Enana-ena/7sRef` 与 `https://enana-ena.github.io/7sRef/` 都是 404（私有 + 未发布），改公开并启用后应为 200
- 未改：`update_7sRef.md`（面向玩家的内容日志，Pages 属于部署设施、不是玩法内容）

## v0.1.62（2026-10-27）
- 按你「直接翻转原文件，将 flip 字样去除」——上一条 v0.1.61 的倒地动画里 `flip` 没生效（`makeCorpse` 只拷 `type/x/row/t/sf`，`drawCorpse` 是裸 `drawImage`，从不镜像），你选的解法不是给尸体补镜像，而是**把镜像烘进贴图、彻底删掉这个字段**
- **贴图**：`images/enemies/enm_chunipenguin.png` 用 PIL `FLIP_LEFT_RIGHT` 水平镜像后原地覆盖（734×1102、RGBA、alpha 完整保留，字节 `260494 → 260732`，尺寸与模式一字未变；核对过镜像两次等于原图）。朝向实测：改前**嘴朝右**、游戏里靠 `flip: true` 翻成朝左；改后**嘴朝左** ⇒ 场上活怪外观与之前逐像素等价，只有倒地的那只从"向后倒"变成"顺着走的方向倒下去"
- **数据**：`INFO.monsters` 三行（101 `chunipenguin` / 102 `chunipenguin_prs` / 103 `chunipenguin_ftr`，共用这一张贴图）各删掉一行 `flip: true,`（原 info.js:156 / 175 / 194），其余字段与顺序不变、仍按 id 升序。**卡片行的 `flip` 一字未动**（info.js:21 / 33 / 46 / 62 / 74 / 95 / 112 七张卡照旧）
- **代码**：`drawMonster` 的镜像项去掉 —— `ctx.scale((1 + 0.15 * k) * (INFO.monsters[m.type].flip ? -1 : 1), 1 - 0.12 * k)` → **`ctx.scale(1 + 0.15 * k, 1 - 0.12 * k)`**（scenes/test.js:1070）。这是全仓唯一读怪物 `flip` 的地方（grep 过 `flip`，剩下的只有 `drawPartner` 的形参和两处 `card.info.flip` 调用 :1337 / :1391，全部保留）。啃咬挤压 `0.15 / 0.12` 与 `translate(b.x - 8 * k, ...)` 不变
- 连带：`slowSprite` / `flashSprite` 的离屏缓存都是按 key 从 `imgs['enm_' + key]` 现生成的，换贴图后自动跟着新朝向，不需要改；影子、全景展示（`state.lineup`）、防具摆位（本来就不跟 `flip`）都不受影响
- 口径记一笔：`angle: 90`「统一向左倒、不跟 `flip`」这条不变（现在也没有 `flip` 可跟了）。另外 `flip` 属于项目约定里"布尔常量字段一律显式写进 info"的那一类，这次是按你的指令**整键删除**而不是留 `flip: false`，所以以后加怪想镜像请直接在贴图里做好朝向，代码不再提供怪物级的镜像开关（伙伴级 `drawPartner` 的 `flip` 仍然有效）
- 未动：`README.md`；`CFG` 一字未改；伤害路由、闪白与倒地/掉落的时间轴与数值；`INFO.armors` 与 `tracklist`
- 语法自检：五个 JS 文件 `vm.Script` 全过。**未开浏览器**，场上外观是否与原状一致由你验；要复原贴图就 `git checkout -- images/enemies/enm_chunipenguin.png`（该文件在 git 里已跟踪、本轮之前是干净的）

## v0.1.61（2026-10-27）
- 按你「受击闪白（怪物＋伙伴）与倒地死亡动画（怪物＋防具掉落）」三个特性同一条指令，一条版本号
- **新常数**（game.js:20-21）：`CFG.monster.hitFlash: 0.05`（闪白时长，秒）、`CFG.monster.hitAlpha: 0.2`（叠白强度）、`CFG.monster.hitColor: '#ffffff'`（剪影填充色，可换）、`CFG.monster.death: { fall: 1, hold: 1, fade: 0.3, angle: 90, slide: 40 }`（倒地时长 / 倒地后停留 / 淡出 / 倒地角度（度，统一向左，不跟 `flip`）/ 前冲水平位移 px）、**新组** `CFG.armor.death: { fall: 0.15, hold: 1, fade: 0.5 }`（只管防具掉落）。怪物与伙伴**共用同一对** `hitFlash/hitAlpha`，没拆两套；缓动统一 `k = u*u`（`u = min(1, t/fall)`），不额外加缓动字段；所有时长走 `updateGame` 的 `dt`，快速模式跟着折半
- **白剪影基础设施**（scenes/test.js:1027-1041）：`flashImgs` + `flashSprite(key, s)` —— `key` 就是现成的 `imgs` 名（`enm_<type>` / `ptn_<card>` / `arm_<key>`），离屏画布按 `s`（调用方同一套 `plantSize` 的结果）铺满原图后 `globalCompositeOperation = 'source-in'` 填 `hitColor`，与原图同尺寸才能对到同一矩形；强度只走每帧 `ctx.globalAlpha`，**没有烘进 `slowImgs` / `armorImgs` 任何一张**（那两张仍按 key 永久缓存，冻住"正在闪"就坏了）。等效于往白提亮 `dst' = dst + (255-dst)·0.2`，暗部一起抬、细节保留。总量 3 张怪 + 8 张卡 + 2 件防具
- **实例计时器**：怪物三个各自独立的 `hitT` / `a1t`（一类）/ `a2t`（二类），在 `spawnMonster` 构造点（test.js:281）初值 0，每帧 `if (t) t = Math.max(0, t - dt)` 递减（test.js:1732-1734，**不乘 `sf`**，被减速的怪闪白时长不变）；`> 0` 就叠白，时长内 alpha 恒为 `hitAlpha`、到 0 硬切回原样不淡出，重复命中只复位时间不累加亮度
- **谁闪**（复位收进 `hurtBody` test.js:225 / `hurtArea` test.js:239，调用点不各写一遍）：子弹命中本体 → 一类还在就本体＋一类一起闪、一类没了只本体闪；子弹被二类挡（`kind === 2`，test.js:1841-1844 这一支在调用点复位）→ **只二类闪，本体不闪**；`burst`（touchhold）/ `boom`（Guy）走 `hurtArea` → 本体＋一类＋二类，这次受到伤害的部分一起闪（实测：三件都在时 10 点范围伤 → `hitT/a1t/a2t` 全部 0.05、a1 360、a2 1090）
- **不闪的两个入口**：垂死流血 `bleedDmg`（每 0.033s 一跳，test.js:1855-1863）仍是裸 `m.hp -= CFG.monster.bleedDmg`，**不算受击**；金牛奶 `gmilk` 整只清除、不扣血，不闪也不播倒地
- **叠白位置**：本体在 `drawMonster`（test.js:1064-1080）的 `translate/scale` **之内**、主体贴图之后叠同一矩形 `-b.w/2, -b.h`，所以自动跟 `flip` 镜像与啃咬挤压，且蓝底减速先画、白剪影后叠 ⇒ 减速时闪成浅蓝；防具在 `drawArmor` 新增第 5 个形参 `flash`（test.js:1043-1057，原来的 `tint` 旁边），`drawArmors` 传 `m.a1t > 0` / `m.a2t > 0`
- **伙伴闪白触发点是咬合动作，不是掉血**：`atkInterval 0.04` + `atkDamage 4` 太快，跟血量走会常驻白。所以挂在 `m.biteT` 复位那一帧（test.js:1749-1752 的 `if (m.biteT <= 0)`，正是 `k=1` 的扑咬瞬间）赋 `m.eat.hitT = hitFlash` ⇒ `immune: true` 的 touchhold、出土中的 Guy（`armPhase === 1`）**照样闪**（被啃、有咬合，只是不掉血）
- **伙伴侧三个坑都处理了**：`state.plants` 元素新增 `hitT`（构造点 test.js:1631，初值 0，每帧递减 test.js:1768）；`drawPartner`（test.js:944-965）多收第 7 个形参 `flashKey`，镜像分支里跟着 `scale(-1,1)` 走、alpha 用 `alpha × hitAlpha`（跟手预览 test.js:1284 那一处**不传**，半透明 0.6 不算受击也不闪）；Guy 的 `charge` 走 `drawEmerge`（test.js:117-125）同样加 `flashKey`，剪影按 `emergeRatio` 的同一 `v` 裁源图上半截 ⇒ 还在土里不会整只发白。伙伴没有减速，白就是白
- **倒地只是演出，实体当帧离场**：`state.monsters = state.monsters.filter(m => m.x > -60 && m.hp > 0)` 改成显式分流（test.js:1864-1873）—— `hp <= 0` 且没被特判的 push 进 `state.deaths`、走出左边界的照旧直接消失不播。`makeCorpse`（test.js:221）拷 `type / x / row / t: 0 / sf`（`sf = m.slow > 0 ? CFG.monster.slow : 1`），不留共享引用（实测 keys 就这五个、改原怪不影响尸体）；`c.t += dt * c.sf` ⇒ 整条时间轴一起乘同一个 `sf`，被减速的怪倒地慢一倍
- 时间轴实测：`fall 1 → hold 1 → fade 0.3` 总 **2.3s**（`sf = 0.5` 时 **4.6s**）；采样 t=0/0.5/1/2/2.15/2.29 → 旋转 `0° / -22.5° / -90° / -90° / -90° / -90°`（`k=u²`，1 秒到底）、前冲位移 `0 / -10 / -40 / -40` px、alpha `1 / 1 / 1 / 1 / 0.5 / 0.033`，到 `t = 2.3` 移除。绘制 `translate(c.x - slide*k, feetLine(row))` → `rotate(-k*angle)` → `drawImage(贴图, 0, -s.h, s.w, s.h)`，**以脚线为轴、锚点是贴图左下角**（按你给的伪码字面实现，所以贴地的躯体落在那一帧的 x 左侧 223.2px 处，而非以 `m.x` 居中）
- **倒地特判**：`burstDamage`（test.js:93-97）与 `boomDamage`（test.js:141-145）的循环里 `hurtArea` 之后补 `if (m.hp <= 0) { m.noCorpse = true; state.drops.length = nd; }` —— 被 touchhold / Guy 炸死的怪直接消失不播倒地，**同一次伤害里顺手归零的防具也一起回滚不播**（`nd` 是这次伤害前的 `state.drops.length`，所以更早被打穿的防具掉落不受影响）；被子弹打死、或垂死后流血致死的怪正常播
- **防具掉落**只在自身 hp 因伤害归零那一刻 push（`armorDrop` test.js:213-220）：一类被打穿（含**恰好等量**打死那一支，判据用 `if (!m.a1hp)` 而不是 `over > 0`，否则 370 点正好打穿会不掉）、二类挡弹挡穿、范围伤害打穿二类，共三处。条目 `{ key, x: m.x + a.dx, y: feetY + a.dy, target: feetY - s.h / 2, t: 0 }`，`fall 0.15 → hold 1 → fade 0.5` 总 **1.65s**，只走 y（`u²` 加速）、**水平不动**（怪继续往前走，掉件留在原地）、不旋转、不受减速影响。落地按"底边贴脚线"：实测 `prs` 下落 **142.78px**、`ftr` **31.41px**（当前 `dy` 为 -193 / -90），落定后中心分别高出脚线 50.22 / 58.59 = 各自 `s.h/2`。掉落的防具**没有任何判定**（不挡弹、不参与范围伤害与波次血量），纯贴图
- **状态与绘制**：`state.deaths` / `state.drops` 与 `state.monsters` 同处初始化（game.js:86-87 的 `makeRun` 字面量、test.js:448-449 的 `resetRun`）⇒ **「重新开始」与「回主菜单」都会清空**，上一局的尸体不会留下；两个数组**不进存档**（`save.js:1` 的 `SAVE_KEYS` 一字未改，读档不复活演出，也没塞进 `snapshotRun`）。绘制紧跟 `for (const m of state.monsters) drawMonster(m)` 之后，**先 `drops` 再 `deaths`**（test.js:1342-1343，尸体压在活怪之上）；倒地演出**不画防具、不画影子、不叠闪白**（影子遍历 `state.monsters`，尸体自动没有）
- 连带效果（都是"倒地不算在场"的直接结果，选定行为）：清场与大波前"场上全空"催波（`state.monsters.length === 0`）、催波分子 `monWaveHp` 累加、子弹 `find`、`burst`/`boom` 相交、Guy 引爆的 `touching`、判负线、`resultCheck`、金牛奶 —— **全部自动跳过尸体，没有加任何排除分支**；分子里也不可能再出现负 hp。手算末波：一只 270 血的怪被子弹打死进入倒地后 `state.monsters.length` 当帧减 1 ⇒ 大波前的"全空"催波比有尸体时更早触发
- 全景展示的假怪（`state.lineup`，只有 `type / x / row / a1hp / a2hp`）走同一个 `drawMonster`：`m.hitT` 是 `undefined`、`undefined > 0` 为假 ⇒ 天然不闪，没为它加初始化
- 未动：`README.md`；`CFG.monster` 原有字段（`bleedGap / bleedDmg / slow / slowColor / slowAlpha / feet`）与 `slowSprite` / `armorSprite` 的染色路线；伤害数值、防具数值与摆位、波次与出怪、`immune` / `armPhase` 的免伤判定；没上 `ctx.filter = 'brightness()'`，闪白期间不改形状/位移/描边，怪物身上不加伤害数字或血条，尸体无判定，伙伴没有死亡动画
- 语法自检：`game.js`、`scenes/test.js`、`info/info.js`、`save.js`、`scenes/menu.js` 五个文件 `vm.Script` 全过；`hurtBody/hurtArea/armorDrop/makeCorpse/feetLine/monWaveHp` 与 `drawCorpse/drawDrop` 用沙箱跑过一遍（伤害路由 6 例、掉落几何 2 例、演出时间轴 12 个采样点）。**未开浏览器**，闪白与倒地的观感由你自己验

## v0.1.60（2026-10-27）
- 按你「测试场景2的bgm改为躯樹の墓守」把 `INFO.tracklist.test2.bgm` **`sounds/World's end BLACKBOX.mp3` → `sounds/躯樹の墓守.mp3`**（info/info.js:219）
- 文件名核对过：`sounds/躯樹の墓守.mp3` 确实存在（3272431 字节 ≈ 3.12 MB，`sounds/` 里目前就三个文件），路径写法沿用关卡字段里的 `sounds/` 前缀
- 日文字符不会有编码问题，核对了两条：`info/info.js` 是无 BOM 的 **UTF-8**（含中文/日文，Python 解码通过），`index.html:4` 有 `<meta charset="UTF-8">` ⇒ `new Audio()` 拿到的相对路径按 UTF-8 解析，和之前带空格/括号的 `World's end BLACKBOX.mp3`、`lawnbgm(1).mp3` 走同一条换源逻辑（`levelBgm(key)` 读关卡字段，`enterRun` 里只在新旧 src 不同时赋 `bgm.src`）
- 生效范围：进 test2 的每一局（新局从 0 秒起，`bgmAt` 是每关各自的字段）；**test1 的 `bgm` 与全局默认 `INFO.bgm` 都没动**，仍是 `lawnbgm(1).mp3`
- 一个附带现象（机制原有行为，没改）：`bgm.currentTime = slot.bgmAt` 是按关卡存档续播的，所以若读的是 test2 中途的老存档，新歌会从旧存档那一秒接着放 —— 按项目约定旧存档直接丢弃，实际碰不到
- `World's end BLACKBOX.mp3` 现在没有任何关卡引用了，文件仍留在 `sounds/` 里没删（要删说一声）；本轮除这一行数据外未改任何代码

## v0.1.59（2026-10-27）
- 按你「目前两种防具都需要往上调一些位置」把两件防具的 `dy` **各上移 20px**：`prs.dy -73 → -93`、`ftr.dy 30 → 10`（info/info.js:182-183，`dy` 就是防具贴图中心相对怪物贴图框中心的纵向偏移，向下为正，只影响绘制）
- 两条都动同样的量，是为了保住上一条里"prs 贴头顶 / ftr 在手部高度"这个相对关系；要单独调某一件直接改那一行的 `dy` 就行，两件互不影响
- 相对本体框（半高 111.6）的覆盖范围：prs 由 -123.2~-22.8 变成 **-143.2~-42.8**（现在探出贴图框上沿约 31.6px）；ftr 由 -28.6~88.6 变成 **-48.6~68.6**（底边离脚线 `CFG.monster.feet` 更远 20px）
- 判定不受影响：二类的拦弹只看横向 `Math.abs(b.x - (m.x + dx)) <= CFG.hitDist * hitbox` 与 `row`，`dy` 完全不参与，所以上移不改变它挡弹的范围；一类按定义本来就没有判定框
- `hp / scale / dx / hitbox` 与怪物本体判定 `hitbox: 0.90` 全部原样；test1、出怪表、伤害路由、催波权重都没动

## v0.1.58（2026-10-27）
- 按你「给怪物新增一类/二类防具属性，并新增两只带防具的怪挂到测试场景2」。**新增 `INFO.armors` 独立表**（info/info.js:181，放在 `monsters` 之后、**不带 id**，任意怪可复用）：`prs`（`hp 370`、`images/others/difficulty-Present.png`、`scale 0.54 / dx 0 / dy -73`）和 `ftr`（`hp 1100`、`difficulty-Future.png`、`scale 0.63 / dx -70 / dy 30 / hitbox 1.00`）
- `scale` 与怪物共用 `plantSize`（高 = `CFG.grid.ch 186 × scale`）⇒ prs 100.4×121.5、ftr 117.2×125.2，正好是两张贴图的原始像素（121×100 / 125×117），也就是 1:1 摆放。`dx / dy` = 防具贴图中心相对**怪物贴图框中心**的偏移（右/下为正），初值算法：prs 头顶 `-111.6 + 50.2 - 12 ≈ -73`；ftr 伸到来弹方向（本体半宽 74.33）取 `-70`，手部高度 `+30` —— 只是摆位初值，你之后自己调
- **`prs` 故意不写 `hitbox`**：一类按定义不增大任何判定框，代码也不读它（只有 `armor2Hit` 读 `INFO.armors[armor2].hitbox`）
- **新增两只怪**（`monsters` 按 id 升序接在后面，`armor1 / armor2` 紧跟 `hp`，三条字段顺序一致）：`chunipenguin_prs`（id 102 / level 2 / weight 4000 / tier 1）与 `chunipenguin_ftr`（id 103 / level 4 / weight 3500 / tier 2）。除这五项外**照抄** chunipenguin，含 `hitbox: 0.90`（防具不参与本体判定）；贴图复用 `enm_chunipenguin.png`，防具是独立叠加绘制。无防具一律显式 `armor1: null` / `armor2: null`，不给代码兜底留暗值
- `tracklist.test2.spawnTable` → `['chunipenguin', 'chunipenguin_prs', 'chunipenguin_ftr']`；**test1 未动**，`出怪` 按钮仍固定取 `spawnTable[0]`（无防具的 chunipenguin）
- **实例血量**：防具血量每只怪各自持有，字段 `m.a1hp / m.a2hp`（无防具 `null`），由助手 `initArmor(m)`（scenes/test.js:188）从 `INFO.armors[key].hp` 拷贝；`spawnMonster`（:241）与全景展示的假怪 `buildLineup`（:532）都调用，所以选卡全景里防具照样画得出、`drawArmor` 不必判 `undefined`。归零 = 视为没有这件防具（不画、不判定、不再吸收）。`save.js:26-30` 的怪物快照是全键遍历，新字段自动进/出存档；按约定旧存档直接丢弃不迁移（真读到也不抛错，只是没防具）
- **伤害路由收进两个助手**，本体伤害不再散写 `m.hp -=`：`hurtBody(m, dmg)`（:194）一类全额吸收、`伤害 - a1hp` 的溢出转本体、破了就当没有；`hurtArea(m, dmg)`（:204）二类与本体**同时各自全额**扣，本体那份仍先过一类。入口：子弹打本体 :1729、`burstDamage` :93、`boomDamage` :131（范围/穿透类的相交判定**没新增**，仍只看本体 `hitBox(m)`，命中本体才连带二类）
- **二类挡弹**：子弹循环（:1718-1736）由 `find` 改成同一次扫描按 `state.monsters` 顺序取"第一个能命中任何东西的怪"（多怪同行重叠时的优先级与现状一致），`bulletHitKind` 先 `armor2Hit` 后 `bodyHit`（:214-227）。二类用 `Math.abs(b.x - (m.x + dx)) <= CFG.hitDist * a.hitbox`；**本体那行一字未改**仍是 `Math.abs(b.x - m.x) <= CFG.hitDist`。二类吃到伤害时**溢出丢弃、子弹照常消耗、`b.slow` 不生效**；纵向仍只看 `row`，走你选的 (a) 中心距方案，不做真矩形相交
- 判定窗口实测（`hitDist 40`、ftr `dx -70 / hitbox 1.00`、怪在 x=1000）：二类吃 **890~970**、本体吃 **960~1040**，重叠的 10px 归二类。子弹向右飞先进二类窗口 ⇒ **二类活着时本体一发都吃不到**（20 伤害的弹要 55 发才磨掉 1100），这期间 `starblue` 的 `slow: 10` 也挂不上；一类活着时本体 hp 恒 270 ≥ `threshold 90` ⇒ 不进死亡/流血，看着像无敌但一直在掉防具血 —— 都是预期行为
- **不吃防具的保持原样**：跌破 `threshold` 后的流血仍直接 `m.hp -= CFG.monster.bleedDmg`（:1743）；`monThreshold`（:183）只看本体 `hp`；金牛奶是整只怪移除、不走扣血，防具随之消失不做特殊处理；怪物啃食伙伴（:1651）与防具无关
- **催波总 hp 两边同式**：新助手 `monWaveHp(m)` = `m.hp + (a1hp||0) × armor1Weight + (a2hp||0) × armor2Weight`，分母在 `spawnWave`（:306）累加、分子在 `waveCutCheck`（:322）实时累加，同一个函数所以 `hpCut` 门槛不会随本波带防具的比例漂移。权重是 `CFG.wave` 新增的两个常数 `armor1Weight: 1.00` / `armor2Weight: 0.20`（game.js:19），没硬编码进循环。单只贡献：无防具 270、prs **640**、ftr **490**。进度条与胜负判定不读 `waveHp`，未动
- **绘制**（:955-989）：防具画在 `drawMonster` 的 `ctx.restore()` **之后** ⇒ 不跟 `flip` 镜像、也不跟啃咬的位移/挤压形变；一类在 `m.slow > 0` 时跟着本体染蓝，用**按 armor key 缓存**的 `armorSprite(key)`（复用 `CFG.monster.slowColor / slowAlpha`），**没有**烘进 `slowSprite(m.type)` 那张按怪物类型永久缓存的图（否则会把"防具还在不在"冻进缓存）；二类不着色；`hp <= 0` 不画；没加血条/受击闪烁；`monsterBox / hitBox / 影子` 不因防具变化
- `game.js:272` 预加载新增 `arm_<key>` 一行（与 `enm_<key>` 同款写法；`info/info.js` 先于 `game.js` 加载，`INFO.armors` 可用）。两只新怪的 `enm_chunipenguin_prs / _ftr` 由原有那行按 key 各自多建一个 Image，指向同一张图，浏览器有缓存
- 出怪预算体检（脚本模拟 test2 全 30 波 × 400 轮随机）：`sum === budget` 恒成立、过滤后的候选表从不为空（表内仍有 `level: 1` ⇒ v0.1.57 那条不变量没被破坏）；test1 二十波同样全通过。预算第 1~12 波 = `1,1,1,2,2,2,3,3,3,10,4,4` ⇒ level 2 从预算 ≥2（第 4 波）起出现、level 4 从预算 ≥4 起（第 10 波是大波、预算 10）；400 轮里 **81.4%** 的波至少带一只防具怪
- 未做（按你点名的范围）：穿透弹 `pierce` 预留字段、防具血条/受击反馈、二类真矩形判定框、`README.md`、旧存档迁移、`出怪` 按钮改随机抽表、test1 出怪表

## v0.1.57（2026-10-27）
- 按你「最终计算的出怪量向上取整；保证存在级别 1 的怪物、不存在级别 0 的怪物」把上一条那个"凑不满就停"的兜底分支**删掉了**，改为由数据不变量兜住：`scenes\test.js:257` 在全部乘数算完之后加 `budget = Math.ceil(budget)`，循环体收成两行 —— `while (sum < budget) { const key = pickMonster(lv.spawnTable.filter(k => INFO.monsters[k].level <= budget - sum)); ... }`，不再有 `const rest` / `if (!ok.length) break`
- 取整为什么必须落在**最终值**上：`bigMul 2.5` 乘奇数档位必然出小数（第 20 波 `7 × 2.5 = 17.5`），整数 `level` 永远凑不出 17.5；取整后预算恒为整数，加上"表里有 1 级怪"就能证明每波都以 `sum === budget` 结束（既不越界也不留零头），抽取因此不可能空转
- 数据侧无需改动，现状已经满足两条不变量（脚本体检输出）：`INFO.monsters` 的 `level` 集合 = `[1]`（含 1 ✓、无 0 ✓），两关 `spawnTable` 都是 `['chunipenguin']` ⇒ 表内含 1 级怪 ✓
- **不变量被破坏后的表现（按你的"不在代码里兜底"口径，故意不防护）**：表里没有 1 级怪时，剩余额度一旦小于表内最小 `level`，过滤出的可选表为空，`pickMonster([])` 返回 `undefined`，下一句读 `INFO.monsters[undefined].level` **抛 TypeError**、这一波直接崩（不会静默少刷）；某只怪写 `level: 0` 则永远"装得下"、被反复抽中而总级别不涨，一波刷出成百上千只并卡死。两条都写进 README 的 `> 出怪表的 level 约定`，让加怪的人自己守住
- 数值影响：只有第 20 波（两关共有）从上一条的 17 只变回 **18** 只 —— 这是"预算 17.5 向上取整成 18"的结果，与 v0.1.51 那次"靠严格小于偶然进位到 18"不同，现在是显式规则。其余 29 波一字不变；全关自然出怪总量 test1 93 → **94**、test2 184 → **185**
- 未改：`pickMonster` 本体、`unit = min(ceil(wave/div), cap)`、`spawnMul`、`bigMul 2.5`、间隔与催波、行加权落点、`state.waveHp` 记账、手动出怪（test.js:1414 取 `spawnTable[0]`，不经此循环）
- 验证：`scenes\test.js` 过 `vm.Script`；逐波复算 30 波，确认只有第 20 波的预算是非整数（17.5→18）、每一波都以 `sum === budget` 结束、总量 94 / 185；另用假想表 {2,5} 实跑 3 个预算确认"无 1 级怪"确实会走到空可选表那条路
- 文档：README 三处随之更新（波次预算一句加"最后对预算向上取整"、加一只怪的清单加 `level` 正整数约束、新增 `level` 约定段）；玩家向写入 `update_7sRef.md` 顶部新条 **2026-10-27 · 出怪量向上取整，级别 1 由数据保证**

## v0.1.56（2026-10-27）
- 按你「抽取时若加入后总级别大于出怪量则不加入、重新抽取，直到总级别严格等于出怪量」改 `scenes\test.js:259-266`：每轮先把 `lv.spawnTable` 过滤成"**级别 ≤ 剩余额度**"的子表，再在子表内用原 `pickMonster` 按 `weight` 抽；子表为空则本波停止。**没写"抽一只→丢弃→再抽"的字面重试循环**，因为字面版在"没有任何一只装得下"时会无限重抽、浏览器直接卡死；过滤后抽取的分布与"拒绝并重抽"完全等价（条件分布相同），但一定走得出来
- **为什么必须留那个退出条件（当前数据就会撞上）**：`budget` 自 v0.1.51 起可能是**小数**（`bigMul 2.5` × 奇数档位），而怪物 `level` 全是整数 ⇒ 总级别**永远不可能严格等于** x.5。两关都有第 20 波 = `7 × 2.5 = 17.5`，照字面实现就是**一进第 20 波就死循环**。现在这一波按 **17 只**收工（剩 0.5 谁都不装得下）
- 若你更想从源头让它总有解：把预算在数据侧变成整数（`bigMul` 改 2 或 3，或对 `budget` 取整），那样"严格等于"就是硬保证、可以删掉这条退出分支。按你以往"退化公式在数据里修、不用代码兜底"的偏好，这条留给你定，我没顺手改
- 实测差异（现表里只有 `chunipenguin` `level: 1`）：**只有第 20 波变** 18 → **17** 只 —— 旧逻辑靠"预算带小数时向上进位"刷到 18，级别总和 18 已越过 17.5；新逻辑不越界。第 1–19、21–30 波一字不变（预算整数、级别 1 一定正好凑满）。全关自然出怪总量 test1 94 → **93**、test2 185 → **184**
- 新增的保证：以后加 `level > 1` 的怪，本波级别总和**永不超出预算**（旧逻辑最多多出一只怪的级别）。同时提醒"严格等于"并非无条件成立——用假想表实测：表 = {2,5}、预算 12 时可能停在 `5+2+2+2 = 11`（剩 1 谁都装不下），取决于抽取顺序；**只要表里有 `level: 1` 的怪，整数预算就一定正好等于**（表 = {1,3} 在预算 5/6/7/8 全部命中）
- 未改：`pickMonster` 本体与权重口径、`unit = min(ceil(wave/div), cap)`、`spawnMul`、大波 `bigMul`、行加权落点与 `rowInit` 播种、`state.waveHp` 记账（仍是逐只累加）、手动出怪（test.js:1414 直接取 `spawnTable[0]`，不走这个循环）
- 遗留风险（与本次无关、v0.1.33 起提过）：某只怪若写成 `level: 0`，它永远"装得下"，`while` 仍会无限刷；现有数据没有 0 级别，我没加防护
- 验证：`scenes\test.js` 过 `vm.Script`；逐波复算 30 波新旧只数与级别总和，差异仅第 20 波；另对 {2,5}、{1,3} 两组假想级别各跑 5 个预算，确认"不越界"恒成立、"严格等于"的成立条件如上
- 玩家向已写入 `update_7sRef.md` 顶部新条 **2026-10-27 · 出怪抽取：装不下就换一只**

## v0.1.55（2026-10-27）
- 按你「稍增大milk的判定范围，使其更容易被点击到」把 `CFG.milk.hitPad` **40 → 55**（game.js:25，四周边各多 15px）
- 判定框是 `milkSize()` 往外匀扩一圈 pad（scenes/test.js:172-181）：奶滴按 `CFG.milk.size = 120` 等高绘制、贴图 211×373 所以实际只有约 67.88px 宽，于是盒子由 147.88×200 变成 **177.88×230**（宽 +20.3%、高 +15%）。**真正卡住手感的是水平方向**（贴图又瘦又高），pad 是匀扩的，所以宽度也跟着吃了这份增益
- 影响面只有两处（都读同一个 `milkAt`）：点击采集 scenes/test.js:1408 和悬停手型 scenes/test.js:1315。飞行中的奶（`k.fly`）本来就 `continue` 跳过，不参与判定；自动采集 `autoCollect` 走的是全量遍历，不读判定框，行为不变
- 未动：奶的贴图尺寸 `size`、掉落位置、`value`、采集后的飞行弧线全部原样；想要只加宽不加高的话可以把 pad 拆成 `hitPadX / hitPadY` 两个字段，说一声即可

## v0.1.54（2026-10-27）
- 按你「在选卡时，也会显示菜单按钮，并且可以正常使用；选卡完毕点击开始后暂时被禁用（但不消失），直到关卡正式开始」—— 菜单按钮进选卡界面，状态分三档：**`'pick'` 可见可用 → `'out'`/`'count'` 可见但禁用 → `deckPhase === null`（关卡正式开始）恢复可用**
- **显示**：新增 `drawMenuBtn(active)`（scenes/test.js:669）—— 先正常 `drawButton`，`active` 为假时再盖一层 `CFG.cardFace.gray` + `roundRect(..., 16)`，与"开始游戏"按钮在卡组没填满时的置灰写法一致（按钮不消失，只是灰）。`renderDeck` 在 `drawTopHud` 之后调用 `drawMenuBtn(picking)`（:749，画在 `ctx.translate(0, off)` 之前，所以面板下沉时它钉在右上角不动）；战斗渲染里原来的 `drawButton(ui.menuBtn, '菜单')` 换成 `drawMenuBtn(!state.deckPhase)`（:1226），于是 `'count'` 倒计时那 5 秒它已经画出来、但正是灰的
- **可用**：`deckClick` 在 `'pick'` 分支最前面吃掉菜单按钮点击（:787-790 → `setMenu(true)`），位置排在开始/卡槽/卡池判定之前；`deckHover` 同步把手型加上（:817）。置灰阶段什么都不做：`'out'`/`'count'` 依旧走 `if (state.deckPhase !== 'pick') return;`（:785），跟"开始游戏"点下去之后的行为口径一样
- **菜单面板要能盖在选卡界面上**：把 `render()` 里内联的选项面板与"重新开始"确认面板各抽成 `drawMenuPanel(ui)`（:679）/ `drawConfirmPanel(ui)`（:717），战斗渲染原地改成两行调用（:1272 / :1274），`renderDeck` 末尾在 `drawFlights()` 之后补上同样两行（:780-781）—— 绘制顺序、圆角、`ctx.lineWidth = 1` 的复位都原样搬，没有改任何样式或按钮位置
- **输入分流**：`testHover`（:1310）与 `testClick`（:1326）的选卡早退改成 `if (state.deckPhase && !state.menuOpen)` —— 菜单没开时点击仍归选卡处理；菜单开着时落回原有那套通用处理（点菜单按钮关闭 / 退出 / 重新开始 / 继续游戏 / 三个选项勾选），选卡本体不吃点击
- **BGM 不被菜单提前放出来**：`setMenu(false)` 原本无条件 `playBgm()`，选卡期间关菜单就会把音乐提前起掉；game.js:130 改为 `else if (!state.deckPhase) playBgm();`，"进关卡正式开始才放 BGM"（`updateDeck` 里 `'count'` 结束那次的 `playBgm()`，scenes/test.js:555 附近）这条时间线保持不动
- 未动：`'in'`（视角右移进场）与 `needPick()` 为假的直接开局场景仍然不画菜单按钮 —— 你说的是"选卡时"，那两段还没有选卡界面；选项内容、存档写入、`writeRun` 时机、战斗里的按钮布局全部原样

## v0.1.53（2026-10-27）
- 按你「`_face_guy.py` 还有用吗，没用的话删掉」删掉根目录的抠图脚本 `_face_guy.py`（4.4 KB）。判断依据都查过了：游戏代码与 `README.md` **零引用**（`grep -rn face_guy` 排除 `update.md` 后无命中），它写出的两个产物 `images/partners/ptn_Guy_face.png` 与调试叠加图 `_final_ov.png` 早就不在了（v0.1.29 那次你换掉了原图、把我并行做出来的文件删了），所以这个脚本只剩"一次性工具"的身份
- 唯一还挂着它的地方是 v0.1.29 里那条**未接受的提议**（本文件 :209：`Guy_boom.png` 是 1024×1024 全不透明，"要抠掉底色我可以照 `_face_guy.py` 那套管子做"）。按"旧条目留作历史"的规矩那两行原文没动；真要做那张透明 `Guy_boom` 时脚本照抄即可 —— 它已经进了首个提交 `b7c9585`，`git show b7c9585:_face_guy.py > _face_guy.py` 就能取回
- 除删除外未改任何文件；`git status` 现在只有 `D _face_guy.py` 这一条待提交的删除
- 未提交未推送：GitHub 上这个文件还在（`b7c9585` 已推上去），要我把这条删除 commit + push 说一声即可 —— 上次问过"以后是否每次改完自动提交推送"你还没定规矩，我按"只改文件、推送由你发话"执行
- `update_7sRef.md` 本轮无玩家可感变化（删的是开发用脚本，不涉及数值/逻辑/UI/美术），故不写内容日志

## v0.1.52（2026-10-27）
- 按你「更新一遍 README」把 [README.md](README.md) 逐条对着当前代码核了一遍，**只改文档，js / 数据 / 图片一字未动**。以下每条都在文件里有实据（读取处已逐一确认）
- **波次**（:61）：`min(floor(wave / div), cap)` → `min(ceil(...), cap)`（v0.1.48）、"大波再乘一次" → "再乘固定的 `bigMul`（2.5）"（本条上一条 v0.1.51）、补"按 `level` 累加、**到达预算即停**，预算带小数则向上进位"（v0.1.46 的去等号）、补催波两档 `hpCut`+`cutGap` / 大波 `bigCutGap`（原先只写了 `hpCut` 一句）、补"计时全走游戏时钟，快速模式真实时间折半"
- **怪物**（:59）：`INFO.monster = { atkInterval, atkDamage }` 这个全局表**已经不存在了**（grep 全仓库无 `INFO.monster`），改为按怪读取 `hp` / `threshold` / `atkInterval` / `atkDamage`，并写明 `threshold` 不写时取 `Math.floor(hp / 3)`（`monThreshold`，test.js:183-186）；"按 `bleed` dps 掉血"改成按 `CFG.monster.bleedGap` 每跳掉 `bleedDmg` 点（test.js:1629-1631，是离散 1 点而不是连续 dps）；补"跌破 `threshold` 停止啃食"
- **关卡**（:60）：补 `bgm` / `startMilk` 两项与 `??` 退回 `INFO.bgm` / `INFO.milk.start` 的口径、`startMilk` 只作用于新局与重新开始（v0.1.39 / 0.1.41 / 0.1.42）
- **卡片**（:57）：`life` 从写死的"1s"改回读字段、`burst.radius` 明确单位是**格**且覆盖 `2r+1` 格见方、纵向按脚线认行（test.js:81-95）；三段卡补上"未激活 `charge` 秒 → 出土 `wake` 秒 → 已激活"的实际计时（`armPhase`，test.js:97-102）与"引爆条件是任意怪物贴图与它相交、爆完当帧移除"（test.js:1582-1588）；补产奶前 1 秒金光 `CFG.glow`
- **胜负 / 进度条**（:64）：判胜条件写成"最后一波的怪全部跌破自己的 `threshold`"（test.js:297），进度条补"从第一波起显示""从最后一波往前数 ranks、不够就停在最后一档""越过后从条底抬到条上沿""SYNC 跟 `meter.anim` 平滑值"
- **运行 / 操作**（:11 :19 :21）：存档键名改成 `<关卡 key>`（`LS_PREFIX + state.slot`）并写清只在离开关卡与「重新开始」时写盘、且重新开始会覆盖上一局；顶栏那句"牛奶计数与冷却遮罩"拆开说明；出怪按钮补一条容易踩的实情 —— 手动怪虽然不计入本波血量与胜负，但大波前"场上全空"看的是 `state.monsters.length === 0`，所以它会挡住催波
- **目录结构 / 加内容**：`sounds/` 补第二首（`World's end BLACKBOX.mp3`，实盘确认）、新增 `update_7sRef.md` 一行；"加一只怪"的字段清单补 `level/weight/tier/hp/threshold/atkInterval/atkDamage/flip`；新增"加一关"一步（主菜单两枚关卡按钮在 `scenes/menu.js` 里按 key 写死）；把你 v0.1.45 立的**显式默认值规矩**与"能力开关字段必须整个不写"的例外写进 `> 约定`
- 未动的部分核对下来仍然准确：载入顺序（index.html 四个 `<script>`）、`CFG.W/H` 与 CSS 上限、网格/脚线/`hitDist`/`plantCols 9`/`visibleCols 9.3`、7 张卡 = id 1-6 与 8（7 缺号）、`cdTiers` 三档与 `cdFirst 2/3`、牛奶掉落公式四个常数、`data/` 两份样例档
- 「已知未完成」四条复查后依然成立（`state.notice` 仍只弹"该内容还未开发"，menu.js:41/57；Guy 三态只有 `wake` 段有出土动画），未增删
- 验证：纯文档，无代码改动故不跑语法检查；所有断言按当前文件逐条 grep/读取确认，行号引的是改动前的位置、别的会话再插入代码会继续漂移

## v0.1.51（2026-10-27）
- 大波的额外系数由"再乘一次本波档位"改为**固定 2.5**：`scenes\test.js:256` `budget *= unit` → `budget *= CFG.wave.bigMul`；新增可调常数 `CFG.wave.bigMul: 2.5`（game.js:19，放在 `bigEvery` 之后与其它大波字段挨着）。按"数值进 `CFG` 不写死"的老规矩起了字段名，要的就是字面 2.5 的话说一声我改成常量字面量
- 大波从此是档位的 2.5 倍而不再是**档位的平方**；`cap 8` 也管不着它了 —— 原先上限之所以能压住大波（v0.1.32 那次 81→65），纯粹因为乘的是同一个 `unit`
- 逐波只数（两关倍率 1、怪级别 1，30 波里只有大波变）：第 10 波 16 → **10**、场景1/2 共用的第 20 波 49 → **18**、场景2 第 30 波 64 → **20**；其余 27 波一字不变。全关自然出怪总量 test1 131 → **94**、test2 266 → **185**
- 小预算的新现象：第 20 波预算 = `7 × 2.5 = 17.5`，级别为 1 时 `while (sum < budget)`（v0.1.46 的严格小于）要到 `sum = 18` 才停 ⇒ **实际刷 18 只**，即"预算带小数就向上取整"。想按 17 只（向下取整）得再动那条循环，与 v0.1.46 的口径纠缠，等你发话
- 与上一条（v0.1.50 的整数规矩）无冲突：那条取整的是怪物 `threshold`，这条的 17.5 是**出怪预算**、不是任何显示或存档里的血量数值；刷出的只数仍是整数
- 未改：`div 3 / cap 8 / bigEvery 10` 原值、`isBigWave` 判据、间隔 `first/gapMin/gapMax/bigGap`、催波三档 `hpCut/cutGap/bigCutGap/bigWarnGap`、`spawnMul` 读取
- 验证：`game.js`、`scenes\test.js` 过 `vm.Script`；新旧两版逐波模拟循环复算 30 波并对比，差异只在 10/20/30 三波；确认 `budget *= unit` 全仓库无残留
- 文档滞后累计三处（README.md:60 同一句）：`floor` 应为 `ceil`、"大波再乘一次"应为"再乘 `bigMul` 2.5"、该句也没提按怪 `hp/threshold/atk` 这些新字段 —— 按你的规矩 README 不主动改，等你发话。玩家可感变化已写入 `update_7sRef.md` 顶部新条 **2026-10-27 · 大波倍率改为固定 2.5**

## v0.1.50（2026-10-27）
- 立规矩：**hp 变动相关的数值永远为整数**。这条直接落在唯一能生成分数的地方 —— 上一条的默认临界公式 `mi.hp / 3` 改成 `Math.floor(mi.hp / 3)`（test.js:185）；`chunipenguin` 写的是显式 `threshold: 90`，取整与否对它没有任何影响（`floor(270/3) = 90` 同值），hp 4000 的假想新怪从 1333.33 变成 1333
- 全仓审计过（脚本跑 `Number.isInteger`，不是眼看）：hp 的**入口只有四类减法** —— 自爆 `burst.damage / boom.damage` = 1800、子弹 `INFO.bullets.*.damage` = 20、啃咬 `atkDamage` = 4、掉血 `CFG.monster.bleedDmg` = 1，**全是整数**；hp 上限 `300 / 4000 / 270` 也全整数；`threshold` 只做比较、不改血量。⇒ 现存数据里没有一处会把血量带成小数
- 没加运行时防护：不在 `hp -=` 那四处套 `Math.floor/round` 兜底。这条是你定的**数据侧规矩**（往 info 写数值就得写整数），代码兜底会把未来的小数调参悄悄吞掉、反而看不见 —— 与你"退化式子改数据、不加 fallback 分支"的一贯口径一致。要是你更想在扣血处强制取整（比如让 `atkDamage: 4.5` 也只扣 4），说一句
- 无关项没动：`atkInterval 0.04`、`bleedGap 0.033`、`bulletSpeed`、`hpCut 0.65`（催波比较）、`waveHp` 求和（整数 hp 的和仍是整数）都不是 hp 变动量，保持小数
- 验证：五个 js 过 `vm.Script`；上述整数审计与 `floor(hp/3)` 逐值复算（270→90、4000→1333、271→90、100→33）。未开浏览器

## v0.1.49（2026-10-27）
- **临界值 `threshold` 改为按怪属性**，默认 **总 hp 的 1/3**：`chunipenguin` 按显式默认规矩写 `threshold: 90`（= 270 / 3，与旧全局值同值，info/info.js:148-149 紧接 `hp` 之后，怪物字段 14 → 15）
- 默认公式在读取处实现，不留 `|| 90` 这种写死的兜底：新增 `monThreshold(m) = INFO.monsters[m.type].threshold ?? mi.hp / 3`（test.js:183-186）⇒ 新怪只写 `hp` 也自动获得 1/3 临界；写了 `threshold` 就用它自己的
- `CFG.monster` 去掉 `threshold: 90`（game.js:20），剩下的 `bleedGap / bleedDmg / slow / slowColor / slowAlpha / feet` 照旧 —— **掉血逻辑本身一行没动**，还是每 `0.033s` 扣 `1`
- 四个判定点全部改走 `monThreshold(m)`：胜负判据（:297 最后一波"是否还有未进入临界的怪"）、死亡状态与停止啃食（:1523）、掉血步进的门（:1627）、金牛奶是否被"健康怪"触发发射（:1641）。旧全局值在这四处原本是同一个 90，现在按怪各算各的，一只 270 血的怪结果完全一致
- 提醒一句：默认公式是除法，hp 不是 3 的倍数时会得到小数临界（如 hp 4000 ⇒ 1333.33）。按你的规矩新怪要显式写整数 `threshold`，所以实际数据里不会出现小数；真要依赖默认，就说一句我改成取整
- 存档无影响：`threshold` 不存在怪物实例上（按 `m.type` 现算），旧档读出来照常
- 验证：五个 js 过 `vm.Script`；`CFG.monster.threshold` 与 game.js 里的 `threshold` 字样残留均为 0；`monThreshold` 定义 1 处、调用 4 处；`hp/3 = 90 = threshold` 显式值相等；掉血段复算 70 点 ⇒ 70 × 0.033 ≈ 2.31s 与改动前同。未开浏览器

## v0.1.48（2026-10-27）
- `scenes\test.js:249` 出怪档位 `Math.min(Math.floor(state.wave / CFG.wave.div), CFG.wave.cap)` → `Math.ceil(...)`（按你「所有 floor 改向上取整、范围确认只动波次公式」）；其余 8 处 `Math.floor` 未动（:17 掉奶行、:148/149 鼠标取格、:448 最大余数法、:472 洗牌、:482/:572 卡池行、:854 背景平铺、:1517 怪所在列 —— 那些是下取整的索引语义，改 ceil 会越界或错位，已在提问里列给你并确认不改）
- 档位表随之左移一档：`unit` 由「每 3 波进一档、第 1–2 波为 0」变成「第 1–3 波 1、4–6 波 2、7–9 波 3……」，`cap 8` 的触顶波次从第 **24** 波提前到第 **22** 波
- 逐波只数（沿用上一条的严格小于口径，级别 1 ⇒ 只数 = budget；两关 `spawnMul` 都是 1）：第 1–2 波 0→**1**、4–5 波 1→**2**、7–8 波 2→**3**、11 波 3→**4**、13–14 波 4→**5**、16–17 波 5→**6**、19 波 6→**7**、22–23 波 7→**8**；大波第 10 波 9→**16**、第 20 波 36→**49**；第 3/6/9/12/15/18/21/24–29 波与第 30 波（64 只）不变
- 上一轮的副作用消掉：ceil 后 `unit` 对任何波次恒 ≥1，第 1、2 波不再空场，第一只怪回到第 1 波（开局 19 秒）；`budget = 0` 只能来自 `spawnMul: 0`，而 `while (sum < budget)` 对 0 预算就是不出怪，不再有"靠等号兜底"的隐含依赖
- 自然出怪总量：test1（20 波）99 → **131** 只，test2（30 波）232 → **266** 只（大头是第 10/20 波两次大波从平方档抬到 4²/7²）
- 未改：`isBigWave`、`randWaveGap`、催波三档、`CFG.wave` 的全部常数（`div 3 / cap 8` 原值，只是取整方向变了）
- 验证：`test.js` 过 `vm.Script`；`grep floor` 确认全仓库只剩那 8 处索引用途与 README/日志里的历史文字；逐波 `unit`/`budget`/只数用脚本模拟循环复算 30 波（含两关各自的大波集合），新旧两版并列输出
- 文档滞后新增一处：README.md:60 那句"每波数量预算 `min(floor(wave / div), cap) × spawnMul`"从此与代码不符（应读作 `ceil`）。按你之前的规矩 README 不主动补，等你发话；本轮玩家可感变化已写进 `update_7sRef.md` 顶部新条

## v0.1.47（2026-10-27）
- 怪物的**血量与攻击改成按怪读取**：`INFO.monsters.<key>` 新增 `hp / atkInterval / atkDamage` 三项，`chunipenguin` 按你刚立的显式默认规矩写为 `270 / 0.04 / 4`（info/info.js:145-162，位置排在 `tier` 之后与 `speedMin/speedMax` 之后，字段总数 11 → 14）
- 删掉两个全局兜底：`CFG.monster` 去掉 `hp: 270`（game.js:20，其余 `threshold / bleedGap / bleedDmg / slow / slowColor / slowAlpha / feet` 不动）；`INFO.monster`（单数那一块）**整块删除**，`atkInterval / atkDamage` 已归到各怪自己名下
- 四处读取点改完（没有留 `|| 默认` 的兼容分支，按"数据即事实"的规矩）：出生 `hp: mi.hp`（test.js:194）、起手啃咬计时 `INFO.monsters[m.type].atkInterval / sf`（:1526）、啃咬间隔与伤害在同一帧取一次 `const mi = INFO.monsters[m.type]` 后用 `mi.atkInterval` / `mi.atkDamage`（:1539-1542）
- 数值一模一样 ⇒ 玩家无感：中二企鹅仍是 270 血、每 `0.04` 秒咬 `4` 点（≈100 dps）。没往 `update_7sRef.md` 写（纯数据结构改动，没有可感变化）
- 加新怪现在自带这三项，直接填它自己的数就行；`threshold: 90`（临界值）与 `bleedGap / bleedDmg` 仍是全局的，没做成按怪 —— 你要的只是"攻击与血量"，越界的没动。要临界掉血也按怪，说一句
- 存档：怪物记录里本来就有 `hp`（按实例存），所以读旧档不受影响；`bleedT` 那条仍按上一条的"旧档丢弃"处理
- 验证：五个 js 过 `vm.Script`；`INFO.monster`（单数）与 `CFG.monster.hp` 在 info / test / game 三处引用计数均为 0；`buildLineup` 只造 key 与权重、展示怪不读 hp，无需跟改。未开浏览器

## v0.1.46（2026-10-27）
- `scenes\test.js:254` 出怪循环 `while (sum <= budget)` → `while (sum < budget)`（按你的话只去等号，其余逻辑一行未动）：累加口径从"顶过预算才停"改成"到达预算即停"，级别全为 1 时每波只数 = `budget + 1` → `budget`
- 逐波（两关 `spawnMul` 都是 1）：3–5 波 2→1、6–8 波 3→2、9/11 波 4→3、12–14 波 5→4、15–17 波 6→5、18–19 波 7→6、21–23 波 8→7、24+ 波 9→8；大波 10 波 10→9、20 波 37→36、场景2 第 30 波 65→64。自然出怪总量 test1 119→99、test2 262→232
- **副作用（已实测算出，不是猜的）**：第 1、2 波 `unit = Math.min(Math.floor(w/3), 8) = 0` ⇒ `budget = 0` ⇒ 新条件一次都不进循环 ⇒ **这两波不出任何怪**，旧的 `<=` 正是靠它兜底。第一只怪推到第 3 波（`first 19000` + 两个 `gapMin..gapMax` 25000–31000，约 69–93 秒游戏时钟）。相关判据都不会因此报错：`state.waveHp` 记 0，`waveCutCheck` 的 `hp < 0 * 0.65` 恒假（不误催波）；`m.wave === state.wave` 的血量求和为空；进度条 `shown = state.wave > 0` 照常推进，只是地上没怪。若想让前两波仍各出 1 只，说一声我按 `budget` 抬底或把 `div` 改掉 —— 都是数据/一行的事，等你发话
- `level: 0` 的怪仍会在这条循环里无限刷（`sum` 不增长，与去等号前同样）；现有数据只有 `chunipenguin` 且 `level: 1`，未加防护（v0.1.33 那条说明里已提过一次，保持原样）
- 未改：`isBigWave`、`randWaveGap`、`CFG.wave` 全部常数、`spawnMonster`、胜负与横幅判定
- 验证：`test.js` 过 `vm.Script`；按 `div/cap/bigEvery/spawnMul/waves` 逐波复算 30 波的 `budget` 与只数（脚本模拟循环，非手推）；`grep 'sum <= budget'` 全仓库只剩 `update.md:571` 那条历史文字（按"旧条目留作历史"未改）
- `update_7sRef.md` 新增顶部一条 **2026-10-27 · 每波出怪量：累到预算就停**：写了口径变化、逐波 `旧 → 新`、第 1–2 波归零与其出现时间与催波判据的后果、两关总量；无美术内容，未提像素

## v0.1.45（2026-10-27）
- 立规矩（以后新卡/新怪/新关一律照办）：**我没点名的数据也按默认值显式写进 `info`**，不留给代码兜底；本次先把现存的缺失部分填上
- 卡片补 `immune: false` / `flip: false`（缺省即此，代码见 test.js:1541 `!info.immune` 与 :1077/:1128 传入 `drawPartner` 的 `info.flip`）：`dxbear / milk / Guy / meganekuma / chibimilk` 两个都补，`touchhold` 只补 `flip`（`immune: true` 已有），`ran` 只补 `immune`（`flip: true` 已有）
- 射手补 `shots: 1`（`dxbear`、`meganekuma`；`chibimilk` 已是 2）；子弹补 `slow: 0`（`tap`、`tap2`；`starblue` 的 10 顺手挪到 `damage` 之后，让三颗子弹字段顺序统一成 `damage / slow / img` —— 这是纯排版，你要是想让它回到 `img` 后面说一句）
- 字段位置统一按"通用属性在前、能力块在后"：`… cd, costmilk, immune, flip, <life/burst/place/effect 或 charge/wake/boom/effect 或 produce>, cardImg, ptnImg, scale`；`id` 升序 1-6,8 未动
- **能力门控字段不填默认**：`produce / place / effect / burst / boom / charge / wake / life / bullet / bulletSpeed / atkMin / atkMax` 仍是"缺字段 = 该卡没有这个能力"，代码拿它们当开关（`if (info.charge)`、`if (!CARDS[p.card].info.life) continue`、`info.bullet ? randAtk : 0`，且块内直接取 `.min/.grow/...`），写 `0` 或空对象要么空跑要么抛错。要连这类也显式化就得先改代码的门控写法，等你发话
- 关卡与怪物本轮无缺口：两关九项（含上两条的 `bgm` / `startMilk`）已写全；`chunipenguin` 现有字段 `id/name/level/weight/tier/speedMin/speedMax/flip/img/scale/hitbox` 全是显式的
- 仍然写不进气泡的"数据缺失"：怪物血量与攻击是**全局**的（`CFG.monster.hp = 270`、`INFO.monster.atkInterval/atkDamage`），代码没有按怪读取的 `hp`/攻击字段 ⇒ 我没往怪表里塞 `hp: 270` 那种死数据，要做每怪血量得先加读取逻辑
- 验证：五个 js 过 `vm.Script`；逐字段与"改动前数据 + 默认值"深比对，七卡三弹全部一致（`scale 0.80`、`ran hp 4000`、Guy `charge 15 / wake 0.5 / boom.radius 0.5` 等原值一字未改）；新写入值全部等于代码默认（`shots 1 / immune false / flip false / slow 0`）；能力字段计数未变（produce 1、effect 2、bullet 3、atkMin 3…）；`ids = [1,2,3,4,5,6,8]` 升序
- 文档仍滞后三处：README.md:58（掉血口径）、:59（关卡字段）、:56 之外的卡片字段说明都没提这些默认字段；`update_7sRef.md` 本轮无玩家可感变化（纯数据排版）故未写

## v0.1.44（2026-10-27）
- 修改临界掉血的算法：由"按 dps 累加、每帧 `Math.floor` 一次性扣掉整数点"改成**离散步进 —— 每 `0.033` 秒扣 `1`**。`CFG.monster` 里 `bleed: 30` 换成两个可调字段 `bleedGap: 0.033` / `bleedDmg: 1`（game.js:20），节拍与步长分开，你自己调
- 怪物身上的计时字段随之从 `bleed`（累计伤害）改成 `bleedT`（距上一步已过时间），出生时置 0（test.js:194）；扣血循环 test.js:1620-1628
- 用 `while` 而不是 `if` 结算：单帧时长可能大于 `bleedGap`（菜单外 `dt` 上限 50ms、开了 2× 快进可到 100ms），一帧要补几步，用 `if` 会让余量无限漂移、越慢的机器掉得越慢
- 平均速率几乎不变：`1/0.033 ≈ 30.3/s` 对原来的 30/s。沙箱模拟从临界值走到死（89 点）：60fps 2.950s、50fps 2.940s、30fps 2.967s、20fps 2.950s、10fps 3.000s，实测均值 30.0–30.3 dps ⇒ 观感上仍是约 3 秒化掉，改的是"每次只扣 1"这个粒度
- 差别在低帧率：旧口径 `dt` 大时一帧能扣 2~3 点（`Math.floor` 的 lump），新口径每步固定 1 点、一帧内多步分开结算
- 存档：怪物记录里的 `bleed` 字段名变了 ⇒ 旧档的临界怪 `bleedT` 为 undefined、比较为假就不再掉血（按你既定的旧档丢弃处理，没加兼容分支）
- 没动：`threshold`（90）与死亡状态的其他表现（:1518 停止啃食、`frozen` 锁位、`hp > 0 && x > -60` 当帧移除）；`INFO.monster` 的啃咬参数与子弹伤害也没碰
- README.md:58 那句"低于 `CFG.monster.threshold` 后按 `bleed` dps 掉血"现在是旧口径，:59 的关卡字段清单也仍缺 `bgm` / `startMilk`，两处文档滞后等你发话；`update_7sRef.md` 要不要双写这条同样没动
- 验证：五个 js 过 `vm.Script`；全仓 `bleed` 只剩上表四处引用、无残留 `m.bleed`。未开浏览器

## v0.1.43（2026-10-27）
- 按你「继续把剩余缺失的版本日志补全」把 `update_7sRef.md` 补到**全覆盖**：新增 5 条（都在 Guy 那条之下、按版本号倒序）—— 快速模式/掉落节奏/BGM（v0.0.36-41）、牛奶经济与产奶（v0.0.23-35）、咪璐库与脚底对齐与菜单面板（v0.0.15-22）、出怪按钮与啃食与死亡状态（v0.0.7-14）、首发棋盘与基础战斗（v0.0.1-6）
- 同时补上先前漏掉的 **v0.1.30 三档开局**：在「选卡过场」那条里加了两条（只开打的档 / 只展示不选卡的档 + 卡槽框改在倒计时第 1.0s 随第一瓶金牛奶出现；`needPick()` 那两层判据；当时 6 张卡 = 6 槽所以实际是自动全选），以及在 Guy 那条里加两条（第 7 张卡 ⇒ 选卡界面回来、Guy 落卡池第 5 格；存档按下标存储 ⇒ 中间插卡会静默错换、按旧档丢弃的规矩处理）
- 新增最上面一条 **2026-10-27 · 关卡自带的 BGM 与初始奶量**：覆盖别的会话的 v0.1.39 / 0.1.41 / 0.1.42（test2 换 `World's end BLACKBOX.mp3`、`startMilk` 按关卡、`??` 让 0 是合法值、两关九项写全 ⇒ 行为零变化）
- 三条老规矩照守：UI/美术一句话（`footMargin 12px`、`80px/s`、`1400px/s`、`hitPad 40px`、`break.png 0.7s` 这类不写尺寸的一律改写成"缓慢垂直下落""四周各外扩一个可调余量"）；**判定像素零出现**（v0.0.4 的 `≤40` 命中距离写成"横向距离够近即命中"，没落数）；角色段只有机制与数值，立绘/抠图/锐化（v0.0.18-19、v0.0.23-26、v0.0.20 卡面构图）全部收进 UI 段
- 措辞与归类改动：牛奶那条原先开的 `### 新增角色`（咪璐库在 v0.0.15-22 那条已经登场）改成 数值/逻辑 的第一条，避免同一个角色被当两次"新增"
- 未写进日志的：v0.0.10 / v0.0.11（文档与回滚）、v0.1.36-38 / v0.1.40（README 与本日志自身）—— 没有玩家能感觉到的内容
- 纯文档，**未改动任何 js / 数据 / 图片**

## v0.1.42（2026-10-27）
- 补全关卡数据：`test1` 写进 `bgm: 'sounds/lawnbgm(1).mp3'` + `startMilk: 50`，`test2` 补 `startMilk: 50`（它的 `bgm` 上一条已有）⇒ 两关的 `name / bg / bgm / startMilk / waves / spawnMul / spawnTable / showMonsters / deckSelect` 九项现在全部显式（info/info.js:145-165）。行为零变化，只是把默认值落到数据里；`?? INFO.bgm` / `?? INFO.milk.start` 两层默认仍保留，给以后不写这两项的新关卡兜底
- Guy 的**激活中**机制核对：你要的口径（怪物照常攻击，只是这 0.5s 无敌不吃伤害）**就是现在的实现**，没有改代码。免伤门只拦伤害那一步 —— test.js:1541 `if (!CARDS[m.eat.card].info.immune && armPhase(m.eat) !== 1) m.eat.hp -= INFO.monster.atkDamage`；怪物的停留/啃咬状态由 :1522-1530 的 `m.eat` 决定，那里不看 `armPhase`，所以它仍会停在 Guy 的格子上跑咬合计时与咀嚼动画
- 沙箱按 :1514-1543 原式复跑（dt=1/60、atkInterval 0.04 / atkDamage 4、Guy 贴脸啃）：`15.00 / 15.20 / 15.40` 三点 phase=1、`stopped=true`、hp 三点纹丝不动；`15.50` phase 翻 2 后 `15.60 → 16.00` 掉 8→48 点（≈100 dps）⇒ 无敌窗口只吞伤害，不吞攻击
- 措辞修正两处（问题出在报告描述，不在代码）：`update_7sRef.md` Guy 三段状态第 2 条改成"怪物**照常停下啃它**，咬合一次不少，只是这 0.5 秒 Guy 处于**无敌**、不吃伤害"（原句把"无敌"放在最前面，读起来像"打不到它"）；README.md:56 三段卡那句里的"（期间无敌，带出土动画）"同步改成"（怪物照常啃咬，只是这 0.5s 不吃伤害，带出土动画）"
- 遗留没动：README.md:59 的关卡字段清单仍缺 `bgm` / `startMilk`（上一条也提过），要补说一句
- 验证：五个 js 过 `vm.Script`；两关九项字段枚举一致，`bgm` 两条路径 `existsSync` true

## v0.1.41（2026-10-27）
- 新增两个**关卡属性**（都按"关卡可写、不写走默认"，与本仓库 `showMonsters` / `deckSelect` 缺省即 true 的写法一致）：**默认 BGM** `lawnbgm(1).mp3`（= `INFO.bgm`）与 **默认初始牛奶** `50`（= `INFO.milk.start`）
- 新增 game.js:61-67 两个读取函数：`levelBgm(key) = INFO.tracklist[key].bgm ?? INFO.bgm`、`levelStartMilk(key) = INFO.tracklist[key].startMilk ?? INFO.milk.start`；要给某关单独设值就往那关写 `bgm: '...'` / `startMilk: N`
- 接入调用点：`enterRun()` 取曲目（game.js:143，顺带把上一条的 `||` 换成 `??`）、`makeRun()` 的 `milk` / `milkShown`（game.js:89-90）、`resetRun()` 的 `milk` / `milkShown`（test.js:362-363，重新开始与全景展示后开局都走这里）
- 用 `??` 而非 `||` 是有意的：`startMilk: 0` 是合法值，得能被读出来
- 数据侧没动：`test1` 继续吃默认（lawnbgm + 50），`test2` 只有上一条的 `bgm`，初始牛奶仍是默认 50。若你更想让两关把自己的值显式写全，说一声我补
- 存档无关：`milk` / `milkShown` 本来就在 `SAVE_KEYS` 里，有存档的开局仍按存档值恢复，`startMilk` 只作用于新开与重新开始
- 验证：五个 js 过 `vm.Script`；按两关实测解析结果 `test1 bgm=sounds/lawnbgm(1).mp3 startMilk=50`、`test2 bgm=sounds/World's end BLACKBOX.mp3 startMilk=50`，临时插 `startMilk: 0` 读出 0（已撤销）。未开浏览器
- README 的关卡字段清单（README.md:59）与牛奶一节（:61）从此少这两项，属文档滞后，等你发话再补

## v0.1.40（2026-10-27）
- 按你「往前写10条更新」在 `update_7sRef.md` 回填 **10 条**（Guy 那条之下，按日期与版本号倒序），把 v0.0.42 → v0.1.28 的内容层变化一次补齐：touchhold 与 らん（v0.0.42-50）、断网与卡栏（v0.0.51-60）、主菜单/双关卡/存档/键盘（v0.0.61-72）、金の牛乳瓶（v0.0.73-74）、ちびみるく/めがねっくま/减速/cdFirst（v0.0.75-80）、波次系统（v0.0.81-86）、胜负与大波横幅（v0.0.87-88）、中二企鹅登场与移速随机化（v0.0.91-0.1.2）、选卡过场+开场倒计时+存档落点（v0.1.3-18）、进度条与档位徽标（v0.1.19-28）
- 分节标题改成 `## 日期 · 主题`（原来只有 `## 2026-10-26` 一天一条会撞名），Guy 那条跟着改成 `## 2026-10-26 · Guy 与判定收紧`，内部四类小节与正文一字未动；条目之间加 `---` 分隔
- 三条新规矩在回填里逐条守：UI/美术全部一句话（不出现 107×160、912px、240/24 这类尺寸与位置）；**判定像素一个没写**（v0.0.92 的 `x ≤ 61.9`、v0.0.47 的 ±352px、v0.0.94 的 32.8px、v0.1.25-28 的徽标尺寸全部改写成"按贴图轮廓/按脚线认行/压在条底→抬到条上沿"这种口径）；角色段只留机制与数值，立绘与特效一律挪到 UI 段
- 数值全部按 `update.md` 原文抄的当时值并当场核对：`min(floor(波次/3),8) × 倍率` 与大波乘数带上限后 test2 第 30 波 81→65、催波 65%/3s、大波清场 7s（v0.1.23 才改 9s，所以两条分别写当时值并注明改动）、间隔 19/25-31/52s、rowInit 2、掉奶 `min(n×100+4250,9500)+0~2750`（第 11 个 5.25-8s、第 53 个起 9.5-12.25s 照抄 v0.0.59）、cdFirst 2/3 的 50→33.33 与 30→20、`gmilk.speed` 1600→800（1.2s→2.5s）、过场 0.8→2→1.5 / 1.2→1.5 / 0.9→1.5 / settle 1 / rise 0.3 / count 5、倒计时 2.5/3/3.5/4s、金牛奶 1.0s 起每行 0.1s、`meter.anim 0.6`、`bigCutGap 7000→9000` 与拆出的 `bigWarnGap 7000`
- 未回填：v0.0.1–41（首发棋盘、基础战斗、牛奶经济与自动收集）——要补说一句
- 纯文档，**未改动任何 js / 数据 / 图片**

## v0.1.39（2026-10-27）
- 新增：`INFO.tracklist.test2.bgm = "sounds/World's end BLACKBOX.mp3"`（info/info.js:157，紧跟该关 `bg` 之后）—— 场景2 的关卡内 BGM 字段，mp3 已在 `sounds/` 里（3.9MB）
- 修改：`enterRun()`（game.js:135-139）进关卡时按 `INFO.tracklist[key].bgm || INFO.bgm` 取曲目，和当前 `bgmSrc`（game.js:112 新增的模块级变量）不同才赋 `bgm.src` ⇒ 同一首反复进不重载。仍然只有一个 `Audio` 元素（game.js:110 建一次），没改成每关一个
- 场景1 你没点名 ⇒ 数据未动，走 `INFO.bgm`（:164，现作默认值保留）这条回退
- 顺序说明：先换 `src` 再 `bgm.currentTime = slot.bgmAt`。换源后 `readyState` 归零，此时赋 `currentTime` 按规范是记成"默认播放起点"，新曲载入完成后自动 seek，不会抛错
- 说明：`SAVE_KEYS` 里的 `bgmAt` 只是秒数、不含曲目 ⇒ 换曲后旧存档的续播位置按新曲解释。现有 `data/save_test2.json` 是 `4.84`，不受影响
- 验证：五个 js 过 `vm.Script`；`test1 → sounds/lawnbgm(1).mp3`、`test2 → sounds/World's end BLACKBOX.mp3`，两条 `fs.existsSync` 均为 true；文件名里的引号是 ASCII `'`，路径带空格由浏览器解析时自动转义。未开浏览器，播放效果你自己验
- `update_7sRef.md` 要不要双写这条（换 BGM 是玩家听得到的），等你发话

## v0.1.38（2026-10-27）
- 修改 `update_7sRef.md` 的记录规范（按你这三条）：**UI / 美术也压成一句话**；**关卡 / 角色只写机制与数值、不写美术内容**（立绘与特效归 UI 类）；新增通用禁令 —— **判定范围的实际像素不写**，碰撞箱这类只写缩放系数 `a → b`
- 按新规范重写了 2026-10-26 那条：删掉角色段里的立绘与特效时长、以及所有像素门限（`141.99 / 166.90 / ±100px / 内缩 7.43px / 头顶下沉 22.32px / 间距 230px / 徽标 84→64px` 等）；碰撞箱只留 `1.00 → 0.90` 加"以脚线为锚点、行归属不变"这一句结论；Guy 的 `wake / radius / scale` 不再在数值段重复（当天新增角色，最终值写在角色段）；美术段改成四句一句话条目
- 未改动任何 js / 数据 / 图片

## v0.1.37（2026-10-27）
- 新增文件：`update_7sRef.md`（仓库根），按你给的口径开的**内容层开发日志** —— 四类：数值/逻辑（`a → b` 与触发时机）、修复（一句话症状）、UI/美术（改了哪处、观感差异）、关卡/角色（详列属性与机制）；按日期分节，最新在上
- 分工：本文件继续记实现细节（文件行号、CFG 字段、验证方式），`update_7sRef.md` 只写玩家能感觉到的变化。要不要每条都双写、还是新文件单独维护，等你发话
- 首条回填了 **2026-10-26** 的内容：Guy 的属性与三段机制、`hitbox` 收紧、出土动画、全景阵容散布、进度条徽标缩小与缓动抬起。数值是按**当前** `info/info.js` / `game.js` 复核的（`wake 0.5 / boom.radius 0.5 / scale 0.80`、触碰门限 141.99、爆炸门限 166.90），不是 v0.1.31 那版的 `wake 1 / radius 0.6`
- 未回填 v0.1.30 及更早（牛奶经济、选卡过场三档、断网、金牛奶、胜负与进度条本体、六张老卡的数值史），要往回补说一句
- 本条只新建文档，**未改动任何 js / 数据 / 图片**

## v0.1.36（2026-10-27）
- 新增：**README.md**（项目根），纯文档，**未改动任何 js / 数据 / 图片**
- 内容分节：运行方式与脚本载入顺序（`info → scenes/menu → scenes/test → save → game`，新场景文件要插在 `game.js` 之前）、操作表（点卡槽/`1`~`6`、右键与 `Esc` 取消、`` ` `` 取断网、`出怪`、`菜单` 四个会话内开关）、目录结构、舞台与坐标（2048×1152、`grid.x` 由 `W − visibleCols×cw` 推导、脚线/贴图框 `plantSize`、**判定用贴图框而非格子号**及子弹/啃食/判负线三个例外）、"数据 → 行为"一节（卡片档位、射手与 `bulletSpeed` 单位是格/秒、产奶、自爆卡、三段卡、墙、`flip`／怪物 `speedMin/Max` 与 `hitbox`／关卡三档开局／波次预算与出怪行权重／牛奶掉落公式／金牛奶／胜负与进度条）、加一只怪与加一张卡的步骤、存档按下标存储 ⇒ 中间插卡会静默错位、协作约定（00 严格范围 + update.md 版本号）、已知未完成清单
- 事实核对过再写：`cdFirst` 只对 `slow/very slow` 生效（test.js:392）、`waveGap` 起手 = `CFG.wave.first`（:373）、`randMilkInterval` 与 `min(n×dropStep+dropBase, dropCap)+rand×dropRand` 逐字一致（:5-8）、射手需 `seen`（同视线有怪才开火，:1597）、`shots: 2` 用 `bulletSpread` 上下各一发（:1600-1602）、尸体当帧移除（`x > -60 && hp > 0`，:1630）、金牛奶触发即向右清场（:1632-1643）、导入导出走 `showDirectoryPicker`（save.js:64-95）、`data/` 里是两份导出存档、`images` 实际文件清单
- 版本号沿用：v0.1.36 是你上一条「撤回对像素的改动」腾出来的号（那条的代码与日志条目都已删除）

## v0.1.35（2026-10-26）
- 修复 v0.1.34 我flag的副作用（两只展示怪物叠在一起，抽样重叠率 4.9%、最极端中心距 3.4px）：**全景阵容改成"划格＋格内抖动"**，仍是你说的"随机在各处、不整齐在一排一列、不必落在格子上"，但保证不再叠影
- 做法（scenes/test.js:458-484，替换掉原来那行两个独立 `randRange`）：把随机带按 `nc × nr` 划格，`nc = min(n, ceil(sqrt(n * 带宽 / 场高)))`（当前 n=5、带宽 1110、场高 744 → **3×2 = 6 格**），`nr = ceil(n/nc)`；再把 `nc*nr` 个格子号洗牌，取前 n 个 → **每格至多一只**（6 格里空 1 格，空的哪格每次随机，所以看不出晶格）；每只落在自己格子的中心 ± 抖动量
- 抖动量受钳制以保证间距：`jx = max(0, (cellW - showGap)/2)`、`jy = max(0, (cellR*ch - showGap)/2)`（当前 370×372 的格子 → **±70px、±71px**）。钳制的含义：同排格子的两只横向至少隔 `showGap`，不同排的纵向至少隔 `showGap`，加上"同格不可能"，就覆盖了所有配对
- 新增可调字段 **`CFG.deck.showGap: 230`**（game.js:28，紧挨 `showPad`）= 两只展示怪物中心之间的最小距离（px）。取 230 的理由：企鹅贴图框是 148.66×**223.20**，而矩形重叠要求"横向差 < 148.66 **且** 纵向差 < 223.2"；230 同时超过这两个数，所以**任何两只都不可能有任何像素重叠**（要真正零重叠其实只需 `hypot = 268.2` 的圆形间距，但那样格子的抖动量会掉到 ±51/±52，看起来像随机程度明显不足，所以改用"按轴分别保证"的 230）
- 实测（6000 次抽样 × 各 n）：n=5 → 网格 3×2、最小中心距 **231.4**、同格 0 次、**矩形重叠 0/60000 对**；n=6 → 232.1、0/90000；n=8（4×2）→ 230.7、0/168000；n=12（5×3）→ 222.0（此时 jx 被钳到 0，间距由格子宽 222 决定）、0/396000。抽样的脚线范围 **489.0..1003.0**、中心 x 范围 **2303.0..3183.0**
- 代价（值得你知道）：划格会让随机范围向带内收缩半格，所以展示怪物现在**不再顶到场地最上/最下**（脚线原来是 374..1118，现在 489..1003）也不再贴随机带的左右边缘（2188..3298 → 2303..3183）。想要更大的散布范围就把 `showPad` 调小、想要更像乱跑就把 `showGap` 调小（低于 224 开始出现纵向轻微压叠，低于 149 才会横向叠住）
- 未动：`buildLineup` 前半段的数量分配（`minShow 5` 与按 `weight` 补足到 5 只）一字未改；`monsterBox`/`drawMonster`/阴影照旧（`row` 仍是小数，线性式自动给出格间站位）；`showPad`、过场节奏、真实出怪、`hitbox 0.90`、Guy 的 `scale 0.80` 全部保持 v0.1.34 的值
- 验证：五个 js `vm.Script` 解析通过；上面 6000×n 次抽样是照抄新代码的公式跑的

## v0.1.34（2026-10-26）
- 修改数值：**Guy 的 `scale: 1.00 → 0.80`**（info/info.js:72，唯一改的就是这个字段，`hp/charge/wake/boom/effect/costmilk/cd` 都没动）→ 贴图框从 187.74×186 变成 **150.19×148.80**
- Guy 变小带来的连带（实测）：**触碰门限 |Δx| < 160.77 → < 141.99**（企鹅要更往里走 ~18.8px，按 27~33 px/s 约 0.57~0.70s 才触发）；**爆炸射程不变**（`boom.radius` 是相对自身格中心的 ±0.5 格 = ±100px，与自身贴图大小无关）→ 仍是 ≤ 166.90；于是 v0.1.33 那条只有 6.13px 的"触发者必在爆炸范围内"余量**涨到 24.90px**，安全多了
- 出土动画自动跟着缩：源图裁切仍按 `plantSize(img, info.scale)`，第2行脚线 746 处 `k=0` 画 y **671.6..746**（高 74.4）、`k=1` 画 **597.2..746**（原来是 653..746 / 560..746）；阴影也自动跟着小（`cs.w × CFG.shadow.partner`，`cs` 用的就是同一个 scale）；卡面 `card_Guy.png` 与 1:1 卡面绘制不受影响
- 新增：展示怪物（全景阵容）时**每只随机散布在右侧场景各处**，不再按行取整成整整齐齐的一列。`buildLineup()` 尾部（scenes/test.js:458-462）从 `{ row: i % CFG.rows, x: d.showX + floor(i/CFG.rows) * d.showStep }` 改成 `{ row: randRange(0, CFG.rows - 1), x: randRange(x0, x1) }`，复用现成的 `randRange`（:39-41，浮点均匀），每次进关卡（`beginDeck`→`buildLineup`）重新摇一次
- 随机区域的界定（都用现成常量推出来，没有写死坐标）：**x0 = `grid.x + CFG.cols * grid.cw` = 2188** 即场地的右边缘（种植区只到 1988，所以它们必定落在"右侧场景"），**x1 = `CFG.deck.cam + CFG.W - showPad` = 1400+2048−150 = 3298** 即全景镜头停住时可见区的右边缘往里 150px。**新增一个可调字段 `CFG.deck.showPad: 150`**（game.js:28）替换掉已经没人读的 `showX: 2420` 与 `showStep: 200`（两个字段已删除，全仓库 grep 无残留）
- 行号用小数：`monsterBox` 里 y 是 `cellCenter(m.row).y + CFG.monster.feet` 的线性式，所以 `row = 2.37` 这类取值天然给出格间的自由站位，**不需要改 `monsterBox`/`drawMonster`/阴影任何一行**。实测：脚线范围 **374.0..1117.7**（场地纵向范围 200..1130，永远贴在地面内），最高的头到达 **150.8**（与原来第0行一致，本来就在 `grid.y` 之上一点，不算新现象）；贴图最左 **2113.7**（屏上 713.7，在种植区右边缘 1988 之外）、最右 **3372.3**（屏上 1972.3 < 2048，`showPad 150` ≥ 半宽 74.33 保证整只都在屏内）
- 值得留意的副作用：纯均匀随机**允许两只叠在一起**——4000 次抽样里"最近一对 < 118.9px（贴图宽的 0.8）"的成对概率约 **4.9%**，最极端见过 3.4px（几乎完全重合）。你要的是"不用整齐在一排或一列"，所以我没加任何排斥/抖动逻辑；想避免叠影说一句，我改成按可见区划格再在格内抖动（仍然是随机的、但对角线保证最小间距）
- 未动：`CFG.deck.minShow 5`（还是 5 只）、`cam/hold/panIn/settle/panOut/milkAt/milkStep/milkPan/count/marks/panel/pool` 全部照旧，全景→右移→停顿→拉回→倒计时的节奏没改；`drawFieldBg`、进度条、关卡名、选卡面板、战斗中的真实出怪（仍走 `spawnMonster`，`row` 是整数、`x = CFG.W + 60` 一排进场）完全不受影响；`INFO.monsters.chunipenguin` 的 `hitbox 0.90 / scale 1.20 / speedMin 27 speedMax 33 / weight 4000` 一字未改；`SAVE_KEYS` 与存档无关（阵容不进存档）
- 验证：五个 js `vm.Script` 解析通过；数值核对（场地边界、随机带、脚线与屏内可见性、Guy 三个门限、出土关键帧）见上；全仓库确认 `showX/showStep` 已无引用

## v0.1.33（2026-10-26）
- 新增字段 **`hitbox: 0.90`**（info/info.js:141，紧跟 `scale` 之后，中二企鹅专属，是碰撞箱缩放系数不是贴图缩放）：`scale` 仍然只管画多大，`hitbox` 只管判定多大 —— 你的"判定=贴图范围"这条规矩改成"判定=贴图范围 × hitbox"
- 新增 `hitBox(m)`（scenes/test.js:786-791）：从 `monsterBox` 出发按 `f` 缩放 `w`/`h`，**且以下沿（脚线）为锚点**（`y = b.y + b.h/2 - h/2`），所以贴图仍然贴地、只是头顶矮下去、左右各内缩。实测脚线 `b.y + b.h/2` 在 f=1 / 0.9 / 0.75 下都是 **746.0000**（完全不变），因此**所有"脚线落在哪一行"的判定结果一个都没变**，行归属不受这次调整影响
- 判定改走 `hitBox` 的四处：`burstDamage`（:89 touchhold 到期 AoE）、`boomDamage`（:127 Guy 爆炸）、`touching`（:138 Guy 触碰门限）、`gmilkHit`（:311 金牛奶）。另外红框预览（:1092）也跟着换成 `hitBox` —— 那个框本来就是给你看判定范围用的，留着贴图尺寸会开始骗你
- 仍然走 `monsterBox`（贴图范围）的三处：`resultCheck` 失败线（:288，判的是"身体越过场地左边界 x≤0"，不是两个碰撞箱相撞）、怪物阴影（:646 阵容、:1010 战斗，`w × CFG.shadow.monster` 跟着画走）、`drawMonster`（:813）
- 尺寸变化实测（`enm_chunipenguin.png` 734×1102、`scale 1.20` → 贴图框 148.66×223.20；f=0.90 → 碰撞箱 **133.80×200.88**）：**左右各内缩 7.43px，头顶下沉 22.32px，脚不动**
- 各判定的门限变化（|Δx| 都指怪物中心 vs 参照中心）：Guy 触碰 **< 168.20 → < 160.77**（要再往里走 7.43px 才触发）、Guy 爆炸命中 **≤ 174.33 → ≤ 166.90**、touchhold 爆炸区左右沿外的余量 **74.33 → 66.90**、金牛奶命中半宽和 **148.73 → 141.30**。7.43px 相当于企鹅以 27~33 px/s 多走 **0.225~0.275s**
- 好消息：Guy 的"爆炸范围 ⊃ 触发者"这条**不受影响**——触碰与爆炸两个门限都含"怪物半宽"这一项，相减抵消，余量恒为 `radius*cw - Guy画宽/2 = 6.13px`，改 f 前后一样
- 完全没被这次调整影响的（用的不是碰撞箱，若你想动它们得单独发话）：**子弹命中**走 `m.row === b.row` + `Math.abs(b.x - m.x) <= CFG.hitDist`（40px，纯中心距离，游戏.js:22）；**怪物啃食**走 `Math.floor((m.x - g.x)/g.cw)` 格子取整找植物；**失败线**如上；**牛奶瓶点击** `CFG.milk.hitPad`。也就是说想让子弹更早/更晚命中，旋钮是 `CFG.hitDist`，不是 `hitbox`
- 素材实测（供你定 `hitbox` 用）：`enm_chunipenguin.png` 的透明留白是 **左 13.8%、右 7.9%、上 0%、下 3.3%**，可见身体只占贴图框的 **宽 78.3% × 高 96.7%**，且可见身体的中心比贴图框中心偏右 **4.25px**。所以 0.90 只是"略微收紧"，离"贴合剪影"（约 0.78）还有一半距离；要严格按剪影，把 `hitbox` 调到 0.80 左右即可，但因为留白左多右少，纯对称缩放仍会在左边多留 5.9px
- 未动：`scale 1.20` 与两张 png 素材文件、`CFG` 其余字段、`SAVE_KEYS`（碰撞箱纯派生自 `m.x/m.row` + info，没有新增状态字段，存档无影响）、Guy 的 `wake/radius/charge`、断网/生产/选卡过场全部照旧
- 验证：五个 js `vm.Script` 解析通过；单独跑 `monsterBox → hitBox` 的公式核对了脚线不变性与各门限数值

## v0.1.32（2026-10-26）
- 修改数值（info/info.js:67-68）：**`wake: 1 → 0.5`**（激活耗时）、**`boom.radius: 0.6 → 0.5`**（爆炸半径，仍以 `g.cw` 为单位，即 ±100px 而非 ±120px）；`charge 15 / boom.damage 1800 / hp 300 / effect` 一个没动
- 新增激活动画（`emergeRatio()` scenes/test.js:104-110、`drawEmerge()` :112-115、绘制入口 :1044-1045）：有 `charge` 字段的卡走 `drawEmerge`，其余卡仍走原来的 `drawPartner`，所以别人的外观一字未变
- 动画口径：**未激活（phase 0）只显示图片上半部分且紧贴地面；激活那 0.5s 内下半部分逐渐"出土"；已激活（phase 2）与原来完全一致**。实现是一次源矩形裁切：可视比例 `v = (1 + k) / 2`，把 `img` 的第 `0 .. height*v` 行画到 `(c.x - s.w/2, feetY - s.h*v, s.w, s.h*v)` —— 宽高同比缩，所以**缩放系数恒定（`s.h / img.height`），没有任何拉伸变形**，纯裁切
- 关键帧实测（`ptn_Guy.png` 1080×1070、`scale 1.00` → 整只 187.74×186，第2行脚线 `feetY = 746`）：`k=0` → 源第 0..535 行画在 y **653..746**（高 93，图的正中线贴地）；`k=0.5` → 第 0..803 行画在 y **606.5..746**；`k=1` → 第 0..1070 行画在 y **560..746**，与原来的 `drawPartner(c.x, cy, 1, ...)` **逐像素重合**。裁切下沿（贴地那一行是图的第 `1070*v` 行）随 k 从身体中线向脚底推进，看起来就是从土里升起来
- `k` 由 `smooth((p.armT - charge) / wake)` 给出，复用现成的 `smooth()`（相机/面板/进度条同一个缓动），phase 0 恒为 0、phase 2 恒为 1，所以**没有新增状态字段**，`armPhase` 那三态与 `armT` 计时一行没改
- 无敌窗口随 `wake` 自动变短（0.5s）：免伤条件仍是 `armPhase(m.eat) !== 1`（:1509），没写死秒数。沙箱实测 30 帧采样 k = 0.000 / 0.104 / 0.352 / 0.648 / 0.896 / 0.997，整段期间 hp 稳定 204 不掉血，15.50 那一帧 phase 1→2 且 k 到 1.000
- 数值连带（值得留意）：半径缩到 0.5 格后，爆炸命中门限从 |Δx| ≤ 194.3 变成 **≤ 174.33**（±100 + 怪物半宽 74.35），而触碰门限是 **< 168.2**（Guy 画宽 187.74 与企鹅 148.7 半宽之和），**留给"触发者自己也在伤害范围内"的余量只剩约 6px**。当前是安全的（爆炸仍在触碰之后同帧结算，`boomDamage` 还会遍历全部怪物，所以擦边进来的怪一样被算进去），但 `boom.radius` 再往下调就会打不到触发它的那只
- 未动：`burst` / `touchhold` 那套判定与半径语义、`place` 出场切角动画、阴影（仍按卡面宽画在脚线上，`k=0` 时贴地的上半身与阴影是同一条线，看着是对的）、`charge` 计时与 `armT` 存档字段、生产牛奶 / 子弹 / 金牛奶 / 断网、`CFG` 与 `SAVE_KEYS`；`ptn_Guy.png`、`Guy_boom.png` 两张素材文件都没碰（`Guy_boom.png` 仍全不透明，抠不抠等你发话）
- 验证：五个 js `vm.Script` 解析通过；vm 沙箱 16.7ms 步进复跑（Guy 第2行第4列，四只冻结企鹅在 t=14 摆好）—— t=15.00 phase 0→1、hp 204 → 15.50 phase 1→2 同帧爆炸，A(|Δx|=60) / D(170) / E(174) 被 −1800 移除，B（第1行、|Δx|=60）与 C（第2行、|Δx|=220）hp 270 未受影响，特效仍登记 `{grow 0.7, hold 0, fade 0.3}` 一格宽

## v0.1.31（2026-10-26）
- 新增伙伴（info/info.js:60-73，插在 id4 らん 与 id6 めがねっくま 之间保持 id 升序）：`Guy` **id 5 / hp 300 / cd slow / costmilk 25**，无攻击字段（不放 bullet/atk，现有的能力门控循环自动跳过）；素材你已经放好，实测 `card_Guy.png` 1080×1282、`ptn_Guy.png` 1080×1070、`Guy_boom.png` 1024×1024
- 新增机制字段三个（都在这条卡里，你后续自己调）：**`charge: 15`**（放置后未激活的秒数）、**`wake: 1`**（激活耗时，期间无敌）、**`boom: { damage: 1800, radius: 0.6 }`**（触碰触发的一次本行爆炸），外加 **`effect: { img: Guy_boom.png, grow: 0.7, hold: 0, fade: 0.3, scaleFrom: 1, scaleTo: 1 }`** —— 总时长 1s、最后 0.3s 淡出，尺寸没有点名所以按 `scale 1` 即一格宽（200×200）画
- 新增 `armPhase(p)`（scenes/test.js:97-102）：`0` 未激活 / `1` 激活中 / `2` 已激活，纯按 `p.armT` 与 `charge / wake` 推出来，没有新增状态机变量；无 `charge` 字段的卡直接返回 2，所以老卡行为一字不变
- 新增植物计时（:1369 push 里加 `armT: 0`，:1516 `if (CARDS[p.card].info.charge) p.armT += dt`）—— 跟着 `dt` 走，所以暂停/菜单不推进、快速模式 ×2；`armT` 随植物对象整体进存档（plants 本来就是全字段序列化），`SAVE_KEYS` 一字未改
- 修改咬伤判定（:1495）：`!info.immune && armPhase(m.eat) !== 1` —— 只有激活那 1s 免伤，**15s 未激活期间照常挨咬**（实测 300→204 掉 96 点，正好 0.96s × 100 dps）；怪物在激活期间仍会停下咬他，只是不掉血
- 新增触碰与爆炸（`touching()` :122-132、`boomDamage()` :104-120、触发循环 :1530-1538 紧跟原有 `life` 循环）：`armPhase === 2` 且本行有怪物贴图接触 → `spawnEffect(p); boomDamage(p); splice` 三件套（与 touchhold 到期同一形状）。判定按你定的口径 —— **x 用双方贴图框相交**（Guy 画 187.7×186、企鹅画 148.7×223.2 → 接触门限 |Δx| < 168.2），**y 用脚线落在本行带内**（第2行 y 572..758，上下行脚线都在带外）。爆炸范围是**以自身格中心 ±0.6 格 = ±120px** 的矩形，配合怪物半宽 74.4 → 实际命中 |Δx| ≤ 194.3；`burst`（touchhold 那套 ±半径格 + 上下行）完全没动
- 边界：接触门限 168.2 小于爆炸命中半径 194.3，**触发者自己一定在伤害范围内**；`touching` 不筛 `hp >= threshold`，所以正在流血的怪也算触碰（与子弹 `hit` 一致，金牛奶的 `hp >= threshold` 是另一套）；被咬死（hp≤0 过滤）或断网移除时不放特效不掉爆炸（断网那条路只有 `splice`，:1328-1330）
- 连带效果：`CARDS.length` 现在是 7 > `CFG.cardSlots` 6 → **v0.1.30 的特殊情况不再命中，`needPick()` 变回 true，两个关卡的选卡界面重新出现**（选 6/7）；选卡池按 id 排布，Guy 落在第 5 格（原来那格是空的）
- 存档提醒（未处理）：Guy 插在数组下标 4，原来的 めがねっくま/chibimilk 顺移成 5/6 —— **v0.1.31 之前的存档里记的是 CARDS 下标**，读回来会静默错换成别的伙伴（校验只看下标是否越界，发现不了）。按你的规矩旧存档直接丢弃：进游戏点（重新开始）或清一次 localStorage 即可；要真正解决得把存档改成 id，等你发话
- 提醒（未处理）：`Guy_boom.png` 实测 **1024×1024 全不透明**（四角 RGBA (78,3,7)/(131,22,25)/(203,18,16)/(204,2,14)、中心 (237,201,42)），而 `cp.png`/`touchhold_border.png` 四角都是 alpha 0 —— 现在这样直接画会是一个 200×200 的实心方块盖在场地上，淡出时整块变淡。要抠掉底色我可以照 `_face_guy.py` 那套管子做一张透明的，你说一句再动
- 未动：`burst` / `place` / `life` / `immune` / 生产牛奶 / 子弹 / 金牛奶 / 断网 全部照旧（回归实测：touchhold 仍 1s 到期、免疫不掉血、3×3 爆掉 60px 外那只）；`CFG` 与 `SAVE_KEYS` 一字未改；`ptn_Guy.png` 与两张 png 素材文件我都没碰
- 验证：五个 js `vm.Script` 解析通过；vm 沙箱里 16.7ms 步进跑完整局 —— t=14 把四只企鹅放到 Guy 周围 → 15.00 phase 0→1（Guy hp 204）→ 16.00 phase 1→2 同帧爆炸：Guy 消失、A(dx60)/D(dx190) hp −1530 被移除、B(同一 x 但在第1行) 与 C(dx320) hp 270 未受影响、特效登记 `{grow 0.7, hold 0, fade 0.3, scaleFrom 1, scaleTo 1}` 画 200×200 于 (1088, 665)、1.0s 后自动清除

## v0.1.30（2026-10-26）
- 新增判定：`needPick()`（scenes/test.js:413-415）= `deckSelect !== false && CFG.cardSlots < CARDS.length` —— 把"要不要手动选卡"从单个开关变成两层：关卡声明要选卡 **且** 卡槽数少于可选卡数才进选卡界面
- 修改 `beginRun()`（:417-423）按三档分流：`showMonsters === false` → 只 `playBgm()`，`deckPhase` 保持 null，**进关卡即真实开始**（无全景/右移/拉回/倒计时）；否则 `beginDeck(needPick())`
- 修改 `beginDeck(pick)`（:425-435）：`pick` 为真仍 `emptyDeck()` 等你选；为假则 `fullDeck()` —— 卡槽自动填满所有可选卡、按 id 升序（实测 `[0,1,2,3,4,5]` → id `[1,2,3,4,6,8]`，即 info.js 里 cards 的排列），`state.cool = deckCool(state.deck)` 与 resetRun/重新开始 那条路完全同一个算法。原来 `lineup` 那行按 `showMonsters` 的三元判断已不需要（不展示怪物根本不会走到这里），直接 `buildLineup()`
- 修改过场状态机（:451）：`in` 段结束（`hold 1.5 + panIn 1.5 + settle 1` = 4.0s，全景→右移→停顿一个没少）时按 `needPick()` 决定去 `pick` 还是直接去 `out`。所以"展示怪物但不选卡"= 4.0s 停顿后立刻拉回 1.5s，再 5s 倒计时，总 10.5s，与原来手动点「开始游戏」之后的那一段完全一致
- 修改绘制门限（:603 `if (!needPick() || state.deckPhase === 'in') return;`、:1042 `if (state.deckPhase !== 'count' || needPick() || state.deckT >= CFG.deck.milkAt) drawTopHud(false);`）：跳过选卡时整段过场（全景/右移/停顿/拉回）**只画场地＋阵容**，没有选卡面板，也没有战斗卡槽框；卡槽框（连顶栏）改在 `count` 段 `deckT >= CFG.deck.milkAt = 1.0s` 那一帧出现 —— 正是第一瓶金牛奶开始从屏幕左外滑进 `gmilkRestX()` 的那一帧（此前它 `x = -w/2`，整瓶在屏外）
- 特殊情况已经生效：`CFG.cardSlots = 6`（game.js:11）、`CARDS.length = 6`（info.js cards 六个 id 1/2/3/4/6/8）→ `6 < 6` 不成立，**test1 与 test2 现在都走"跳过选卡"这一档**，选卡面板不再出现；等你加第 7 张卡（或把 cardSlots 调到小于卡数）它自动回来，不用改代码
- 未动：`in/out/pick/count` 四段的既有参数（`CFG.deck` 的 hold/panIn/settle/panOut/milkAt/milkStep/milkPan/count/marks 3-2-1-START!）、要选卡那一档的完整流程（面板、飞行动画、点卡/移除、开始游戏按钮灰掉的条件、读条期间 HUD 照常显示）、`fullDeck/emptyDeck/deckCool` 本体、金牛奶滑入与 `resetGmilks`、`playBgm()` 仍在倒计时末尾（真实开始才起 BGM）、进度条与关卡名（`!state.deckPhase` 门限照旧，倒计时里不出现）；`info.js` 两个关卡的 flag 一个字没改，没有关卡违反"只有展示怪物为 true 时才能需要选卡"；无新增状态字段，`SAVE_KEYS` 一字未改
- 验证：五个 js 文件 `vm.Script` 解析通过；用 vm 沙箱把四档各跑一遍 16.7ms 步进 —— A（deckSelect=true，6槽/6卡）与 B（deckSelect=false，展示怪物）轨迹相同：`in`@0.02 → `out`@4.02 → `count`@5.53 → 卡槽框@6.53（deckT=1.00）→ LIVE@10.55，deck 自动 `[0..5]`、`cool=[0,0,33.3,20,0,0]`；C（showMonsters=false）`beginRun()` 后 `deckPhase` 直接 null、lineup 空；D（临时加第 7 张卡）`in`@0.02 → `pick`@4.02（面板与 HUD 都照旧可见）→ `out` → `count` → LIVE，选卡档行为与改动前一致

## v0.1.29（2026-10-26）
- 新增素材：`images\partners\ptn_Guy_face.png` **939×952 RGBA** —— 按你这条指令把 `ptn_Guy.png` 的背景改成透明、只留人脸。**原图 `ptn_Guy.png` 一字未动**，你看过没问题我再改名覆盖过去
- 保留范围：整个头部（头发＋脸）。去掉的是背景（楼房/天空/地面/右侧栏杆）、下方的脖子与肩膀衣服，以及 1071..1281 那段"我没意见"黑底字幕；顶部 0..1 两行是原图自带的黑边，一并裁掉。头发算头部轮廓的一部分没有单独抠掉——要只留五官不含头发，说一句
- 抠图管线（脚本 `_face_guy.py`，只用 PIL＋numpy，本机没有 cv2 / scipy / rembg 可用）：
  1. `T=130` 亮度阈值取暗部 —— 头发比虚化的背景暗得多，整圈头发连成最大连通块
  2. 逐行把该连通块从最左暗像素填到最右暗像素，这样亮色的额头/脸/眉眼被头发圈自动补上；连通块底部是开口的（下巴以下不封闭），所以不能用"挖洞"法
  3. 边缘修整：`RIGHT_CAP=1000` 掐掉右侧栏杆（头在任何一行都没真到过 1000 以右，实测最远 995）；`GAP=30 / SLIVER=60 / WIN=150` 处理细条状污染 —— 某行端头若先遇到 ≥30px 的亮带、亮带外侧的暗段又 ≤60px，判为背景碎条削掉
  4. 左右轮廓按行做 `half=4`（9 行）中值滤波，再 25 闭运算 ＋ 17 开运算去掉发丝尖刺和凹缺口
  5. 下沿按下颌控制点折线切（原图坐标 `(x, 切到的 y)`）：`(0,905)(300,905)(350,882)(420,905)(500,940)(560,952)(640,935)(720,900)(780,872)(830,882)(900,905)(1080,905)` —— 想留脖子就把中段几个 y 调大
  6. 边缘羽化：`GaussianBlur(1.6)` 后按 `(a−40)×255/175` 重映射，半透明环 10576 px，不是一刀硬边
  7. 按内容包围盒裁切输出
- 验证（按数值不看缩略图，Read 的预览会把透明合成成白底）：四角 alpha 均为 0、中心 255；全透明 232943 / 全不透明 650409 / 半透明 10576 px；另在深灰与纯绿底各合成检查过边缘无杂色溢出
- 已知残留：右侧鬓发下方（原图 y≈780–830）头发本来就向内收，轮廓在那里有一处台阶，是发型真实形状不是抠错；顶部发丝被原图画框平切

## v0.1.28（2026-10-26）
- 修改：`CFG.meter.mark.dyDone` −12 → **−30**（game.js:17）—— 抬升幅度从 6px 增加到 **24px**（徽标内容高 43.9px，约为其一半多，视觉上从"贴着条"变成"骑在条上沿"）
- 修改：抬升由瞬移改为**缓动**（scenes/test.js:1084-1087）—— 循环里新增 `const k = w < state.wave ? 1 : w === state.wave ? u : 0;`，纵坐标改为 `cy + mt.mark.dy + (mt.mark.dyDone - mt.mark.dy) * k`
- 关键：**复用了 v0.1.22 那个 `u`**（:1072 `smooth(min(1, (state.clock - state.lastSpawn) / (mt.anim * 1000)))`），没有新增状态、没有新增曲线、`SAVE_KEYS` 一字未改。因为 `u` 正是"sync 圆徽从 (w−1)/waves 走到 w/waves"的同一个量，所以**徽标抬起完成的瞬间就是 sync 走到该徽标正下方的瞬间**，v0.1.27 提醒过的"徽标比重标早 0.6s"自动对齐；`u` 本身已经是 `smoothstep` 过的，直接拿来插值，不做二次缓动
- 实测轨迹（`anim` 0.6s，内容下沿）：0ms k=0 → 1140.0（压在条框底边）；150ms k=0.16 → 1136.3；300ms k=0.5 → 1128.0；450ms k=0.84 → 1119.8；600ms k=1 → **1116.0** 并保持。终态内容占 y 1072.1..1116.0、图框 1058.4..1122.4（屏 1152 内，上方无遮挡）；下沿 1116.0 比进度内腔顶 1114.8 只低 1.2px，即"坐在条上"
- 三态划分：`w > state.wave`（还没打到的大波）k=0 压在条底；`w === state.wave`（刚出怪的这一波）k 随 `u` 缓动上行；`w < state.wave`（更早的大波）k=1 恒在高位 —— 下一波出怪时上一波的 k 已经是 1，所以不会回头抖动
- 边界：读档回来时若 `state.clock - state.lastSpawn` 已超过 0.6s，`u` 直接钳到 1 → 该徽标一进场就是抬起态，不重播动画；快速模式 `dt ×2` 下动画跟游戏时钟走，真实时间 0.3s（与绿条同步）；菜单/暂停/胜负弹窗打开时 `updateGame` 被 loop 跳过、`clock` 不前进 → 抬升停在当前高度，回来后继续
- 未动：`mark.h / src / pivot / dy`、sync 的 `h / pivot / dy` 与其跟随 `pct` 的规则、档位阶梯 `ranks`、横坐标映射 `fx + fw * (1 - p)`、进度条出现条件 `state.wave > 0`、`CFG.wave`（含 v0.1.24 拆出的 `bigCutGap` / `bigWarnGap`）全部照旧
- 验证：五个 js 文件 `vm.Script` 解析通过；上面轨迹与终态像素按新 CFG 复算

## v0.1.27（2026-10-26）
- 修改：`CFG.meter.mark` 由单个 `dy: -12` 变成两个偏移 —— **`dy: -6`（未触发）+ `dyDone: -12`（已触发）**（game.js:17）。`h / src / pivot / ranks` 与 sync 那组一个字未改
- 新增规则（scenes/test.js:1086）：画每个大波徽标时按 `state.wave >= w ? dyDone : dy` 取纵向偏移 —— 也就是**这一波还没出怪时徽标压在条底，出怪那一刻抬回原位**。`state.wave++` 与 `spawnWave()` 在同一帧（:1348-1352），所以抬升就发生在大波刷出的那一帧；读档回来的局 `state.wave` 已 > 若干大波，那些徽标一进场就是抬起态
- 实测（`s = 64/140 = 0.4571`，条框 y 1108.1..1140、竖直中线 cy=1124.1）：未触发态内容占 y 1096.1..**1140.0**，下沿正好落在条框底边；已触发态内容占 y 1090.1..1134.0，即 v0.1.26 的原位，**上移 6px**。两态图框（含透明边与淡阴影）分别是 1082.4..1146.4 / 1076.4..1140.4，都在 1152 屏内
- 说明一：位移只有 6px，是因为 v0.1.26 缩小后"原位"本身已经离条底很近。想让"已触发"抬得更明显，只调 `dyDone` 一个数（例如 −24 → 抬 18px），我没有擅自加大
- 说明二：抬升时机按你说的"出怪后"取的是**出怪那一帧**，而 sync 圆徽走到该徽标横位置还要 `CFG.meter.anim` 0.6s（缓动），所以严格讲徽标会比重标早抬起 0.6s；另外抬升是瞬移，没有做补间动画。要"等 sync 走到再抬"或"抬升也缓动"，说一句
- 未动：进度条出现条件 `state.wave > 0`、`pct` 算法与缓动、从右往左的裁切、档位阶梯 `ranks`、sync 的 `h / pivot / dy`、关卡名称让位、`CFG.wave` 全部照旧；无新增状态字段（判定只读已有的 `state.wave`），`SAVE_KEYS` 一字未改
- 验证：五个 js 文件 `vm.Script` 解析通过；上面两态像素数按新 CFG 复算

## v0.1.26（2026-10-26）
- 修改：进度条上两组图标的尺寸一起缩小（game.js:17）—— `CFG.meter.mark.h` 84 → **64**（×0.762）、`CFG.meter.sync.h` 62 → **47**（×0.758）。只动这两个数，`src` / `pivot` / `dy` / `ranks` 与绘制代码（scenes/test.js:1081-1088）一字未改
- 新几何（缩放 `mark 64/140 = 0.4571`、`sync 47/80 = 0.5875`；条框仍 y 1108.1..1140、竖直中线 cy=1124.1）：档位徽标图框 51.2×64、可见内容 **38.9×43.9**（原 51×57.6），内容占 y 1090.1..1134.0；sync 圆徽内容 **35.8 见方**（原 47.3），占 y 1106.1..1142.0 —— sync 现在上下各只出条框约 2px，几乎与条同高，读起来更像"骑在条上的游标"
- 位置不变：横坐标映射 `x = fx + fw * (1 − p)` 与 `p` 的算法都没碰，所以各档位的落点与 v0.1.25 完全一致（test1 → 1772.4 SSSp / 1892.3 SSS；test2 → 1772.4 / 1852.3 / 1932.3），缓动照旧
- 顺带解掉两处 v0.1.25 提醒过的挤压（未加任何避让代码）：假想 waves 60 时相邻大波间距 40px 现在**大于**徽标内容宽 38.9（原 51 会压住，余量 −1.2 → +1.1）；最左端 SSSp 的内容左沿从 1746.9 收到 1753.0，与关卡名称右沿 1748 之间空出 5px（原来是重叠 1px）
- 说明：因为锚点是"内容中心固定"，缩小后徽标内容下沿落在 y=1134.0（比原来的 1140.9 抬高 6.9px，正好贴着进度内腔底线 1133.3），不再是压在条框底边上。想让下沿回到条底 1140，把 `mark.dy` 从 −12 调到 **−6** 即可（一个数的事，未按要求擅动）
- 未动：出现条件 `state.wave > 0`、`pct` 与 `smooth()` 缓动、从右往左的裁切、`w / padX / padY / gap / frame / fill / inset`、关卡名称让位、`CFG.wave` 全部照旧；无新增状态、`SAVE_KEYS` 一字未改
- 验证：五个 js 文件 `vm.Script` 解析通过；上面像素数都是按新 CFG 复算的

## v0.1.25（2026-10-26）
- 新增素材（他放进 `\images\others` 的 7 张，PIL 实测）：`sync.png` 80×80（SYNC 圆形徽标，alpha≥128 的内容占 (9,9)..(70,70) 即 61×61，几乎正好居中，外圈 rows 0..5 / 72..79 只有 alpha=1 的噪点）；`UI_MSS_Allclear_Icon_{SSSp,SSS,SSp,SS,Sp,S}.png` 各 112×140，**六张的内容 bbox 完全一致** (13,30)..(98,126) = 85×96、内容中心在 (55.5, 78)，图框上下沿的 25..29 / 126..136 是淡出阴影（alpha 25→1）
- 新增预加载（game.js:255-256）：`imgs.sync` 一张 + `imgs.allclear_<档位>` 六张（键名 = `allclear_` + 档位字符串，紧跟 v0.1.20 的 flag_meter）
- 新增可调字段（都挂在 `CFG.meter` 里，game.js:17）：`sync: { h: 62, src: [80, 80], pivot: [39.5, 39.5], dy: 0 }`、`mark: { h: 84, src: [112, 140], pivot: [55.5, 78], dy: -12 }`、`ranks: ['SSSp','SSS','SSp','SS','Sp','S']` —— `h` 是**整张图**（含透明边）画到屏幕上的高度，`src` 是源图尺寸，`pivot` 是源图上的锚点像素（就是上面量出的内容中心），`dy` 是相对进度条竖直中线的偏移（负=往上）
- 新增绘制（scenes/test.js:1081-1088，接在框与进度两条 `drawImage` 之后，所以**徽标盖在进度条上方**、sync 又盖在徽标上方）：先按波次从后往前遍历 `isBigWave(w)` 逐个画档位徽标，最后画 sync
- 位置口径：与进度条**完全同一套坐标** —— 条上比例 p 对应的横坐标是 `fx + fw * (1 - p)`（v0.1.21 定的"从右往左长"，所以 p=0 在最右 2012.3、p=1 在最左 1772.4）。大波徽标取 `p = w / waves`，即"进度正好走到那一波时 sync 所停的位置"；sync 取 `p = pct`，也就是 v0.1.22 那个含 `smooth()` 缓动的显示值，**所以它与绿条前沿同步移动、同步缓动**，不是按整数波跳格
- 档位规则（`ranks` 数组 + `Math.min(rank++, ranks.length - 1)`）：从**最后一波**往前数，第 1..6 个大波依次取 `SSSp / SSS / SSp / SS / Sp / S`，第 7 个及更多一律停在末位 `S`。实测 test1（waves 20，大波 10/20）→ 20 波 SSSp 落在 x=1772.4（条的左端）、10 波 SSS 落在 1892.3（正中）；test2（waves 30，大波 10/20/30）→ 1772.4 SSSp / 1852.3 SSS / 1932.3 SSp；假想 waves 60 → 六个大波依次 1772.4/1812.4/1852.3/1892.3/1932.3/1972.3，档位 SSSp/SSS/SSp/SS/Sp/S
- 实测几何（`sc = 260/155 = 1.6774`，条框 y 1108.1..1140、竖直中线 cy=1124.1）：徽标缩放 `84/140 = 0.6` → 图框 67.2×84、可见内容 51×57.6，`dy: -12` 后内容占 y 1083.3..1140.9（**下沿正好压在进度条底边 1140 上**，淡阴影到 1147.5，全部在 1152 之内）；sync 缩放 `62/80 = 0.775` → 内容 47.3 见方，`dy: 0` 即竖直居中于条，内容占 y 1100.4..1147.7（上下各出条约 7.7px，圆盖在条上）
- 说明：徽标只画在 `shown`（`state.wave > 0`）分支内，**与进度条同时出现**；手动点「出怪」不推进 `wave`，既不动 sync 也不影响档位
- 提醒（未处理）：`mark` 内容宽 51px，若某条关卡大波数到 6 个以上（如 waves 60 时间距仅 40px）徽标会互相压住，要挤开就调小 `CFG.meter.mark.h`；另外最左端 SSSp 的内容左沿 1746.9 与关卡名称右沿 1748 只差 1px，名称再长一点会蹭到
- 未动：进度条的出现条件、`pct` 算法与缓动、从右往左的裁切、`w / padX / padY / gap / frame / fill / inset`、关卡名称的让位规则、`CFG.wave` 全部照旧；无新增状态字段，`SAVE_KEYS` 一字未改
- 验证：五个 js 文件 `vm.Script` 解析通过；上面所有尺寸/坐标/档位都是按新 CFG 与 PIL 量出的内容 bbox 算出来的

## v0.1.24（2026-10-26）
- 新增可调字段：`CFG.wave.bigWarnGap: 7000`（game.js:19）—— 大波预警横幅的触发门限，值就是 v0.1.23 拆分前 `bigCutGap` 的那个数
- 修改：`waveWarnCheck()` 改读新字段（scenes/test.js:231 `剩余 > CFG.wave.bigWarnGap` 就 return），不再借用 `bigCutGap`；`waveCutCheck()` 的大波分支仍读 `bigCutGap: 9000`（:221），**清场后 9s 落大波这个 v0.1.23 的结果保持不变**
- 效果：两个语义彻底分开 —— `bigCutGap` = 清场后大波的提前量，`bigWarnGap` = 横幅出现的剩余时间条件。现在无论走哪条路径，「一大波敌人正在靠近」都只在**倒计时剩 7s** 时弹出；v0.1.23 那条"横幅跟着提前 2s"的连带变化被这一条抵消，报警时机回到 v0.1.22 及以前的表现
- 逐帧模拟（16ms 步长，`bigGap` 52000，一次只测一个清场时刻）：不清场 → 45008ms 弹横幅（剩余 6992ms）/ 52016ms 出波；20000ms 清场 → 剩余被钉到 9000，22000ms 弹横幅（清场后 2s、出波前 7000ms）、29008ms 出波（清场后 9008ms）；48000ms 清场（剩余仅 4000，压不动）→ 仍在 45008ms 弹过、52016ms 出波；51500ms 清场同理。可见横幅恒为"剩 7s"，出波提前量仍是 9s，两条不再互相牵动
- 边界说明：清场时剩余本就 ≤ 7000（最后一刻才灭团）则横幅早在大波前的 45s 那次自然触发就已经弹过（`state.bigWarned` 每波只在出波时复位，scenes/test.js:1351），不会重复弹；剩余在 7000..9000 之间时 `cutWaveGap` 的 `> gap` 条件不成立，不压缩也不额外弹，行为同以前
- 未动：`bigCutGap: 9000` 与其余 `CFG.wave` 字段、`cutGap: 3000` 普通波催波、横幅文案与 `CFG.banner.bigHold`（淡入0.4/持续5/淡出0.4）、调用顺序 `waveCutCheck() → waveWarnCheck() → resultCheck()`（scenes/test.js:1528-1530）；无新增状态字段，`SAVE_KEYS` 一字未改（`bigWarned` 的既有读法不变，旧档不受影响）
- 验证：五个 js 文件 `vm.Script` 解析通过；全仓检索 `bigCutGap` 现在只剩 game.js:19 定义 + scenes/test.js:221 一处读取，`bigWarnGap` 为 game.js:19 定义 + :231 一处读取

## v0.1.23（2026-10-26）
- 修改：`CFG.wave.bigCutGap` 7000 → **9000**（game.js:19，+2s）—— 这是"下一波是大波时压成的倒计时"，也就是清场后大波提前刷新所需的等待时间
- 命中处只有一处逻辑（scenes/test.js:219-223）：`waveCutCheck()` 先看下一波 `isBigWave(state.wave + 1)`，若是大波则**只看场上是否全空**（`state.monsters.length === 0` —— 残血怪也算活着，`hp <= 0` 的怪在同一帧就被 splice 掉了，所以这个条件等价于"全灭/清场"），空了才 `cutWaveGap(CFG.wave.bigCutGap)`；普通波走的是下面那条 hp 比例分支，读的是 `cutGap: 3000`，**没有动**
- `cutWaveGap(gap)`（:214-217）是"只压不抬"的写法：`if (state.waveGap - passed > gap) state.waveGap = passed + gap`，把剩余时间钉在 `gap`。所以效果就是清场后 **7s → 9s** 才落下这一大波，每帧重复调用也不会被压回去
- 大波口径（`isBigWave` :188-190 = 每 `bigEvery: 10` 波一次 或 最后一波）：test1（waves 20）是第 10、20 波，test2（waves 30）是第 10、20、30 波；这些波的自然间隔是 `bigGap: 52000`（`randWaveGap` :195），比压出来的 9000 长得多，所以提前刷新仍然有明显效果
- **连带变化（请注意）**：`bigCutGap` 同时被 `waveWarnCheck()`（:229-234）当作「一大波敌人正在靠近」横幅的触发门限（:231 `剩余 > bigCutGap` 就 return）。同一个数改大 2s，横幅现在也**提前 2s 出现** —— 自然路径下从"上一波后 45s"变成 43s；若先触发了清场压缩，剩余正好被钉到 9000，那一帧就满足门限、横幅立刻跟出。想保留原来的报警时机，只需把这个字段拆成两个（提前量 / 报警门限）各写各的，说一句我就改，我没有擅自动
- 未动：`div / cap / bigEvery / first / gapMin / gapMax / bigGap / hpCut / cutGap / rowInit` 全部照旧；普通波催波（本量 hp < `waveHp * 0.65` → 压成 3s）与它的大波分支之外的任何时序逻辑没有改动；无新增状态、`SAVE_KEYS` 一字未改（`waveGap` / `lastSpawn` / `clock` / `bigWarned` 的既有读法不变，旧档不受影响）
- 验证：五个 js 文件（info/info.js、scenes/menu.js、scenes/test.js、save.js、game.js）`vm.Script` 解析通过；全仓检索 `bigCutGap` 只有 game.js:19 定义 + scenes/test.js:221、:231 两处读取，确认没有第三处受牵连

## v0.1.22（2026-10-26）
- 新增可调字段：`CFG.meter.anim: 0.6`（game.js:17）—— 一格进度（一次出怪）走完所需的秒数
- 修改：进度条的显示值不再是离散的 `wave / waves`，而是**从上一波的比例平滑走到这一波的比例**（scenes/test.js:1067-1068）：`u = smooth(min(1, (state.clock - state.lastSpawn) / (anim * 1000)))`，`pct = min(1, (state.wave - 1 + u) / waves)`，裁切与绘制仍读同一个 `pct`（:1074-1075）
- 说明：**没有新增任何状态字段**，也不需要 —— 出怪那一刻 `state.lastSpawn = state.clock`、`state.wave++` 是同一处做的（scenes/test.js:1348-1349），而 `wave` 每次只 +1（自然出怪门槛 `state.wave < lv.waves` 保证不会跳），所以 `wave - 1` 必然就是上一次的显示值；`clock` / `lastSpawn` / `wave` 三个又都已经在 `SAVE_KEYS` 里，于是读档后动画能自然续上或直接落位，**存档格式一字未改**（不涉及旧档丢弃）
- 曲线：复用既有 `smooth(p) = p²(3−2p)`（scenes/test.js:430），两端速度为 0，与相机推拉、面板升降、卡片飞行同一套缓动；`state.clock` 与 `lastSpawn` 单位是毫秒，所以 `anim` 的秒数在那里 ×1000
- 实测（test1，waves 20，一格 = 239.9/20 ≈ 12px）：出怪瞬间 u=0 → 绿条 0px（**框先空着出现**），0.1s → 0.89px，0.3s → 6px，0.6s → 12px 落位，之后保持；test2（waves 30）一格约 8px，同样 0.6s 走完
- 稳态无误差：`u = 1` 时 `(wave − 1 + 1) / waves` 与改动前的表达式完全相同（对照 wave 3 → 0.15、10 → 0.5、20 → 1），所以动画结束后不会留下偏移，满格仍是最后一波
- 时序表现：快速模式下 `dt` 已经 ×2，动画跟着游戏时钟走，所以真实时间里是 0.3s（与其余计时的表现一致，未特殊处理）；菜单/暂停/胜负弹窗打开时 loop 跳过 `updateGame`，`clock` 不前进 → 动画停在当前比例，回到游戏继续走完
- 未动：出现条件仍是 `state.wave > 0`（框仍是出怪那一刻直接出现、**没有淡入**，要淡入说一句），从右往左的裁切方向、`w / padX / padY / gap / frame / fill / inset` 与关卡名称的让位规则全部照旧
- 验证：五个 js 文件 `vm.Script` 解析通过；上面 u、像素与稳态三组数字都是按新表达式算出来的

## v0.1.21（2026-10-26）
- 修改：**右下角这一组整体下移并缩小** —— `CFG.meter.w` 320 → **260**、`CFG.meter.padY` 24 → **12**；`CFG.levelName.font` 30 → **26**、`CFG.levelName.padY` 24 → **12**（game.js:16-17）。`padX` 与 `gap` 未动（仍 24 / 16），所以只有垂直方向下移、尺寸变小
- 新几何（按 CFG 复算，缩放系数 `sc = 260/155 = 1.6774`）：进度条框占 **x 1764..2024、y 1108.1..1140**（260×31.9，离屏幕底边 12px）；进度区 **x 1772.4..2012.3、y 1114.8..1133.3**（满格 239.9×18.5）；关卡名称基线 y=1140（与进度条底边同线），进度条出现时右边缘 x=1748（= 1764 − 16）
- 修改：**进度改为从右往左增长**（scenes/test.js:1066-1075）—— 裁切方式由"取源图左段、贴内腔左边"改成"**取源图右段、贴内腔右边**"：源矩形 `x = fill[0] + fill[2] * (1 − pct)`、`w = fill[2] * pct`，目标矩形 `x = fx + fw * (1 − pct)`、`w = fw * pct`。两端同步偏移，所以仍是 1:1 裁切不变形，只是右端固定、左端随进度往回吃
- 实测（test1，20 波）：第 1 波 pct 0.05 → 绿条只占 x 2000.3..2012.3（源图 142.8..150）；第 5 波 0.25 → 1952.3..2012.3；第 10 波 0.5 → 1892.3..2012.3；第 20 波满格 1772.4..2012.3。`dstRight` 恒为 2012.3，即右端钉死在内腔右侧
- 说明：顺手把进度区四个量提成局部量 `fx / fy / fw / fh`（:1068-1071），两次 `drawImage` 都读它们，几何只此一处；出现条件 `state.wave > 0`、`pct` 的 `Math.min` 上限、名称被挤到左侧时基线不变的规则都没动
- 验证：五个 js 文件 `vm.Script` 解析通过；上面所有坐标都是按新 CFG 算出来的

## v0.1.20（2026-10-26）
- 新增：素材 `images/others/FlagMeter.png` 以键 `flag_meter` 进预加载表（game.js:254，紧跟 golden_milk）—— PIL 实测该图 158×54 RGBA，含两条带：**上带 rows 2..20（155×19）是空心进度条框**（深灰描边、内腔全透明、边框厚约 6px），**下带 rows 33..43（143×11）是进度本体**（纯绿 `179,254,81`，左右两端是直角，所以按比例裁切不会变形）
- 新增：`CFG.meter = { w: 320, padX: 24, padY: 24, gap: 16, frame: [2, 2, 155, 19], fill: [7, 33, 143, 11], inset: [5, 4] }`（game.js:17）—— `w` 是唯一的尺寸旋钮，等比缩放系数 `sc = w / frame[2] = 2.0645`；`frame` / `fill` 就是源图两条带的 `[x, y, w, h]`（直接照抄像素量法）；`inset` 是进度区相对框左上角的内缩（源图像素，左 5 / 上 4）；`padX` `padY` 是右下角内边距，`gap` 是与关卡名称的间距
- 新增：右下角关卡进度条（scenes/test.js:1059-1078，接在 v0.1.19 那段里、同一个 `!state.deckPhase` 门内）。实测几何：框占 x 1704..2024、y 1088.8..1128（320×39.2），进度区占 x 1714.3..2009.5、y 1097..1119.8（满格 295.2×22.7，正好落在框的内腔里，右边缘与框内沿对齐）
- 出现时机：**`state.wave > 0` 才画**（:1065）—— 也就是本局第一次自然出怪之后；`wave` 本来就在 `SAVE_KEYS` 里，所以"继续游戏"读回来的局（wave 已 > 0）一进场就带着进度条
- 进度算法：`pct = min(1, state.wave / INFO.tracklist[state.slot].waves)`（:1067），绿条**按 pct 裁切源图宽度**（左端固定、右端推进）而不是缩放整条，所以条纹和端点都不变形。实测 test1（waves 20）：第 1 波 5% → 14.8px、第 10 波 50% → 147.6px、第 20 波 100% → 295.2px 满格；test2（waves 30）第 1 波 3.3%。`Math.min` 只防"读档时把 `waves` 改小过"，正常流程里 `state.wave < lv.waves` 已经拦着不出波（scenes/test.js:1331）
- 修改：关卡名称改为**被进度条挤到其左侧**（:1076）—— `fillText` 的右边缘从固定 `CFG.W - ln.padX` 变成 `shown ? mx - mt.gap : CFG.W - ln.padX`，即进度条出现后名称右边缘落在 x=1688（= 1704 - 16），没出现时仍贴右下角 x=2024；基线 y=1128 与字号颜色都不变，所以只有横移、不会上下跳
- 说明：手动点「出怪」走的是 `spawnMonster(pickRow(), spawnTable[0], 0)`（scenes/test.js:1278），**不推进 `state.wave`**，所以它既不会让进度条出现也不会让它增长（进度按波次算，与"最后攻势""胜利判定"同一口径）。要把手动出怪也算进"第一次出怪"，说一句
- 未动：出怪/菜单两枚按钮、卡栏、倒计时、v0.1.19 的门控条件与 `CFG.levelName` 全部照旧；进度条与名称都画在场上实体之后、弹窗蒙层之前（打开菜单/胜负弹窗时被蒙层盖住）
- 验证：五个 js 文件 `vm.Script` 解析通过；PIL 量出两条带的 bbox、逐列 alpha 与颜色；几何与新数值按 CFG 复算了一遍（上面引用的数字都是算出来的，不是估的）

## v0.1.19（2026-10-26）
- 新增：**每条关卡都带 `name`（关卡名称）**（info/info.js:129 `tracklist`，test1 在 :131、test2 在 :140），按他给的名字写成 `测试场景1` / `测试场景2`，放在各条目的第一个字段（`bg` 之前）
- 新增：开始战斗后在**屏幕右下角**显示关卡名称，黄色小字（scenes/test.js:1059-1066）：右对齐、基线 bottom，画在 `x = CFG.W - padX = 2024`、`y = CFG.H - padY = 1128`；实测宽度按 4 个汉字 + 1 个数字估约 150px，所以左边缘落在 x≈1887，不与任何既有 UI 相邻（出怪/菜单两枚按钮在右上角 y 24..96，卡栏也始终靠上边）
- 新增可调字段：`CFG.levelName = { font: 30, color: '#ffe14d', padX: 24, padY: 24 }`（game.js:16）—— 字号、颜色、右下边距都在这一个字段里改
- 显示时机：整块由 `if (!state.deckPhase)` 门控（:1059），与 v0.1.17 那套"真正开局才算 live"同一条判据 —— 全景、右移展示、选卡、镜头回拉、5s 倒计时期间**都不出现**，倒计时结束、战斗开始的那一帧才浮现；战斗里常驻（暂停菜单/胜负弹窗打开时被那层 `rgba(0,0,0,0.5)` 蒙住，因为文字画在蒙层之前）
- 绘制位置：紧跟在 `drawButton(ui.spawnBtn)` / `drawButton(ui.menuBtn)` 之后（:1055-1057），所以在场上实体与怪物之上；`font / fillStyle / textAlign / textBaseline` 都在这块里自设，后面 `drawBannerText` 与弹窗各自重设，不会串
- 说明：只加了数据与这一处显示，**没动主菜单里写死的 `测试场景1` / `测试场景2` 两枚按钮文字**（scenes/menu.js:66-67）—— 想改成读 `INFO.tracklist[k].name`（一条 `drawButton(ui.test1, INFO.tracklist.test1.name)` 的替换）说一声，没下指令我不并联
- 验证：五个 js 文件 `vm.Script` 解析通过；`vm` 沙箱里读回 `INFO.tracklist`，两条各有 `name` 且值正确

## v0.1.18（2026-10-26）
- 新增：**每条关卡都带两个前置演出开关**（info/info.js:129 `tracklist`）—— `showMonsters`（展示怪物）与 `deckSelect`（需要选卡），test1 / test2 两条都显式写成 `true`，位置放在 `spawnTable` 之后、按"先展示怪物、后需要选卡"的依赖顺序排
- 规则（保留）：**只有 `showMonsters` 为 true 时 `deckSelect` 才能为 true**。这是关卡数据侧的约定，后续加关卡若写出 `showMonsters: false` + `deckSelect: true` 这种组合要提醒他；代码不做拦截、不做降级、不加 console 校验（他只说"提醒我"）
- 修改：`deckSelect` 的语义由"**没写就是不开**"改为"**没写默认开**" —— 判定从 `if (INFO.tracklist[state.slot].deckSelect)` 改为 `if (INFO.tracklist[state.slot].deckSelect !== false)`（scenes/test.js:414），`showMonsters` 同样按默认 true 读（:421 `state.lineup = INFO.tracklist[state.slot].showMonsters !== false ? buildLineup() : []`）
- 效果（请注意这是行为变化）：**场景1 现在也会走完整的选卡流程**（全景 → 右移 → 阵容 + 选卡面板 → 开始 → 回拉 → 5s 倒计时 → 开打），以前只有场景2 有。场景1 的 `spawnTable` 只有 chunipenguin 一种，`buildLineup` 的 `CFG.deck.minShow: 5` 保证右边至少站 5 只，不会空
- 说明：`showMonsters: false` 目前唯一能合法出现的方式是同时 `deckSelect: false`（按上面那条规则），而 `deckSelect: false` 时 `beginRun` 直接 `playBgm()`、镜头根本不右移，所以 `showMonsters` 这一档在"只看怪、不选卡"上暂时**没有独立表现** —— 想要那一档（右移展示阵容后自动回拉并走倒计时，不等点击开始），说一句我再实现，现在没做是因为你没下这条指令
- 验证：`vm.Script` 解析 test.js / info.js 通过；按新读法跑了一遍现有数据 —— test1、test2 均为「展示/选卡」，缺键的假想关卡也解析成默认 true，而 `showMonsters: false` + `deckSelect: true` 这种违规组合能被同一处读法识别出来（供后续检查用）

## v0.1.17（2026-10-26）
- 修改：`drawTopHud` 的战斗分支现在先看"这局是否真的开始了" —— 新增 `const live = !state.deckPhase;`（scenes/test.js:820），费用不足与冷却中两个判定各自 `&&` 上它（`short` :841、`cooling` :842），三处表现全部改读这两个局部量：费用数字颜色（:844）、整格灰罩（:847）、黑色冷却条（:851）
- 效果：**从点"开始游戏"到真正开打的这段时间（`'out'` 镜头回拉 1.5s + `'count'` 倒计时 5s）里，卡槽保持选卡完成那一刻的样子** —— 卡面正常、费用数字一律白色、不蒙灰、没有冷却条；等 `'count'` 结束、`state.deckPhase` 置回 null 的那一帧，冷却遮罩与标红才一起出现。以前是点完开始立刻就能看到变化（现有六张卡里 dxbear 100 / touchhold 150 / meganekuma 175 / chibimilk 200 都比开局奶量 `INFO.milk.start` 50 贵 → 四个费用当场变红，touchhold 33.33s、らん 20s 的初始冷却 → 两格立刻蒙灰带 2/3 高的黑条）
- 数据没动：`confirmDeck()`（scenes/test.js:474）仍然在点开始时就把 `state.cool = deckCool(state.deck)` 写好。因为 `updateGame` 在整个 `deckPhase` 期间被 loop 跳过（game.js:234），这些冷却值在这 6.5s 里根本不会走时，所以"延后到真正开局才起表"与"只是不画"结果完全一致，选了改动面小的那条：只压绘制，不碰时序
- 战斗路径逐位不变：`live` 在局内恒为 true，`short`/`cooling` 就退化成原来的表达式。真机逻辑对照跑了 8 种组合（deckPhase × noCool × 奶量 × cool）：`deckPhase === null` 时新旧颜色/灰罩/冷却条三项全部相等
- `'pick'` 分支与顶栏其余部分没碰：选卡中本来就走 `drawCardFace` 的中性画法（:824-837），milk 计数、断网槽、面板框都照旧；`'in'` 阶段顶栏整体不画，也照旧
- 说明：`state.opts.noCool`（无冷却无花费）打开时这三项本来就都不显示，行为不受本次影响；断网工具槽在倒计时里仍是可显示不可用（输入门在 `deckPhase` 上，未变）

## v0.1.16（2026-10-26）
- 修改：**默认存档落点**从 `data/` 目录里的本地文件改为**浏览器缓存**（localStorage），键名 `apollo7s:save:test1` / `apollo7s:save:test2`（save.js:4 `LS_PREFIX`，读写各自包了 try/catch：cacheRead :6、cacheWrite :15，缓存被禁用/写满时只 console.warn 不再抛）。`SAVE_KEYS`（save.js:1）、`snapshotRun`（:23）的字段与 JSON 序列化格式**一字未改**，只是换了地方，所以旧 `data/save_test*.json` 与新缓存内容同构
- 移除：IndexedDB 存目录句柄那一整套（`idbOpen` / `idbGet` / `idbSet` / `IDB_NAME` / `IDB_STORE` / `dataDir` / `dirPromise`）和 `pickDir` / `saveFile` / `readSaveFile`；连带删掉启动时挂在 window 上的一次性授权 `window.addEventListener('pointerdown', pickDir, { once: true })`（原 game.js:261）—— 现在**日常游玩过程完全不碰磁盘**，页面加载后第一次点击不再弹目录选择器
- 新增：主菜单右上角（导入）（导出）两枚按钮（scenes/menu.js:14-15 两块矩形、:51-52 用现成的 `drawButton` 画、:21 并入光标 pointer 判定、:29-36 点击分发）。尺寸走新的可调字段 `CFG.menu = { btnW: 160, btnH: 64, btnY: 24, btnPad: 24, btnGap: 16 }`（game.js:15）—— 实测：导出 1864..2024、导入 1688..1848，均在 y 24..88，与居中菜单面板（x 704..1344）不相叠
- 按下后选文件夹：`chooseDir(mode)`（save.js:64）直接调 `window.showDirectoryPicker({ mode })`，每次点都弹选择器（不再记住上次目录，也不再把句柄存进 IndexedDB）。导出用 `'readwrite'`，导入用 `'read'`；不支持该 API 的浏览器只 warn 一行"该浏览器不支持选择文件夹"，取消选择则什么都不做（:74/:84 早退），两枚按钮不置灰、不弹提示框
- 文件名沿用 `save_<slot>.json`：导出写 `save_test1.json` / `save_test2.json`（save.js:76），导入读同名文件（:86）—— 所以以前那个 `data/` 文件夹可以直接拿去导入
- 只导出**有记录**的槽位（save.js:75 用 `hasRunRecord` 过滤）：没玩过的槽位不写文件，免得把目标文件夹里的旧档覆盖成空白。为此 `hasRunRecord` 改为按槽位判定 `hasRunRecord(s)`（scenes/test.js:302），唯一调用点 game.js:132 相应改成 `hasRunRecord(slot)`（那里 `state` 已指向 `slot`，行为不变）
- 重构：原来内联在 `loadRun` 里的解析 + 有效性判断整块抽成 `applyRunText(key, text)`（save.js:38），**读缓存和导入文件走同一条校验**（校验条件没动：plants/monsters/deck 形状、卡索引、怪型、speed）；导入时有效的文本既写进内存槽位，也顺手落回浏览器缓存（:91），无效/损坏/文件不存在的槽位跳过并 warn，内存里原有的运行状态一点不碰
- 说明：`writeRun()`（save.js:34）由"异步写文件"变成"同步写缓存"，六个调用点（scenes/test.js:1176/1180/1189/1194/1210/1222）本来就是裸调用不接 Promise，所以无需改动；`loadRun`（:58）仍返回 Promise，`enterRun` 的 `loadRun(key).then(...)` 与 `state.loading` 那套一帧没动。写入时机也仍是"只在离开场景时"，没变
- 注意：`data/` 里已有的 `save_test*.json` **不再被自动读取** —— 要接回旧进度就在主菜单点（导入）选中那个文件夹；反过来，缓存里的进度不点（导出）就不会落到磁盘。**清浏览器缓存等于丢档**，长期存档靠导出留文件
- 验证：node `vm` 沙箱里伪造 localStorage + 目录句柄跑了一遍 —— `writeRun()` 只写当前槽位且怪物记录的 `eat` 字段照旧被剔除；`exportRuns()` 只产出 `save_test1.json`（test2 无记录被过滤）且 mode 为 `readwrite`；清空缓存后 `importRuns()` 用 `read` 还原了 clock 12.5 / 1 株伙伴 / 1 只怪 / deck [0,3,…] / bgmAt 3 并回写了缓存键；坏 JSON 与未知怪型（`zombie`）两份伪档都按"整份丢弃"处理，warn 了「存档解析失败 test2」「存档数据无效 test2」且内存状态保持 77 不动。五个 js 文件 `vm.Script` 解析通过；浏览器里真实的目录选择与读写请你亲手走一遍

## v0.1.15（2026-10-26）
- 修改：`renderDeck` 卡池那格的分流条件（scenes/test.js:612）从 `if (ci < 0 || flying(ci))` 改回 `if (ci < 0)` —— 卡片在空中飞的这段时间，它原来那个卡池格**不再画成只有边框的空格**，而是直接走正常绘制：`drawCardFace` + 按 `state.deck.includes(ci)` 决定要不要盖那层灰（:617-619）。因为 `state.deck` 在点击那一刻就已经改好了，所以这一格画出来的就是**这张卡落地之后本该有的样子**
- 于是两个方向分别是：从卡池点选 → 格子当场变成"已选"的蒙灰状态，卡片从这层灰上面飞出去；从卡槽取消 → 格子的灰罩当场褪掉恢复成可选状态，卡片飞回来落在它上面
- 判定没跟着变松：`flying()`（scenes/test.js:512）仍然用在顶栏占位（:824，目标槽在落地前画暗格）和槽位点击/悬停门（:642、:663）上，所以只有"格子立刻显示结果"这一处变了
- 说明：黄圈本来只在 `!state.deck.includes(ci)` 那支里画（:620），所以刚点走的那张卡即使鼠标还停在它上面也不会亮圈，和"点它会重复选"这件事不冲突；反向飞回的那张如果鼠标划过那格，会亮圈且**能点回去**（它此刻确实已可选），这是正常的
- 存档与几何都没碰

## v0.1.14（2026-10-26）
- 新增：`CFG.deck.fly: 0.18` 和 `CFG.deck.shift: 0.12`（game.js:25）—— 前者是一张卡在**卡池格 ↔ 卡槽**之间飞的时长，后者是补位时一张卡在**相邻两个卡槽**之间横移的时长。缓动仍用相机/面板那条 `smooth(p) = p²(3−2p)`
- 新增：`state.flights`（game.js:71）—— 飞行中的卡列表，每项 `{ ci, x0, y0, w0, h0, x1, y1, w1, h1, t, dur }`。属于瞬态 UI 状态，**没进 `SAVE_KEYS`**；`resetRun`（scenes/test.js:321）、`beginDeck`（:425）、`confirmDeck`（:478）各清一次，推进放在 `updateDeck` 最前面（:437-438，`t += raw` 再把 `t >= dur` 的过滤掉），所以只在选卡流程的几个阶段里走时
- 新增：`deckFly(ci, from, to, dur)`（scenes/test.js:516，记两端矩形）、`flying(ci)`（:512，这张卡此刻在不在空中）、`poolCellRect(ui, ci)`（:520，按 id 取它那个卡池格，y 再加上当前的 `deckRise()`，所以入场那 0.3s 里点也能从**看见的位置**起飞）、`drawFlights()`（:538）
- 选择动画：`deckClick` 命中卡池后照旧**立刻**把 `ci` 写进第一个空槽，然后补一条 池格 → `slotRect(空槽)` 的飞行（scenes/test.js:653）。飞行途中两端都"让位"：卡池那格画成**只有边框的空格**（`renderDeck` 的 `ci < 0 || flying(ci)`，:612），目标卡槽画成顶栏那套暗占位框（`drawTopHud` 的 `ci === null || flying(ci)`，:824）；落地后两边同时换成真实绘制，看上去就是卡从格子里起飞、长进槽里
- 取消 + 补位动画：新函数 `deckRemove(ui, at)`（scenes/test.js:525）—— ① 被取消的这张生成一条 `slotRect(at)` → 它自己的卡池格 的反向飞行（`fly`，尺寸一路缩回 76×122）；② 然后把它后面每张卡依次前移一格（`state.deck[k] → state.deck[k-1]`，即**卡槽内部不再有中间空洞**，空位永远排在末尾），每张同时生成一条 `slotRect(k)` → `slotRect(k-1)` 的补位飞行（`shift`，两端同尺寸所以只是横滑）。实测 `[0,3,5,1,null,null]` 点掉第 0 格 → `[3,5,1,null,null,null]` + 4 条飞行（ci0 槽0→格id1、ci3 槽1→槽0、ci5 槽2→槽1、ci1 槽3→槽2）
- 绘制顺序：`drawFlights()` 挂在 `renderDeck` 末尾、面板那块 `ctx.restore()` 之后（scenes/test.js:630），坐标是屏幕坐标（不吃面板下滑的 `translate`，卡槽本来就不动），所以飞行的卡画在棕色面板和顶栏之上
- 尺寸插值：飞行途中直接拿 `drawCardFace` 画插值后的矩形（w/h 线性过渡），所以卡池那格 76×122 飞向顶栏 107×160 时是**边飞边放大**的，卡面（`r.w × r.w` 正方形）和花费数字都跟着走，不用另画一套
- 判定跟着一致：空中的卡在其目标槽里画的是空占位框，所以**点那个槽没反应**（`deckClick` :642 和 `deckHover` :663 都加了 `!flying(...)`），也不会亮那圈黄环；卡池那格反过来也一样（`state.deck.includes(ci)` 直接 return）。也就是"画成空格 = 点不动"，不会出现按了没反应的槽位或能点却不亮的槽位
- 说明：`state.deck` 数据在点击那一刻就已改好，`deckPicked / deckFull / 开始游戏灰罩` 都是立刻正确的，动画只影响两端**画什么**、不影响**能不能用**
- 说明：点"开始游戏"时若还有卡在空中，`confirmDeck` 把 `flights` 清空 → 它们当场落位显示，不会拖着一张卡跟着镜头回拉
- 副作用（就是"补位"二字要的）：卡槽从此刻起**永远是紧凑前缀**，中间不留洞。代价是取消第 2 格会让后面所有卡都往前挪一格；从旧档读回来的 `deck` 若带中间空洞，不会自动重排，但下一次取消操作会顺手把它压实

## v0.1.13（2026-10-26）
- 移除：选卡面板里的三行提示文字 —— `选择卡片`、`卡槽 n/6`、`拥有的卡` 连同它们那几行 `ctx.font / textAlign / fillStyle` 一起删掉（原 scenes/test.js:548-555），现在棕色面板里只剩**卡槽网格**和 `开始游戏` 按钮（按钮上的字是按钮本身，没动；卡片右下角的牛乳花费数字属于卡面 `drawCardFace`，也没动）。`deckRects` 因此不再返回 `cx / titleY / slotLabelY / poolLabelY` 四个只为文字存在的字段；`deckPicked()` 还在，只是只有 `deckFull()` 在用了
- 新增：`CFG.deck.pool: { rows: 6, cols: 8, w: 76, h: 122, gapX: 12, gapY: 8 }`（game.js:25）—— 卡池改成**固定 6 行 8 列共 48 格**，每格 76×122，横向间距 12、纵向间距 8
- 修改：卡槽按 **卡片 id 定位**，不再按 `CARDS` 下标排 —— 格号 `i`（0 起）对应 id `i + 1`，即第 `⌊i/8⌋ + 1` 行第 `i%8 + 1` 列：第一行 id 1-8、第二行 id 9-16…第六行 id 41-48。新 helper `cardBySlotId(id)`（scenes/test.js:491）按 `CARDS[i].info.id` 找下标（找不到返回 -1），`deckRects().pool(i)`（:486）现在收的是**格号**。现在这 6 张卡（id 1、2、3、4、6、8）全落在第一行的第 1、2、3、4、6、8 格，id 5、7 和下面 5 行共 **42 格是空格**
- 新增：`drawEmptySlot(r)`（scenes/test.js:507）—— 没有对应 id 的格子画**只带边框的空卡槽**：`CFG.cardFace.ring` 细环 + `ringR` 圆角，和顶栏那圈的样式同源，没有底色也没有文字；空格不可点、不亮黄圈（`poolCard` 直接跳过 `ci < 0`）
- 新增：`poolCard(ui, pt)`（scenes/test.js:498）—— 遍历 48 格返回命中的 `CARDS` 下标（空格/未命中 -1）。`deckClick`（:603）和 `deckHover`（:615）都改走它，所以点选、放回、悬停黄圈、鼠标手型这些判定自动跟着新网格，不用各自再数一遍列数
- 修改：`CFG.deck.panel.w: 860 → 760`（game.js:25）—— 一行 8 格宽 692（8×76 + 7×12），居中后左右各留 34；面板 40..800，仍然完全在场地左侧（阵容怪在屏幕 x ≥ 1020，一点没挡）
- 实测布局：格行 y 依次 **260 / 390 / 520 / 650 / 780 / 910**（每格高 122），x 从 **74 到 766**；卡面按 `drawCardFace` 口径画成正方形 `r.w × r.w` 贴格顶偏 8px（第一行即 268..344），花费数字中心在格底上 22（360），两者不叠。`开始游戏` 360×64 在 y **1054..1118**，面板底 **1140**（离屏幕下沿 12）。`CFG.deck.panel.y` 仍是 240，所以 v0.1.9 / v0.1.10 那套上下滑的位移 `CFG.H - panel.y = 912` 一字未改
- 注意：格子尺寸是被**纵向**卡住的 —— 6 行 + 按钮 + 上下留白要塞进 240..1152 这 912px，`drawCardFace` 又要 `h ≥ w + 45`（正方形卡面 + 下面那条花费），所以单格最高只能 ~124，比顶栏那排 107×160 明显小一圈。想放大只有三条路：把 `开始游戏` 挪到网格右侧、缩小花费字号（要给 `drawCardFace` 传字号/让它按格子缩放）、或者接受面板贴到屏幕最底。你说选哪个我改
- 说明：id 超过 48 的卡**没有格子可站**（网格是 6×8 固定），会被静默跳过 —— 绘制和点击都只认 `i + 1` 命中的 id；等你真要加到第 49 号，把 `rows` 或 `cols` 调大即可
- 说明：存档格式没碰（格号和 `CARDS` 下标是两套东西，`state.deck` 存的仍是 `CARDS` 下标），旧档照常；`deckTarget()` 仍是 `min(6, 卡数)`，卡少于 6 张时要全选满才能开始

## v0.1.12（2026-10-26）
- 修改：`SAVE_KEYS`（save.js:2）里去掉 `'opts'` —— 选项设置的四个开关（`快速模式 / 关闭自然出怪 / 无冷却无花费 / 自动收集`，定义在 game.js:34 的 `OPTS`）从此不写进 `data/save_testN.json`，读档时那句 `for (const k of SAVE_KEYS) if (o[k] !== undefined) s[k] = o[k]`（save.js:110）遍历的是同一张白名单，所以也不会再被覆盖回来
- 效果：**关掉页面再开 = 默认全关**（`state.opts` 的初值只有 `makeRun` 那一处：game.js:80 `opts: { fast: false, noNatural: false, noCool: false, autoCollect: false }`，两个槽位各自一份，只在启动时构造一次）；**只返回主菜单不关游戏 = 设置还在**（槽位对象 `SLOTS.test1/test2` 常驻内存，`enterRun` → `loadRun` 不再碰 `opts`，`resetRun`（scenes/test.js:304）本来也不清它，所以换关、失败重试、选项里点确定都保持当前开关状态）
- 说明：`loadRun` 的有效性判断（save.js:104）**没有跟着改** —— 少存一个字段不影响读档正确性（旧文件里那个 `opts` 键只是没人再读，下次 `writeRun()` 整份覆盖时就自然消失），不像 v0.1.5 加 `deck` 那样是"运行时要读的新字段"，所以不用丢弃旧档
- 未动：`state.opts` 仍然是运行期内存里的那一份，主菜单、局内暂停都不影响它；如果之后想要"设置跨启动保留"，那是另开一个文件（比如 `data/settings.json`）单独存、和关卡存档解耦，说一声我做

## v0.1.11（2026-10-26）
- 新增：阶段机第四档 `'count'` —— 视角回拉（`'out'`）走完不再直接交回战斗，而是进 `'count'` 停留 `CFG.deck.count: 5` 秒（scenes/test.js:451 切档并把 `deckT` 归零，:455 起是这一档的推进）。这 5s 里主循环仍走 `state.deckPhase` 那条分支（game.js:232），所以 `updateGame` 整段不跑：**`state.clock` 不涨、不出怪、牛奶不掉、卡片冷却不擦**，第一波仍然按 `CFG.wave.first` 在战斗开始后才计时
- 新增：`CFG.deck` 里的四个可调数（game.js:25）—— `count: 5` 停留总时长、`milkAt: 1` 第一瓶金牛奶的时刻、`milkStep: 0.1` 逐行间隔、`milkPan: 0.1` 单瓶移入时长
- 新增：金牛奶逐行入场 —— `'count'` 里按 `state.gmilks` 的下标（=行号 0→4，从上到下）给每瓶算 `u = clamp((t - milkAt - i * milkStep) / milkPan)`，再取 `x = -w/2 + CFG.grid.x * smooth(u)`（scenes/test.js:457-460）：起点是**完全在屏幕左沿外**（中心 x = -74.4，即右边缘贴 0），终点是战斗里的静止位（中心 x = 113.6，右边缘正好顶到 `CFG.grid.x` 188），走的还是相机那条 `smooth` 曲线。所以 5 瓶依次是 `1.0→1.1s`、`1.1→1.2s`、`1.2→1.3s`、`1.3→1.4s`、`1.4→1.5s`，第 1.5s 全部就位；影子上面已经跟着 `gmilkRect`，所以也跟着滑
- 新增：`gmilkRestX()`（scenes/test.js:246）—— 静止位 `CFG.grid.x - w/2` 只写一处，`resetGmilks`（:252）改成调它，入场动画的终点也用它，避免两处各算各的
- 新增：`CFG.deck.marks`（game.js:25）—— 倒计时红字表 `[文本, 起始s, 持续s]`：`['3', 2.5, 0.5]`、`['2', 3, 0.5]`、`['1', 3.5, 0.5]`、`['START!', 4, 1]`，四段刚好首尾相接、`START!` 在 5.0s 收（`'START!'` 占 `[4,5)`，切档那帧就不画了）。`deckMark(t)`（scenes/test.js:377）按当前 `deckT` 查表，命中就返回文本、否则 `null`
- 重构：把居中红字的绘制抽成 `drawBannerText(text, a)`（scenes/test.js:835）—— 120px 粗体、`CFG.banner.color` 红、`CFG.banner.outline` 8px 黑描边、`CFG.W/2 × CFG.H/2` 居中，语句和原来内联那段逐句一样；波次提示（`最后攻势` / `一大波敌人正在靠近`）改成逐条调它（:1000），`'count'` 里的倒计时走同一条（:1002-1004）传 `a = 1`。**倒计时没有淡入淡出**：`CFG.banner.fade: 0.4` 只作用在 `state.banners` 那条 alpha 计算上，倒计时不进气泡列表、alpha 恒为 1，所以是硬切出现、硬切消失
- 修改：`playBgm()` 从 `confirmDeck`（原 scenes/test.js:450）挪到 `'count'` 结束那一刻（:465）—— 点"开始游戏"只启动画，bgm 要等 5s 走完才响；非选卡关（`deckSelect` 缺失，如场景1）不经过这些阶段，仍旧直接 `playBgm()` 开局。`playBgm` 里本来就有 `.catch(() => {})`，万一浏览器拦下这次非手势的播放，进战斗后任意一次点击会命中 scenes/test.js:1125 那句 `bgm.paused → playBgm()` 补上
- 修改：`render()` 的分流（scenes/test.js:851）从 `if (state.deckPhase)` 改成 `if (state.deckPhase && state.deckPhase !== 'count')` —— `'count'` 落回**战斗渲染**（`camX` 已是 0、`lineup` 已清空），所以画面就是开打那一帧的战场：场地 + 顶栏（milk、已选 6 张卡、断网）+ 出怪/菜单按钮 + 滑入的金牛奶，只是场上没有怪物、`banners` 为空。倒计时结束 `deckPhase = null`，交接是同一套绘制，不跳帧
- 修改：`'count'` 收尾时调 `resetGmilks(state)`（scenes/test.js:462）—— 动画终点本来就和静止位相等，这里再显式归位一次，顺带把 `launched` 复位，保证交给战斗的是标准的 5 瓶待命状态
- 说明：这 5s 内**点什么都没反应** —— `testClick`（scenes/test.js:1105，门在 :1106）和 `testHover`（:1091，门在 :1092）仍按 `state.deckPhase` 真值先交给 `deckClick`/`deckHover`，而后者只认 `'pick'`，所以选卡页之外的这 5s 里种植、断网、菜单、出怪、键盘全部无效，光标也是 `default`。好处是 `writeRun()` 的调用点都在这些点击分支里，倒计时中不可能写档，也就不会把"滑到一半的金牛奶 x"存进文件
- 注意：金牛奶是**真的那 5 瓶**（`state.gmilks`），不是倒计时专用的临时装饰，所以 1.5s 就位之后到开打之前它们就待在原地等着被撞飞；如果你想要的是"倒计时专用的假瓶子、开打时再按原逻辑生成"，说一声我改成单独一份

## v0.1.10（2026-10-26）
- 修改：`CFG.deck.panOut: 0.9 → 1.5`（game.js:25）—— 只动这个数，`rise: 0.3` 和阶段机都没碰；时间线现在是 全景停 `1.5s` → 右移 `1.5s` → 到位停 `1s` → 第 `4.0s` 亮面板开始选卡 → 点开始后 **面板下滑 `0.3s` 与视角回拉 `1.5s` 同时起步**
- 修改：`deckRise()`（scenes/test.js:368）按阶段分流 —— `'out'` 返回 `smooth(t / rise) * dist`（偏移 **0 → 912**，从上往下滑出屏幕），其余阶段仍返回 `(1 - smooth(t / rise)) * dist`（912 → 0，入场）。距离 `dist = CFG.H - CFG.deck.panel.y` 和时长 `CFG.deck.rise: 0.3` 两个方向共用，所以消失就是出现的镜像
- 修改：`renderDeck` 不再"点开始当场抹掉面板" —— 删掉了 `'pick'` 之后那道 `if (state.deckPhase !== 'pick') return;`（原 :517），改成 `const picking = state.deckPhase === 'pick';`（scenes/test.js:519）：棕色面板 + 三行文字 + 卡池排 + 开始游戏按钮这一整块（:520 的 `ctx.translate(0, off)` 到 :549 的 `ctx.restore()`）在 `'pick'` 和 `'out'` 都画，只是 `'out'` 里它正往下走；唯一按 `picking` 关掉的是卡池悬停黄圈（:540），免得滑出屏幕的框还在回应鼠标划过
- 同时进行靠同一个 `state.deckT`：`confirmDeck`（scenes/test.js:448-449）把阶段切成 `'out'` 并归零计时，相机回拉读它（:436）、面板下滑也读它（:368），两者从同一帧起步
- 实测偏移（面板顶边 y，落位 240、屏幕下沿 1152）：`0s` → 240 / `0.05s` → 308 / `0.1s` → 476 / `0.15s` → 696 / `0.2s` → 916 / `0.25s` → 1084 / `0.3s` → 1152 完全出屏。同期 `camX` 1400 → 1395 → 1382 → 1361 → 1332 → 1296 → 1254，之后 `0.6s` → 907 / `1.0s` → 363 / `1.5s` → 0 落回战场
- 说明：**框离开屏幕比视角回位早 1.2s**，那 1.2s 里画面上只有顶栏和向左移动的阵容怪（`'out'` 走完才清 `lineup`、交回战斗渲染）。想让它俩同时结束，把下滑也改成按 `panOut` 计时就行（等价于给消失单独一个时长），说一声我改
- 说明：下滑这 0.3s 里面板**看得见但点不动** —— `deckClick`（:552）和 `deckHover`（:577 那支）本来就要求 `'pick'`，这是"消失"该有的样子（入场那 0.3s 相反：框正在就位、所以点击按偏移换算过照样能用）。这两处在 `'out'` 不会被调用，所以里面的 `deckRise()` 换算不受分流影响
- 未动：回拉期间顶栏照旧按战斗口径画（`drawTopHud(state.deckPhase === 'pick')`，:516 → `'out'` 传 `false`），也就是 v0.1.6 要求的"视角拉回时上方已选卡槽不隐藏"

## v0.1.9（2026-10-26）
- 新增：`CFG.deck.rise: 0.3`（game.js:25）—— 拥有卡片框的入场时长
- 修改：`updateDeck` 在 `'in'` 切到 `'pick'` 的那一刻把 `state.deckT` 归零（scenes/test.js:430）—— `deckT` 现在的含义是"当前阶段已经走了多久"（`'out'` 那边本来就在 `confirmDeck` 里归零），这样面板才能量出自己走了多少时间
- 新增：`deckRise()`（scenes/test.js:368）—— 返回此刻面板还该往下偏的像素数 `(1 - smooth(t / rise)) * (CFG.H - CFG.deck.panel.y)`，也就是 **912 → 0**；用的还是相机那条 `smooth(p) = p²(3−2p)` 曲线，所以起步和落位都不硬
- 修改：`renderDeck` 里整块面板用 `ctx.save()` + `ctx.translate(0, off)` 包起来（scenes/test.js:519 起，`off = deckRise()`，末尾 :548 `ctx.restore()`）—— 棕色面板、三行文字（选择卡片 / 卡槽 n/6 / 拥有的卡）、卡池排和"开始游戏"按钮**一起从下往上滑到对应位置**；顶栏不动（牛乳瓶计数、卡槽框、断网本来就在战斗位置上，上一版刚挪过去）
- 实测偏移（面板顶边 y，落位是 240）：`0s` → 1152（正好贴着屏幕下沿、完全看不见）/ `0.05s` → 1084 / `0.1s` → 916 / `0.15s` → 696 / `0.2s` → 476 / `0.25s` → 308 / `0.3s` → 240 落定。位移全程 912px，想让它只挪一小截（更温柔的进场），把 `CFG.H - CFG.deck.panel.y` 换成一个固定数就行，说一声我改
- 修改：命中判定跟着换算 —— `deckClick`（scenes/test.js:554，`q = { x: p.x, y: p.y - deckRise() }`）、`deckHover`（:578 同一个换算）、卡池那排的悬停黄圈（:539 用 :522 的 `hov`）都把指针减掉当前偏移再和面板矩形比，所以滑动的这 0.3s 里**看见在哪就能点在哪**，不会出现框还在往上跑、黄圈和点击却按落位坐标算的错位；上面那排卡槽不吃这个偏移（它不动），仍按原始鼠标坐标判
- 说明：这 0.3s 内可以正常选卡（不必等它停稳），面板归位后偏移为 0，坐标和以前完全一致

## v0.1.8（2026-10-26）
- 修改：`CFG.deck.hold: 2 → 1.5`、`CFG.deck.panIn: 1.2 → 1.5`（game.js:25）—— 只动这两个数，阶段机、缓动曲线、`settle: 1` 都没碰
- 时间线现在是：全景停 `1.5s` → 右移 `1.5s` → 到位停 `1s` → 第 `4.0s` 亮面板开始选卡；点开始之后回拉仍按 `panOut: 0.9s`

## v0.1.7（2026-10-26）
- 修改：`CFG.deck.hold: 0.8 → 2`（game.js:25）—— 地图全景停留改成 2s；整条时间线现在是 全景 `2s` → 右移 `1.2s` → 到位停 `1s` → 第 `4.2s` 亮面板
- 修改：**选卡页的卡槽框挪到战斗中卡栏的位置** —— `deckRects().slots(i)` 现在直接返回 `slotRect(i)`（scenes/test.js:466），也就是 `CFG.cardSlot` 那套坐标（x 256 起、间距 131、y 24、107×160），和战斗时同一排同一个框。点击放回、悬停黄圈都走 `ui.slots(i)`，所以它们跟着一起挪位，不用另改
- 重构：把战斗顶部那一排（金の牛乳瓶计数框 + 卡栏底框 + 断网工具框）整段抽成 `drawTopHud(pick)`（scenes/test.js:702），战斗侧改成调用 `drawTopHud(false)`（:916）—— 抽出来的语句和原来行内那一段逐句一样，`pick=false` 走的是原分支，所以战斗画面没有变化；选卡页在 `'pick'` 里传 `true`、`'out'`（回拉）里传 `false`，这就是你要的"milk与断网也一起显示"
- 说明：`pick=true` 那支只有两处不同 —— 空槽画暗色占位框（`rgba(0,0,0,0.28)` + `CFG.cardFace.ring`，战斗里空槽是整个跳过的），有卡走 `drawCardFace`（费用数字固定白色、不蒙灰、不走冷却擦除），悬停用选卡页那圈黄环而不是战斗中的"选中卡"环。原因是选卡不看牛奶够不够、也不看冷却
- 修改：面板布局挪到卡栏下方（`CFG.deck.panel.y 150 → 240`，game.js:25）—— 顶栏画到 y 196 结束，面板从 240 起就不压它。现在选卡页各块位置：面板 40..900 × 240..808、标题 选择卡片 302、`卡槽 n/6` 358、拥有的卡 标签 446、卡池排 490..650、开始游戏 704..768
- 说明：`卡槽 n/6` 那行原来贴在卡槽排上方当标签，卡槽挪到顶栏后它没法再贴着，就留在标题下面一行 —— 想让它挪到顶栏右侧或者去掉，说一声
- 注意：回拉那 0.9s 现在显示的是**完整的顶栏**（牛乳瓶计数 + 卡栏 + 断网），不再只是上一版那排浮在场地上的已选卡 —— 卡槽既然挪到战斗位置，和顶栏一起画才对得上。副作用是这一帧起卡片按战斗口径渲染：开局自带冷却的卡（cd 为 slow / very slow）立刻出现黑色冷却擦除，费用高于当前牛奶的卡立刻蒙灰；因为进战斗后就是同一帧的样子，所以交接处不跳，但点"开始游戏"的那一下会出现这些遮罩
- 修复：断网工具跟着鼠标的那只半透明预览（scenes/test.js:861）原本用抽走那段里的局部变量 `ns`，抽取后作用域没了会抛 ReferenceError，现在直接读 `CFG.netSlot`
- 未改：**选卡期间断网只是显示**，点不动 —— `'pick'` 阶段的点击全部先走 `deckClick`（拿它选/放卡），要能在那时候就按下去断网，你说一声我加

## v0.1.6（2026-10-26）
- 新增：`CFG.deck.settle: 1`（game.js:25，位置在 `panIn` 和 `panOut` 之间）—— 视角右移到位以后**再停 1 秒**才亮出选卡框
- 修改：`updateDeck` 的 `'in'` 阶段切档条件（scenes/test.js:422）从 `t >= hold + panIn` 改成 `t >= hold + panIn + settle` —— 停住的那 1s 里阶段仍记作 `'in'`，所以画面什么都不动（`camX` 被 `smooth(Math.min(1, ...))` 夹在 `d.cam` 上），面板也照旧不画。整条时间线：进场 → 全景停 `0.8s` → 右移 `1.2s` → 到位停 `1s` → 第 `3.0s` 亮面板、点击开始生效
- 说明：点击/悬停的判定本来就要求 `'pick'`（`deckClick`、`deckHover`），所以停留那 1s 内场上纯展示，不存在"看得见但点不了"以外的窗口
- 修改：`renderDeck`（scenes/test.js:495）把界面拆成两段，不再"一刀切全隐" —— 世界层之后先是 `if (state.deckPhase === 'in') return;`（:508，停留和右移过程仍然整块不画），随后用 `const picking = state.deckPhase === 'pick'`（:511）分流：
  - `'pick'`：棕色面板 + 三行标题（选择卡片 / 卡槽 n/6 / 拥有的卡）+ 卡槽排 + 卡池排 + 开始游戏按钮，和上一版一样
  - `'out'`（点完开始的 0.9s 回拉）：**只有上面那排已选卡槽还留着**（:524 那段循环照走，画在 `deckRects().slots(i)` 原位：x 89 起步、间距 131、y 340..500），面板底、三行文字、下面的卡池排和按钮都消失（:512 和 :541 两道 `picking` 分流）
- 说明：`'out'` 那段里空槽的暗色占位框也不画了（`if (!picking) continue;`，:528）—— 能点开始说明槽位已满，本来就不会有空槽，留着只会画出一排没人点的空框；卡槽上的悬停黄圈同样加了 `picking &&`（:538），回拉过程中鼠标划过不会再点亮一圈根本不响应的高亮
- 注意：回拉结束（`'out'` 走完）时，卡片位置从选卡页那排跳到战斗中卡栏那一排（`CFG.cardSlot` x 256 / y 24），中间没做过渡动画 —— 要它滑上去或者干脆停在顶部，你说一声我再加

## v0.1.5（2026-10-26）
- 修改：`renderDeck` 的界面 gate 从 `state.deckPhase === 'in'` 换成 `state.deckPhase !== 'pick'`（scenes/test.js:508）—— 现在只有 `'pick'` 这一档画选卡面板，所以点完"开始游戏"面板**当场就消失**，剩下 0.9s 的视角回拉过程里屏幕上只有场地和阵容怪，看着像"收起卡片、回到战场"
- 新增：**卡槽选择进存档** —— `SAVE_KEYS`（save.js:1）加了 `'deck'`，位置排在 `'cool'` 前面，两个数组是同一套槽位顺序，读回来正好对上
- 修改：`loadRun` 的有效性判断（save.js:104）加上三条 —— `Array.isArray(o.deck)`、`o.deck.length === CFG.cardSlots`（槽位数改过就说明那份档是新规则之前的，整份丢弃）、`o.deck.every(ci => ci === null || CARDS[ci])`（槽里存的卡索引必须还在卡表里，删过卡或改过顺序都会命中）
- 说明：存档里存的是**卡索引数组**（`[0, null, 3, ...]`），和场上植物用的 `p.card` 一样是索引不是 id，所以你先前的规矩"卡池顺序 = info 里 id 升序"一旦变动，旧档可能被上面那条判定丢掉 —— 这是"旧的存档先丢弃"的口径，不做迁移
- 生效范围：场景1没有选卡页，它的 `deck` 一直是 `fullDeck()`（全部卡），存档照样带这个字段并读回来，行为不变；场景2点开始之后离开场景，写进档的就是你选的这组卡，下次进场景走"继续游戏"直接带着这套卡上场（读档不再重新选卡，因为选卡只在全新开局的 `beginRun` 里触发）
- 注意：**仍然只在离开场景时写档**（你定的规则没动），所以选完卡之后不离开场景直接关浏览器，这次的选择不会被记下；想让它一点"开始游戏"就落盘，我在 `confirmDeck()` 里补一句 `writeRun()` 就行，你说一声
- 后果：现存两份档 `data/save_test1.json`、`data/save_test2.json` 里没有 `deck` 字段，下次进场景会被判无效并整份丢弃（console 一行"存档数据无效 ××"），也就是都要从头选一次卡；写完新档之后就正常了。想立刻清干净就删这两个文件

## v0.1.4（2026-10-26）
- 修改：`renderDeck`（scenes/test.js:495）在世界那一层画完之后加了一道 `if (state.deckPhase === 'in') return;`（:508）—— 选卡界面（棕色面板、卡槽排、卡池排、"开始游戏"按钮、以及三行标题文字）现在**只有视角移到位之后才出现**；进场后那 0.8s 停在全景 + 1.2s 右移的过程中，屏幕上只有背景、网格和站位中的怪物阵容
- 说明：只动了绘制，判定本来就已经卡好了 —— `deckClick`（:553）第一行是 `if (state.deckPhase !== 'pick') return;`，`deckHover`（:579）里 `ptr` 也只在 `'pick'` 才算，所以移动过程中看不见面板时它也不接收点击、鼠标不会提前变手型，不会出现"看不到但点得到"的空档
- 说明：点完"开始游戏"往回拉视角的那 0.9s（`'out'`）界面照旧留在屏幕上，这次没改它 —— 你要它跟着一起立刻消失的话说一声，条件从 `=== 'in'` 换成 `!== 'pick'` 就行
- 未改：`CFG.deck` 各时长、阵容生成 `buildLineup`、阶段机 `updateDeck` 全部原样

## v0.1.3（2026-10-26）
- 说明：只在场景2试验 —— 开关做在数据里，`INFO.tracklist.test2` 多了一个 `deckSelect: true`（info/info.js:141），场景1没这个键所以走原路（进场直接 playBgm）。以后想让场景1也选卡，就给它加同一行；不想选卡就删掉
- 新增：相机 `state.camX`（game.js:69）—— 世界仍然按原坐标画，只有选卡渲染在画实体前 `ctx.translate(-camX, 0)`；战斗全程 `camX = 0`，所以进战斗以后画面和你之前看到的逐像素一致
- 重构：背景绘制抽成 `drawFieldBg(camX)`（scenes/test.js:676）、网格抽成 `drawGrid(g)`（:697）—— 原来这两段是写在 render 里的。`drawFieldBg` 现在是**横向接段**：`for (let t = Math.floor(camX / w); t <= Math.floor((camX + w) / w); t++)` 把一张 `CFG.W`(2048) 宽的模糊背景平铺过去，**奇数段水平镜像**（`translate(l + w, 0); scale(-1, 1)`），所以接缝处是"背景图案对折"而不是重复硬边；`blur(12px)` 仍然逐段四边各外扩 `CFG.bgBlur` 再画，接缝两侧不会露白边。`camX = 0` 时循环只跑 t=0 一次，等价于改动前那一句 `drawImage`
- 新增：`CFG.deck = { cam: 1400, hold: 0.8, panIn: 1.2, panOut: 0.9, minShow: 5, showX: 2420, showStep: 200, panel: { x: 40, y: 150, w: 860 } }`（game.js:25）—— `cam` 是选卡时视角右移的距离；`hold` 是进场后先停在地图全景上的秒数，然后 `panIn` 秒匀速缓动右移；`panOut` 是点完"开始游戏"拉回场景的秒数；`showX` 是阵容第一只怪的世界 x（2420 = 场地右边界 1988 + 432，`cam` 到位后落在屏幕 1020），`showStep` 是同一排里多只怪的横向间距；`panel` 是左边选卡面板的位置和宽度，高度按内容自动算。四个时间数都是纯手感，想快想慢直接改
- 新增：阶段机 `state.deckPhase`（`'in'` → `'pick'` → `'out'` → `null`）+ `state.deckT`（game.js:67-68）—— `updateDeck(raw)`（scenes/test.js:416）推进它：`in` 走完 `hold + panIn` 就切 `pick`（此阶段不接受任何点击、也不响 bgm），`out` 走完 `panOut` 把 `camX` 归零、`lineup` 清空、`deckPhase` 设回 `null` 交回战斗主循环。缓动用 `smooth(p) = p²(3−2p)`（:412，标准 smoothstep，两端速度为 0，起步和停下不突兀）。主循环里 `if (state.deckPhase) { updateDeck(raw); render(); ... return; }`（game.js:232）排在 `updateGame` 的暂停 gate 之前，所以选卡期间游戏时钟、出怪、冷却全都不走，等价于一场不会自己前进的展示
- 新增：右边的站立阵容 `state.lineup`（game.js:70）—— `buildLineup()`（scenes/test.js:368）按你定的口径生成：拿本关 `spawnTable` 的去重类型，**每种至少一只**，`total = max(CFG.deck.minShow, 种类数)`（保证全场至少 5 只），剩下的名额按各类型 `INFO.monsters[k].weight` 比例分配，小数部分用**最大余数法**补齐（先各取 floor，余下名额给余数最大的那些），所以任何一只都不会被四舍五入抹掉、总数严格等于 `total`；排位是 `row = i % CFG.rows`（一行一只往下排）、`x = showX + floor(i / rows) * showStep`。本关只有中二企鹅一种，实测就是 5 只、第 0..4 行各一只、都站在世界 x 2420
- 说明：阵容怪只用于展示，`drawMonster` 走的是同一套贴图与 `monsterBox`（所以影子、脚线、朝向跟战斗里一模一样），但它们不进 `state.monsters`、不移动、不攻击，`deckPhase` 一结束就整批丢掉
- 新增：左边的选卡面板 `renderDeck()`（:495）+ 命中区 `deckRects()`（:446）—— 棕色面板沿用 `drawPanel`，上面一排是 6 个卡槽、下面一排是"拥有的卡"（`CARDS` 全 6 张，超过 6 张会自动往第二排换行），底部一个 360×64 的"开始游戏"。实测（`CFG.cardSlot` 107×160、`cardGap` 24）：面板 x 40..900、y 150..948；卡槽 x0 = 89、间距 131、y 340..500；卡池 y 630..790；按钮 290..650 × 844..908
- 新增：点卡池 → 进第一个空槽，点卡槽 → 放回（`deckClick`，:552）；已在槽里的卡在卡池里画成灰的（`CFG.cardFace.gray`，和战斗中同一档），悬停高亮沿用选中的那圈黄色光环 `drawPickRing`（:484，`#ffe14a` + shadowBlur 24），空槽画的是 recess 的暗框（`rgba(0,0,0,0.28)` + 同一圈 `CFG.cardFace.ring`，和卡槽边框一致），槽位本身不预填任何卡。未满 `deckTarget()` 张时"开始游戏"整块盖灰、点了没反应（`deckFull()`，:364）
- 新增：`confirmDeck()`（:439）—— 点开始后把 `state.cool` 按最终卡组重算（`deckCool`，:352，读的是已有的 `coolStart`，慢/很慢卡仍是 `INFO.cdTiers × INFO.cdFirst` 的开局冷却），切到 `out`，**这一刻才 `playBgm()`**，所以选卡全程无声
- 修改：战斗里的卡栏、拖拽预览、tooltip、`slotAt`、数字键选卡、`state.plants.push({… card: state.deck[state.selected]})` 全部改为读 `state.deck`（:854 / :911 / :919 / :115 / :1153 / :1172 / :1188）—— 原来这些地方是写死 `CARDS[i]`（六张全上），现在只画被选进槽的那几张，空槽位跳过、数字键按到空槽不动作。也就是说选卡结果真正决定了本关能用哪些卡，冷却也按它算
- 修改：三条重开路径统一改走 `beginRun()`（:396）—— 失败重试（:1066）、继续弹窗里的"重新开始"（:1079）、选项面板里的"确定"（:1095），原来是直接 `playBgm()` 的第三处也换成 `beginRun()`。效果：重开会重新走一遍选卡，而且选卡期间不响音乐（先前 `setMenu(false)` 那句会让音乐在选卡时就响，已去掉）
- 新增：`resetRun()`（:304）现在把 `deck` 设为 `fullDeck()`、`deckPhase`/`deckT`/`camX`/`lineup` 复位；`makeRun` 同样初始化为 `fullDeck()`（game.js:66）
- 说明（要留意）：**卡组按你的话不进存档**，`SAVE_KEYS` 里依旧没有 `deck`。后果是"继续游戏"回来的那一局不重新选卡（按你选的"仅全新开局"），而它拿到的卡组是 `fullDeck()` = 全部拥有的 6 张 —— 今天 6 张卡正好等于卡槽上限 6，所以读档局的卡栏看着和选满 6 张一样；等你以后卡多过 6 张，读档局会超出可选范围，那时候要么把 deck 纳入存档、要么给读档也走一次选卡，你说一声我再动
- 未做：选卡面板上没有阳光/费用概念，也还没做卡片信息悬浮详情（只显示卡名所在的那套 tooltip，未接入选卡页）；视角右移期间不显示网格以外的场地装饰

## v0.1.2（2026-10-26）
- 新增：`CFG.shadow = { color: '0,0,0', alpha: 0.22, squash: 0.22, partner: 0.66, monster: 0.7, gmilk: 0.6, milk: 0.5, bullet: 0.45 }`（game.js:24）—— `alpha` 是浓度，`squash` 是椭圆压扁比（短半轴 = 长半轴 × 0.22），后面五个是**每类实体的影子宽度 = 它自己贴图宽度 × 这个系数**，想要哪种实体的影子大一点小一点直接改对应那个数（`milk` 这一档暂时没接上，见末尾）
- 新增：`drawShadow(cx, groundY, w)`（scenes/test.js:378）—— 一只 `ctx.ellipse`，中心就落在实体的**脚线**上（不是贴图中心），`save()/restore()` 包住所以不污染外面的 fillStyle/globalAlpha
- 新增：render 里在所有实体之前统一铺一层影子（scenes/test.js:461 起四组循环：伙伴 → 怪物 → 金の牛乳瓶 → 子弹）—— 影子画在贴图之前，所以任何一只的影子都不会压到别的实体身上；位置在网格线之后，影子会把脚下那截网格线盖淡一点，读起来像真的站在地上
- 实测（宽度都按 ×0.22 得短半轴）：中二企鹅轮廓 148.7 → 影子 104.1（长半轴 52、短半轴 11.4，脚线 = 行中心 + 81）；伙伴 でらっくま 167.1 → 110.3、ちびみるく系 139.5 → 92.1、touchhold 186 → 122.8（脚线 = 行底 − `CFG.footMargin`）；牛乳瓶 148.8 → 89.3；子弹 `CFG.bulletSize` 64 → 28.8（长半轴 14.4、短半轴 3.2），影子落在子弹所属行的脚线上，弹体本身在行中心飞，所以看得出是"贴着地飞过来"
- 说明：怪物影子跟着 `monsterBox` 走，所以你再手调 `scale` 或 `CFG.monster.feet` 时影子会自动同步，不用另改
- 未做（等你一句话）：**掉落的牛奶**没加影子 —— 它有两种落点（自然掉落的 `k.bottom` 是行底、咪璐库产出的抛物线落点 `arc.ty` 是脚线减半个牛奶），而且临期 1.2s 会淡出，影子要不要跟着一起淡得定个口径；另外选中卡跟着鼠标的那只半透明预览（test.js:632）在光标位置上、不贴地，也没给影子；特效（cp.png）和断网工具本来就不是站在地上的实体，不加

## v0.1.1（2026-10-26）
- 说明：版本号按你的话从 v0.0.x 进到 v0.1.1（"下一个版本号可以改为v0.1.1了"），后面继续逐条递增
- 修改：`INFO.monsters.chunipenguin.speedMin/speedMax` 25/35 → **27/33**（info/info.js:122）—— 每只新刷的企鹅仍是在这个区间里抽一次定终身（`randRange` 连续值，[27, 33)），抽法、读点、减速倍率都没变，只动了这两个数
- 说明：这次改的只是 info 里的数值，没有新增字段，所以存档判断不用再加条件，上一版（v0.0.96）丢弃的那两份档照旧不会读回来

## v0.0.96（2026-10-26）
- 修改：`INFO.monsters.chunipenguin` 的 `speed: 30` 换成 `speedMin: 25` / `speedMax: 35`（info/info.js:122）—— 字段名沿用卡片 `atkMin`/`atkMax` 的写法，仍待在数值字段那一组（`tier` 之后、`flip` 之前）
- 新增：每只怪自带 `m.speed` —— `spawnMonster`（scenes/test.js:143）里 `speed: randRange(mi.speedMin, mi.speedMax)`，用的是文件里已有的 `randRange(a, b) = a + Math.random() * (b - a)`（:39，和 `randAtk`、咪璐库产出计时同一个抽法），所以是 [25, 35) 的连续值而不是整数；刷出来就定了，之后不再重抽
- 修改：移动读点 scenes/test.js:974 → `m.x -= m.speed * sf * dt`；`sf` 仍是 `m.slow > 0 ? CFG.monster.slow : 1`，减速倍率与 `m.frozen` 的 gate 都没动，减速照旧是临时乘数而不是改基准
- 修改：save.js:104 的存档有效性判断加上 `typeof m.speed === 'number'` —— 怪物记录从此带一个必填字段，改动之前写下的档里没有它，读回来 `undefined * dt` 会把 x 变成 NaN，怪就僵在场上不再前进。按你定的"旧的存档先丢弃"整份丢弃，只 console.warn 一行"存档数据无效 ××"
- 说明：因此现存的两份档下一次进场景都会被丢弃 —— `data/save_test1.json`（wave 7、场上 5 只怪、没植物）与 `data/save_test2.json`（wave 0、4 只怪、1 株植物），两只怪物的 speed 字段实测全部缺失；场景从头开始，离开场景时写回带 speed 的新档。想立刻清干净就直接删这两个文件
- 未改：手动出怪按钮（scenes/test.js:828）同样走 `spawnMonster`，所以手刷的企鹅也是 25–35 随机；`CFG.gmilk.speed`（瓶子右移 800）、`INFO.cards.*.bulletSpeed` 与这次无关

## v0.0.95（2026-10-26）
- 新增：`INFO.monsters.chunipenguin.speed: 30`（info/info.js:122，放在 tier 之后、flip 之前，数值字段成组、贴图和渲染字段仍留在末尾）—— 怪物的移动速度现在是每种怪自己的数据，以后新增怪各填各的
- 修改：唯一的读点 scenes/test.js:973 `m.x -= INFO.monsters[m.type].speed * sf * dt`，`sf` 还是 `m.slow > 0 ? CFG.monster.slow : 1`，所以减速倍率 `CFG.monster.slow: 0.5` 与冻结 `m.frozen` 的 gate 都没变，速度数值本身沿用原来的 30，走路手感一模一样
- 移除：`CFG.monsterSpeed: 30`（原 game.js:16）—— 搬到 info 后没有别的读点，全项目 grep 只剩 update.md 里 v0.0.39 那条历史记录（"怪物移动速度 CFG.monsterSpeed 44 → 30"）
- 说明：`INFO.monster`（单数：atkInterval / atkDamage）仍是所有怪共用的攻击参数，这次没碰；只有速度做到了按类型

## v0.0.94（2026-10-26）
- 修改：`gmilkHit`（scenes/test.js:256）纵向换成脚线判定，和上一版 touchhold 同一个根因、同一个口径 —— `fy = box.y + box.h / 2`（怪实际站在哪一行），要求 `r.y - r.h / 2 ≤ fy ≤ r.y + r.h / 2`；横向照旧拿贴图轮廓和瓶子矩形重叠（`Math.abs(b.x - r.x) <= r.w / 2 + b.w / 2` 没动）
- 效果：瓶子在 row2 时命中从 `[false,false,true,true,false]` 变成 `[false,false,true,false,false]`，只扫自己那一行，向下越界那 32.8px 不再顺路把 row3 的企鹅一起清掉；未触发瓶子的起爆判定走同一个函数（test.js:1062 的 `some(...)`），所以下面那行的怪路过不会再替上面的瓶子起爆
- 说明：数字上脚线 `374 + 186 · row` 正好等于瓶子矩形的底边（瓶底 = 行底 − `CFG.footMargin`，而 `feet = 81 = ch / 2 − footMargin`），闭区间取等号，所以这个纵向判定目前严格等价于"同一行"。代价是它贴着边界 —— 如果你以后把 `CFG.monster.feet` 调到大于 81（怪落到地面线以下），瓶子会打不到自己那一行，到时候说一声我换口径
- 实测：瓶子 row k 的纵向区间 `[225.2 + 186k, 374 + 186k]`（`CFG.gmilk.scale = 0.8` → 148.8 × 148.8）；怪脚线 row0..4 = 374 / 560 / 746 / 932 / 1118；旧口径阈值 `74.4 + 111.6 = 186`，`|186(j−k) − 37.2| ≤ 186` 解出 j = k 与 k+1，正是多出来的那一行；横向半距仍是 `74.4 + 74.33 = 148.73`
- 未改：`gmilkRect`、`resetGmilks`、`CFG.gmilk`、`monsterBox` 都原样

## v0.0.93（2026-10-26）
- 修改：`CFG.monster.feet: 52 → 81` —— 贴图整体往下挪 29px，81 就是 `CFG.grid.ch / 2 - CFG.footMargin`，正好落在同一格伙伴的脚线上（行底往上 12），怪和植物从此站在同一条地面线上；`drawMonster` 与 `monsterBox` 共用这个值，所以判定盒跟着一起下去
- 修复：touchhold 的爆破能打到不该打的行 —— `burstDamage` 纵向原来是拿整张贴图轮廓去和区域矩形重叠，而你已经把 `scale` 调到 1.20，贴图高 223.2 > 行高 186，一只怪的盒子会伸进上下相邻行，radius 1 的三行区域于是够到了第五行。现在纵向改成按**脚线**（`box.y + box.h / 2`，也就是它实际站在哪一行）判定，横向仍按贴图轮廓
- 说明：同一个根因还留着另一处 —— `gmilkHit`（金的牛乳瓶）纵向也用整张轮廓，瓶子在 row2 时实测命中 `[false,false,true,true,false]`，也就是连下面那一行一起扫掉（223.2 高的盒子向下越界 32.8px）。要不要一并换成脚线判定，你说一声我就动（就那一行）
- 说明：你手调的 `scale: 1.00 → 1.20` 我没动，轮廓盒按它走：`148.7 × 223.2`，半宽 74.33
- 实测：`CFG.monster.feet = 81 = CFG.grid.ch / 2 - CFG.footMargin`；row2 的脚线 746（行带 572..758，与伙伴一致）；爆破 @row2 → 打 row1/2/3、@row0 → row0/1、@row4 → row3/4，其余行 hp 不动；失败判定左缘随新宽度变成 `x ≤ 74.3`（x=74 → lose、x=75 → null）；一帧里 pivot `translate(900, 746)`、blit `(-74.3, -223.2, 148.7, 223.2)`、红框 `strokeRect(825.7, 522.8, 148.7, 223.2)`

## v0.0.92（2026-10-26）
- 修复：场景1崩溃 —— `data/save_test1.json` 里存着一只 `type: 'zombie'` 的怪（就是改名前的键），`loadRun` 原来只校验 `plants` 的卡还在不在，怪物类型没校，读回来 `drawMonster` 取 `INFO.monsters['zombie'].scale` 就抛 TypeError，整帧渲染挂掉。现在 save.js:104 的有效性判断加上 `o.monsters.every(m => INFO.monsters[m.type])`，这种档整份丢弃（沿用"旧的存档先丢弃"），只 console.warn 一行"存档数据无效 test1"，下次离开场景会写回新档
- 新增：`CFG.monster.feet: 52` —— 脚线位置（行中心往下 52，就是原来那个占位圆的底边），`drawMonster` 与 `monsterBox` 共用它，改一处两边同步；`CFG.monster.slowAlpha: 0.55` —— 减速蓝的浓度
- 新增：`monsterBox(m)`（scenes/test.js:375）—— 由贴图算实际轮廓盒 `{x, y, w, h}`：`plantSize(imgs['enm_' + m.type], info.scale)`，垂直中心 = 行中心 + `feet` − h/2（scale 1.00 时是 123.9×186，中心比原来占位圆的圆心高 41px）
- 新增：`slowSprite(key)`（scenes/test.js:382）—— 起一张离屏画布把贴图重画一遍，再 `globalCompositeOperation = 'source-atop'` + `slowColor` 以 `slowAlpha` 叠蓝，只落在不透明像素上所以边缘不会糊出矩形；按怪物类型缓在 `slowImgs` 里，一种怪只合成一次。`drawMonster` 在 `m.slow > 0` 时换用它 —— 谁给的减速都一样，所有带减速 buff 的怪统一变蓝
- 修改：`drawMonster` 支持左右翻转，走新加的 `INFO.monsters.chunipenguin.flip = true`（和卡片同一个字段名）；翻转是在脚线支点上 `scale(-1, 1)`，所以咬合压扁动画照旧踩在脚下
- 修改：4 处遗留的 `52` 全部改用 `monsterBox` —— scenes/test.js:81 爆破伤害的身体盒、:255 金的牛乳瓶命中、:233 失败判定的左边缘、render 里选中卡时鼠标下的红框（矩形也从写死的 116×116 换成实际轮廓）
- 说明：轮廓换了之后判定点会移动 —— 失败触发从 `x ≤ 52` 变成 `x ≤ 61.9`（早 9px），金奶瓶的命中距离从 126.4 变成 136.3；垂直方向怪物中心抬高 41px，跨行不会误判（相邻行差 186 > 阈值 167.4）
- 说明：`CFG.monster.slow: 0.5`（减速时的速度倍率）和减速计时 `m.slow`（秒）都没动，蓝只认 `m.slow > 0`；子弹那边的 `if (b.slow) hit.slow = max(...)` 逻辑原样
- 实测：未减速帧 blit 的是 `enm_chunipenguin.png @(-61.9,-186,123.9,186)`，`slow > 0` 的帧 blit 的是离屏 canvas（同一矩形），离屏画布三次帧只建 1 张；主画布 `scale` 收到 `(-1, 1)`；红框 = `strokeRect(838.1, 531, 123.9, 186)`，鼠标 y=700 命中、y=500（头顶以上）不命中；touchhold 爆破对同行怪扣 1800、挪到 row0 再爆不扣血；金奶瓶 gap 136 → true、137 → false；失败判定 x=61 → lose、x=63 → null；拿旧的 save_test1.json 过一遍新校验得 false（丢弃、不报错）

## v0.0.91（2026-10-26）
- 修改：怪物 `zombie` 改名换身份 —— `INFO.monsters` 的键改成 `chunipenguin`（取贴图名 `enm_chunipenguin.png` 去掉 `enm_` 前缀），条目按卡片那套字段顺序补齐：新增 `id: 101`、`name: '中二企鹅'`、`img: 'images/enemies/enm_chunipenguin.png'`、`scale: 1.00`，`level: 1 / weight: 4000 / tier: 1` 原样没动
- 修改：`scale` 是这只怪的大小旋钮（1.00 = 占满一格行高 `CFG.grid.ch` = 186px，按贴图 734×1102 等比得宽 123.9）
- 修改：两个 tracklist 的 `spawnTable` 从 `['zombie']` 改成 `['chunipenguin']`（出怪表按 `INFO.monsters` 的键抽，所以只有这一处引用要跟着换）
- 新增：启动图片清单里按 `INFO.monsters` 逐个 `loadImage('enm_' + k, INFO.monsters[k].img)`（game.js:238），和卡面 `card_` / 伙伴 `ptn_` 同一套约定
- 修改：`drawMonster()` 不再画占位绿圆和两只眼睛，改成 `plantSize(img, INFO.monsters[m.type].scale)` + `drawImage(img, -s.w / 2, -s.h, s.w, s.h)`；脚线支点仍是原来的 `y + 52`（行中心往下 52），所以咬合时的压扁动画还是踩在脚下
- 说明：占位圆一消失，减速用的 `CFG.monster.slowColor` 就没有承载物了（字段我留着没删）—— 要不要在贴图上叠 tint 或者脚底下画个色圈，等你说
- 说明：这张贴图是朝右的，而怪是从右往左走，所以现在看起来倒着走；`flip` 没加（卡片那边就是 `info.flip` 一个布尔字段），要就说一声
- 说明：还有 4 处 `52` 是当年那个半径 52 的占位圆留下的，跟新轮廓已经不吻合（scale 1.00 时贴图半宽 62、整高 186 而不是 104）：scenes/test.js:84 爆破伤害的怪物身体半径、:237 失败判定的左边缘、:258 金的牛乳瓶命中、:498 断网时的红框；:383 那处是脚线，故意留着。按"命中判定按贴图轮廓"那条规矩要不要一并换成实际轮廓，等你点头
- 实测：`Object.keys(INFO.monsters) = ['chunipenguin']`，`imgs.enm_chunipenguin.src` 正确；test1 第 1 波刷 1 只、type 是 `chunipenguin`、waveHp 270；render 里怪物只 drawImage 一次，矩形 `(-61.94, -186, 123.89, 186)`（相对脚线支点），row 0 脚线 = 345；带咬合的那帧 rect 不变（缩放走 transform），无报错

## v0.0.90（2026-10-25）
- 新增：`CFG.bgBlur: 12` —— 背景模糊半径，单位是画布像素（逻辑分辨率 2048×1152），设 0 就等同不模糊
- 修改：`render()` 的底图（scenes/test.js:400）三步走 —— `ctx.filter = 'blur(' + CFG.bgBlur + 'px)'` → `drawImage` → 立刻 `ctx.filter = 'none'`，紧跟复位所以后面的伙伴、怪物、子弹、牛奶、卡槽、横幅、弹窗统统不糊
- 修改：绘制矩形按半径向外扩了一圈（`-12, -12, CFG.W + 24, CFG.H + 24`）—— canvas 的 filter 模糊会采样图片之外的透明区域，不扩边就四条边各糊出约 12px 的半透明衰减，而底图是每帧唯一负责铺满全屏的绘制，边上有透明会把上一帧残影透出来；扩边后模糊图仍然完全盖住画布，构图只是放大 1.2%
- 说明：菜单底图（scenes/menu.js:33 的 `imgs.bg`）没动，你说的"背景"我按场景背景处理；要菜单一起糊说一声
- 说明：filter 模糊是每帧一次全屏操作，Chromium 走 GPU；如果掉帧，先把 `CFG.bgBlur` 调小或设 0，也可以改成启动时把图预糊到一张离屏画布（一次成本，之后 drawImage 不带 filter），要你点头才做
- 实测：一帧内的序列是 `filter=blur(12px)` → `drawImage(bg1.png, -12,-12, 2072,1176)` → `filter=none`，随后 13 次 drawImage（golden_milk / milk / 六张卡面 / net_err）全在 none 之后；`bgBlur = 0` 时矩形退回 `(0,0,2048,1152)`

## v0.0.89（2026-10-25）
- 新增：关卡属性 `bg` —— `INFO.tracklist.test1.bg = 'images/backgrounds/test.png'`、`INFO.tracklist.test2.bg = 'images/backgrounds/bg1.png'`，背景从此是关卡数据，两个测试场景各填各的（不给缺省兜底，避免又出现"数据没填也能跑"的退化情况）
- 新增：启动图片清单里按 tracklist 逐个 `loadImage('bg_' + key, INFO.tracklist[key].bg)`，所以 `imgs.bg_test1` / `imgs.bg_test2` 各是一张独立的图
- 修改：测试场景的底图从 `imgs.bg` 改为 `imgs['bg_' + state.slot]`（scenes/test.js:400），画的位置和尺寸没动，仍是 `drawImage(img, 0, 0, CFG.W, CFG.H)`
- 说明：菜单底图没动，仍走原来的 `imgs.bg`（= test.png）；`imgs.bg` 那一条加载保留，代价是 test.png 被解码两次（同一文件，浏览器有缓存），不改菜单代码是更小的动作
- 说明：bg1.png 是 1080×452（≈2.39:1），画布是 2048×1152（16:9 ≈ 1.78:1），拉满整屏会被竖向拉伸约 34%；原来的 test.png 是 512×270（≈1.90:1），失真小一些。要不要改成按比例铺（左右留边或裁切）等你说
- 实测：`imgs` 里 bg / bg_test1 / bg_test2 三条 src 正确；test1 场景首张 drawImage 取到 test.png、test2 取到 bg1.png、菜单仍是 test.png，两次 render 均不报错

## v0.0.88（2026-10-25）
- 新增：红字描黑边能做到（canvas 2d 的 `strokeText`）—— `CFG.banner` 加 `outline: 8`（描边粗细，直接改这个数）和 `outlineColor: '#000'`；横幅块先 `strokeText` 再 `fillText`，同一个位置 (1024, 576)，`lineJoin = 'round'` 让粗描边的转角不炸刺；整块用 `ctx.save()` / `ctx.restore()` 包住，`lineWidth`、`globalAlpha`、字体都不外泄给后面的弹窗描边
- 新增：`state.result`（`'win'` / `'lose'` / `null`），`makeRun` 与 `resetRun` 起表 null；**不进 `SAVE_KEYS`**，读档后由条件自己重新判（旧档没这个键也不炸）
- 新增：`resultCheck()`（updateGame 末尾、`waveWarnCheck()` 之后），失败先判、成立就 return：失败 = 任一怪物 `m.x - 52 <= 0`，52 是怪物现在画出来的那个圆的半径，也就是贴图左缘碰到屏幕最左 x=0；胜利 = 本关最后一波已经刷出（`state.wave === lv.waves`）且这一波的怪物里没有 `hp >= CFG.monster.threshold` 的（低于临界值即判定死亡，已经被移出数组的更算死亡）
- 新增：两个提示框，沿用"重新开始"确认框那套 640×260 木底板 + 半透明遮罩，`uiRects` 加 `resultPanel` / `winBack` / `loseBack` / `loseRetry` —— 胜利框居中一个"返回"，失败框是"返回" + "重试"（240×64、间距 40，和 confirmYes/confirmNo 同几何）
- 修改：主循环 gate 加 `state.result`（game.js:224），`testKey` 的屏蔽条件加 `state.result`，`testHover` 在框打开时只认框上的按钮，`testClick` 把 result 分支放在最前面并 return —— 实测框开着时点 出怪 / 卡槽 / 牛奶 全都吃不到，游戏时钟冻住不动
- 修改：按钮动作复用现有那两套路径 —— "返回"与菜单里的"退出"一致（`state.scene='menu'` + `bgm.pause()` + `writeRun()`），"重试"与"重新开始"确认后一致（`resetRun()` + `playBgm()` + `writeRun()`）
- 说明：按字面实现，所以更早波的残怪不会挡住胜利（它走到左边缘会触发失败，失败优先）；手动"出怪"刷的是 `wave: 0` 那一拨，不参与胜利判定；被金的牛乳瓶直接移走的最后一波怪物也算击杀
- 说明：（暂时决策）框开着期间 bgm 继续放、没做结算统计/音效/胜负图标，怪物离场线是 x ≤ -60，比左边缘判定晚，所以不存在"没判到就消失"
- 实测：最后一波 cohort 全 `<90` → win、有 120 → 不判、第 19 波残怪 200 → 仍 win；x=52 → lose、x=53 → 不判、同帧 win 条件也成立时得 lose；两条横幅的 `strokeText` 参数 (text, 1024, 576) 与 `lineWidth=8`、`strokeStyle='#000'` 已核对，框的文字分别为 胜利/返回 与 失败/返回/重试

## v0.0.87（2026-10-25）
- 新增：`CFG.banner = { font: 120, color: '#ff4a4a', fade: 0.4, bigHold: 5, lastHold: 1 }` —— "大字"我取了 120px（画布 2048×1152），红色沿用项目里已有的那个红 `#ff4a4a`（与卡面阳光不足同色），`fade` 是淡入/淡出时长，`bigHold` / `lastHold` 是两条横幅各自的持续
- 新增：`showBanner(text, hold)` 与 `state.banners`（元素 `{text, hold, t}`）：updateGame 里 `t += dt`，走满 `fade*2 + hold`（大波 5.8s、最后攻势 1.8s）自动摘掉；render 在场景与 HUD 之后、菜单/弹窗遮罩之前用 `fillText` 画在屏幕正中 `(CFG.W/2, CFG.H/2)` = (1024, 576)，只改 `globalAlpha`，不描边、不画底框（无边框大字）
- 新增：`waveWarnCheck()`（updateGame 末尾、`waveCutCheck()` 之后）—— 下一波是大波、且这一波的出怪剩余倒计时进到 7s 以内时，显示"一大波敌人正在靠近"（淡入0.4 / 持续5 / 淡出0.4）；用 `state.bigWarned` 保证每个大波只提示一次，出波时复位
- 修改：`spawnWave()` 末尾 —— 本波是本关最后一波时，出怪的同一帧显示"最后攻势"（淡入0.4 / 持续1 / 淡出0.4）
- 新增：`state.bigWarned`、`state.banners` 进 `makeRun` / `resetRun` / `SAVE_KEYS`（横幅是纯字段对象可直接落盘；旧档没这两个键 → 空横幅、未提示，不做迁移）
- 说明："倒计时7s时"按"大波刷新倒计时走到 7s"实现，两条到达方式都触发：①被清场规则压到 7s 的那一帧；②没被压缩、52s 自然倒数过 7s（实测 remain 正好 7.0s 触发，同一波之后不再重复）。如果你要的是"只有被压到 7s 才提示"，说一声我把判据换成压短动作本身
- 说明：最后一波同时也是大波，所以它会先拿到"一大波敌人正在靠近"（提前 7s 起、5.8s 结束），再在出怪瞬间拿到"最后攻势"，两条错开 1.2s 不会叠字；实测时序 提示@0.01s → 最后攻势@7.02s
- 说明：淡入淡出只作用透明度（没有缩放、位移，也没加音效）；倒计时与横幅都走游戏时钟，快速模式下 5.8s 是游戏时间（真实 2.9s）；菜单、暂停确认、读档期间 updateGame 不推进，横幅会冻在半透明状态，回到游戏后继续放完

## v0.0.86（2026-10-25）
- 修复：开局五行最终权重全为 0 的退化情况 —— 新增 `CFG.wave.rowInit: 2`，`makeRun` 与 `resetRun` 把每行的 Last 与 SecondLast 都起表成 2 而不是 0（`Array(CFG.rows).fill(CFG.wave.rowInit)`）。`6L+S+7 > 4*行数` 才有正权重，5 行时 `7*2 = 14 > 13` 刚好越过门槛，所以起手五行权重相等（各 0.01，和 0.05），第一只怪就是公式给出的等概率落点，不再需要特判
- 移除：`pickRow()` 里 v0.0.85 加的 `if (total <= 0) 均匀随机` 兜底分支——现在任何时刻 total 都严格大于 0，抽行只走公式（实测连抽 30 万次刷新，每次抽样前的权重总和最小值仍是 0.05，从没塌到 0）
- 说明：正权重是守恒的——刚被刷新的那一行确实是 0 权重，但其余四行同时 +1，所以任何时刻最多只有一行是 0，总和不会归零；`rowInit` 依赖行数，若以后 `CFG.rows` 改了要按 `6L+S+7 > 4*行数` 重取（6 行时起表得是 3）
- 说明：落点分布不受影响（从新起表跑 1 万次刷新得 2007/1996/1991/1996/2010），test1 第 20 波 37 只的落点是 6/7/8/8/8；旧档没有这两个数组时读回起表值 2，不做迁移

## v0.0.85（2026-10-25）
- 新增：每行两个计数 `state.rowLast` / `state.rowSecondLast`（长度 `CFG.rows` 的数组，初值 0），`makeRun` 与 `resetRun` 起表，两个都进 `SAVE_KEYS`
- 修改：`spawnMonster()` 成为"刷新"的唯一入口，进去先按你的规则推进计数——刷新那一行 `SecondLast ← Last`、`Last ← 0`，其他行的 Last 与 SecondLast 各自 +1；所以自然出怪与手动出怪都会走这套计数
- 新增：`rowWeight(i)` —— 基础权重 `W = 1 / CFG.rows`（5 行即 0.2），`PL = (6*Last*W + 6*W - 3) / 4`，`PSL = (SecondLast*W + W - 1) / 4`，返回 `W * min(max(PL + PSL, 0), 1)`；`pickRow()` 按这 5 个最终权重加权抽一行
- 修改：出怪的落点从 `Math.floor(Math.random() * CFG.rows)` 均匀随机改为 `pickRow()`，两处都换（`spawnWave()` 和出怪按钮），公式对两者同样生效
- 说明：口径上 Last = 本行上次刷新到现在隔了几次刷新（刚刷新完是 0），SecondLast = 上上次刷新到上次刷新之间隔了几次（刷新时先由旧的 Last 交接过来）；权重最大就是 W（PL+PSL ≥ 1 时被 min 截掉），最小 0；计数只随刷新变化，怪物死亡或离场不动它
- 说明：开局 5 行都是 Last=SecondLast=0，此时 PL+PSL = −0.65 → **每行最终权重都是 0**，加权抽样没有依据，这一种情形我退回均匀随机（等于只按基础权重 W 落点）；只要有任何一行凑出正权重就完全走公式。实测开局 300 次能覆盖全部 5 行
- 说明：实测带反馈跑 1 万次刷新，五行落点 1997/2007/1987/2013/1996（≈ 各 1/5，欠账的行会被公式抬起来）；test1 第 20 波 37 只的落点是 7/8/7/7/8。注意同一波内的每一次刷新都会立刻推进计数，所以一波后段更倾向落到还没走过的行

## v0.0.84（2026-10-25）
- 新增：每波记录出怪总hp —— `state.waveHp` 在 `spawnWave()` 里逐只累加本波刷出怪物的 hp；怪物对象新增 `wave` 字段（它属于第几波），`makeRun`/`resetRun` 起表 0，并进 `SAVE_KEYS`
- 新增：`CFG.wave` 三个常数 `hpCut: 0.65`（催波的本量比例）、`cutGap: 3000`（下一波不是大波时压成的倒计时）、`bigCutGap: 7000`（下一波是大波时压成的倒计时）
- 新增：`waveCutCheck()`（updateGame 每帧末尾调用）与 `cutWaveGap(gap)`（只在剩余时间大于 gap 时把它压到 gap，所以只缩短、不延长，重复调用幂等）
- 规则：下一波**不是大波** → 只统计 `m.wave === state.wave` 的怪（上一波出的不再计入）的当前hp之和，低于 `state.waveHp * CFG.wave.hpCut` 就把下一波倒计时压到 3s；下一波**是大波** → 场上怪物全空（"所有怪物生命为0"）就压到 7s；原有不足 3s/7s 时一律不变
- 修改：出怪按钮手动出的怪记 `wave: 0`，不进任何一波的hp统计（但它还活着时会挡住大波前的"清场"判据）
- 说明："所有怪物生命为0"只能落地成"场上没有怪物"（`state.monsters.length === 0`）：hp 掉到 0 及以下的怪在 updateGame 里就被 `state.monsters.filter(m => m.x > -60 && m.hp > 0)` 摘掉了，场上永远不存在 hp<=0 的怪；副作用是走出左边界（x<=-60）的怪同样算"清场"，而现在还没有胜负判定
- 说明：65% 是严格小于才触发（实测 waveHp 540 时总和正好 351 不催、350 催）；催波改的是剩余时间，`state.lastSpawn` 不动，所以每出一波后倒计时照旧重新掷成正常的 25–31s / 52s，只是中途被压短
- 说明：实测把每波的怪在 1s 后清空，test1 时间线变成 第1波@19s、第2~9波间隔 5s、第10波 9s、第11~19波 5s、第20波 9s（= 1s 清场 + 检测粒度 1s + 3s/7s 催波）；不催波时仍是 v0.0.82 那条时间线。催波没有任何 UI 提示（倒计时条没画，也没要求）

## v0.0.83（2026-10-25）
- 修改：大波的额外系数也带上限 8 —— `spawnWave()` 先把 `min(floor(波次/3), 8)` 提成局部量 `unit`，出怪量 = `unit * 出怪倍率`，大波再 `*= unit`（v0.0.82 里那个不带 cap 的 `floor(波次/3)` 作废）
- 效果：只有 `floor(波次/3) > 8` 即第 27 波及以后的大波变小，实测 test2 最后一波（第 30 波）81 → 65 只（8×8=64 的额度）；第 10 波（3×3=9 → 10 只）、第 20 波（6×6=36 → 37 只）与所有非大波一律不变，倍率参与也一样（倍率 2 的第 10 波仍是 19 只、第 30 波 8×2×8=128 → 129 只）

## v0.0.82（2026-10-25）
- 新增：`CFG.wave` 的间隔常数 `first: 19000`（第一波固定 19s）、`gapMin: 25000` / `gapMax: 31000`（之后每波随机 25–31s）、`bigGap: 52000`（下一波是大波则 52s）、`bigEvery: 10`（"每整 10 波"的那个 10）
- 移除：`CFG.monsterInterval`（原来的固定自然出怪间隔）——它的职责已由"每波自己掷一次间隔"取代，19s 这个值搬进 `CFG.wave.first`，全库已无代码引用它
- 新增：scenes/test.js 的 `isBigWave(w)`（`w % CFG.wave.bigEvery === 0 || w === 本关 waves`，即整 10 波 + 本关最后一波）与 `randWaveGap()`（`state.wave === 0` 时返回 19s；否则看**下一波**是不是大波，是则 52s，否则 `25000 + Math.random() * 6000`）
- 修改：`spawnWave()` 的出怪量 —— 大波在 `min(floor(波次/3), 8) * 出怪倍率` 之后**再乘一次 `floor(波次/3)`**（按你写的字面，这个额外乘数不带 8 的上限）
- 修改：updateGame 里的出怪门从固定间隔改为 `state.clock - state.lastSpawn > state.waveGap`，每出一波就把 `state.waveGap` 重新掷成到下一波的间隔
- 新增：`state.waveGap`（当前这一波要等多久），`makeRun` 起手 `CFG.wave.first`、`resetRun()` 同样重置，并加进 `SAVE_KEYS`（读档时剩余的等待时长会接着走）
- 说明：一句"是大波"只算一次——test1 的第 20 波既是整 10 又是最后一波，出怪量只乘一次 `floor(20/3)`；倍率乘在基础出怪量上、大波乘数在它之后（倍率 2 的第 10 波 = 3×2×3 = 18 → 19 只级别 1 的怪）；实测规模 第 9/10/11/19/20 波 = 4/10/4/7/37 只，test2 第 29/30 波 = 9/81 只
- 说明：间隔走的是游戏时钟，所以快速模式下真实时间折半（25–31s → 12.5–15.5s）；"下一波是大波"只看下一波，因此大波之前那一次等待是 52s，大波之后那一波回到 25–31s；实测 test1 时间线 第1波@19s、第2~9波间隔 25.5~29.6s、第10波间隔 52.0s、第11~19波 25.6~30.5s、第20波间隔 52.0s，第 20 波之后不再自然出怪
- 说明：旧档没有 `wave` / `waveGap` 两个键，读回来是第 0 波 + 19s 起表（按「旧的存档先丢弃」没做迁移）

## v0.0.81（2026-10-25）
- 新增：`INFO.monsters` 怪物表（放在 INFO.monster 之后），现有唯一一条 `zombie`：`level: 1`（级别）、`weight: 4000`（权重）、`tier: 1`（阶数）。键名 `zombie` 是我起的（照伙伴条目的拉丁文键名风格），要改成别的说一声；`INFO.monster`（atkInterval/atkDamage）原样没动
- 新增：`INFO.tracklist` 关卡表，键就是场景插槽键 `test1` / `test2`，每条三个属性——`waves`（波次总数：测试1 = 20、测试2 = 30）、`spawnMul`（出怪倍率，int，默认 1）、`spawnTable`（出怪表，本关会出现的怪物键名数组，现在只有 `['zombie']`）
- 新增：`CFG.wave = { div: 3, cap: 8 }` —— 出怪量公式里的两个常数（`min(floor(波次/div), cap) * 出怪倍率`）
- 新增：scenes/test.js 的 `spawnWave()`（本波出怪）与 `pickMonster(table)`（按权重随机抽一种：权重求和后 `Math.random()*total` 逐条扣减，实测 4000:6000 抽 4 万次得 15889:24111）
- 修改：`spawnMonster(row, key)` 多收一个怪物键，出怪记录带上 `type`（怪物存档本来就全字段入库，所以 `type` 跟着落盘，读档原样恢复）
- 修改：自然出怪的节拍从"每个间隔出 1 只"改成"每个间隔出 1 波"——`state.wave++` 后整波刷出，并且加了 `state.wave < lv.waves` 的上限，打完本关波次就不再自然出怪；"关闭自然出怪"选项照旧拦住整个波次推进
- 新增：`state.wave`（当前第几波，从 1 数起），`resetRun()` 归零，`SAVE_KEYS` 加入 `'wave'`（所以波次会随存档走；旧档没这个键时读回 0，即波次从头开始——按「旧的存档先丢弃」没做迁移）
- 说明：波次间隔我没另起常数，沿用的就是原来的自然出怪间隔 `CFG.monsterInterval`（19s 游戏时钟，快速模式折半），要单独设一个"波间隔"再说；一整波的怪是在同一时刻刷出的、行随机（可以重叠在同一行），没有做错峰出场；级别都是 1 时每波只数 = 出怪量 + 1，即第 1~2 波 1 只、3~5 波 2 只、6~8 波 3 只……24 波及以后 9 只（倍率是乘在出怪量上的，倍率 3 时第 3 波就是 4 只）；"直到级别总和严格大于出怪量"按字面实现成 `while (sum <= budget)`，所以怪物级别为 0 时这一波会无限刷（现有数据不会，提醒一下）
- 说明：`tier`（阶数）目前没有任何代码读取，纯数据预留；怪物的血量/攻击仍旧走全局的 `CFG.monster.hp` 与 `INFO.monster`，怪物表这一条只带级别/权重/阶数三项；出怪按钮是手动出 1 只（取 `spawnTable[0]`），不占波次额度也不推进 `state.wave`；波次没有任何 UI 显示（没有计数/大招预警），你没要求

## v0.0.80（2026-10-25）
- 新增：INFO.cdFirst = 2 / 3（slow / very slow 的初次冷却系数，写在 cdTiers 后面）
- 修改：开局与"重新开始"给 slow/very slow 卡起表时的冷却从完整 tier 时间改为 `INFO.cdTiers[cd] * INFO.cdFirst` —— touchhold（very slow）50 → 33.33s、らん（slow）30 → 20s，fast 卡依旧是 0（两处种子：game.js 的 makeRun 与 scenes/test.js 的 resetRun）
- 说明：改的只是"初始冷却"，之后每次放置仍然是完整的 tier 时间（testClick 里的 `state.cool[...] = INFO.cdTiers[info.cd]` 没动），卡面冷却条的比例口径也没动（`cool / cdTiers`，所以一开始的遮罩是 2/3 高）；冷却提示是 `Math.ceil` 向上取整，所以 touchhold 刚开局会显示"重新装填中...34 s"

## v0.0.79（2026-10-25）
- 规则（保留）：**info 里的伙伴条目按 `id` 升序排列**。这是数据侧的约定，不改代码——CARDS 依旧不带 `.sort()`（你上一轮撤掉了），文件顺序就是卡槽顺序与键盘 1~6 的顺序；以后加伙伴要插到 id 该在的位置，而不是一律追加在末尾
- 修改：按该规则把 info.js 里的两块顺序调换 —— meganekuma（id 6）放到 chibimilk（id 8）之前，两条内容一字未改，只换位置
- 效果：第 5 格变成めがねっくま（175 奶、starblue 带减速），第 6 格变成ちびみるく（200 奶、tap2 双发）；前 4 格不变

## v0.0.78（2026-10-25）
- 修改：两个角色的 id 互换 —— chibimilk（ちびみるく）6 → 8，meganekuma（めがねっくま）8 → 6，只动 info.js 里这两行，名称/花费/子弹/图片路径等都跟着各自的角色不变
- 说明：卡槽顺序仍按 info.js 的书写顺序，第 5 格还是ちびみるく、第 6 格めがねっくま；`id` 字段目前没有任何代码读取，纯粹是给后续按 id 调用预留的标识

## v0.0.77（2026-10-25）
- 新增：伙伴 `meganekuma`（name めがねっくま、id 8），取的是指令当时 chibimilk 的全部数据——hp 300、atkMin 1.35 / atkMax 1.45、bullet starblue（所以减速跟着它走）、bulletSpeed 5、cd fast、costmilk 175（你昨天自己从 100 调成 175 的那个值）、scale 1.00；只有名称与 id 不同。排到第 6 个，正好占满 6 个卡槽（键盘 6 可用）
- 修改：chibimilk —— costmilk 175 → 200；子弹 starblue → tap2；新增 `shots: 2`，一次攻击同时射出两颗子弹（一上一下）
- 新增：INFO.bullets.tap2 = { damage: 20, img: images/others/tap2.png }，除图片外与 tap 完全一致（没有 slow 字段，所以 chibimilk 不再给怪物挂减速；starblue 条目原样留着给めがねっくま用）
- 新增：CFG.bulletSpread = 40 —— 双发的上下偏移（`shots: 2` 时两颗子弹的 y 为格子中心 ±40，即 253/333，弹体 64 见方正好错开不重叠）。这个数值你没给，先取 40
- 修改：updateGame 的开火从 push 一颗改为按 `shots` push 一排（`shots !== 2` 时偏移为 0，行为与以前完全一致）。注意命中判定沿用"同行只看 x"的老口径（CFG.hitDist），所以双发垂直偏移不会让两颗子弹各打各的，而是同一只怪各挨一次 20 → 一轮 40 伤害
- 说明：图片按你的摆放习惯接好——ptn_めがねっくま.png（512×512）你已经放进 images/partners，但 images/cards 里没有对应卡面，我按 chibimilk 那次"卡面可以直接复制ptn.png"的同类做法复制了一份 card_めがねっくま.png；想换成自己画的卡面，把文件放进 images/cards 再说一声即可（键名 meganekuma 也是照 chibimilk/ran 的拉丁文风格起的，要改一并说）

## v0.0.76（2026-10-25）
- 新增：怪物处于减速状态时渲染成蓝色 —— CFG.monster.slowColor = '#3a5c7a'（和默认 #5c7a3a 同明度的蓝），drawMonster 的身体填充按 `m.slow > 0` 切换；眼睛颜色、咬合时的挤压动画一律不动
- 修改：存档记录每个怪物的所有状态 —— snapshotRun 不再只挑 row/x/hp/bleed 四个字段，改为拷贝怪物对象自身的每个字段、只跳过 `eat`；loadRun 相应整份还原（Object.assign 复制），减速剩余秒数、frozen、biteT、eatT 这些以前会丢的字段现在都跟着走
- 说明：`eat` 仍然不入库（它指向 plant 对象，写进去会因循环引用让 JSON.stringify 抛错），读档后第一帧 update 会按 row/col 重新找到它正在啃的 plant；`m.eatT = undefined` 时 JSON 自然省略该键，回来时由原有的 `eatT === undefined` 分支重新起表；`frozen`（未死亡且曾在啃咬）能续上，所以读档后这些怪不会重新开始走路

## v0.0.75（2026-10-25）
- 新增：伙伴 `chibimilk`（name ちびみるく、id 6，按你说的 6，不是接着的 5），除子弹外全部照でらっくま（dxbear）：hp 300、atkMin 1.35 / atkMax 1.45、bulletSpeed 5、cd fast、costmilk 100、scale 1.00，`bullet: 'starblue'`。数组下标是 4，所以第 5 个卡槽、键盘 5
- 新增：INFO.bullets.starblue = { damage: 20, img: images/others/starblue.png, slow: 10 }，伤害与 tap 同为 20、飞行速度由卡片的 bulletSpeed 决定（也照 dxbear 取 5），`slow: 10` 即命中减速秒数
- 新增：images/cards/card_ちびみるく.png —— 直接复制 images/partners/ptn_ちびみるく.png（512×512 正方，卡槽的 1:1 卡面不会拉伸）
- 新增：怪物 buff「减速」。子弹命中时 `m.slow = Math.max(m.slow || 0, b.slow)`，多次受到取最大不叠加；updateGame 每帧 `m.slow -= dt` 递减；减速期间移速乘 `CFG.monster.slow`（0.5）、啃咬间隔变 `INFO.monster.atkInterval / 0.5`（即攻速也降 50%），归零自动恢复
- 新增：CFG.monster.slow = 0.5（减速的强度，移速/攻速共用一个系数，想改成 0.4/0.6 直接改这里）
- 修改：子弹对象多带 `type`（子弹名）与 `slow` 两个字段；渲染从写死 `imgs.tap` 改为 `imgs[b.type] || imgs.tap`（旧存档里在飞的子弹没有 type 时退回 tap，不会抛错）；BOOT 的子弹预加载从单独一行 tap 改为遍历 INFO.bullets，以后加子弹只写数据
- 说明："怪物新增 buff 栏"我按"新增一条 buff 定义"实现，没有给怪物画 buff 图标或读条（没要求就不加 UI）；怪物存档仍只写 row/x/hp/bleed 四个字段，所以离开场景再回来时怪物身上的减速剩余秒数会丢（子弹的 slow 字段是跟着 bullets 一起存的）；`id` 字段目前仍未被任何代码使用，下标 4 与 id 6 从此不再差 1

## v0.0.74（2026-10-25）
- 修改：`CFG.gmilk.speed` 1600 → 800，触发后的右移速度减半（约 2.5 秒扫过一屏）。只有这一个速度字段，未触发的瓶子本身不动，改这里就是改"触发后的速度"

## v0.0.73（2026-10-25）
- 新增：每行第 1 列左侧的固定实体「金の牛乳瓶」（images/others/golden_milk.png），5 行各摆一个，右边缘正好贴住第 1 列左边界（x 中心 = `CFG.grid.x - w/2` ≈ 113.6，脚底对齐伙伴用的 `CFG.footMargin`）。未死亡状态（`hp >= CFG.monster.threshold`）的怪物碰到它即触发：瓶子以 `CFG.gmilk.speed` 快速右移，一路上把它碰到的所有怪物直接清除（碰不到的只有别的行的怪物），飞出屏幕右边界（`r.x - r.w/2 > CFG.W`）后消失
- 新增：scenes/test.js 的 resetGmilks(s)（摆一行的瓶子，boot 图片加载完后对 test1/test2 两个插槽各调一次，resetRun 也调，所以重新开始会重新出现 5 个瓶子）、gmilkRect(b)（瓶子的中心与宽高）、gmilkHit(m, r)（判定沿用怪物半径 52 的"精灵矩形与怪物圆相交"口径，和 burstDamage 一致）
- 新增：CFG.gmilk = { scale: 0.8, speed: 1600 }（186×0.8 ≈ 149 见方、1600 px/s 约 1.2 秒扫过全屏）。这两个数值你没给，我先取了这两个，可直接改
- 修改：makeRun 增加 `gmilks: []`；SAVE_KEYS 增加 `'gmilks'`（元素是 `{row,x,launched}` 三个纯字段，可安全落盘），所以已触发的瓶子在存档里保持已触发、右移中的位置也一并续上；老档里没有这个字段时沿用刚摆好的 5 个瓶子
- 说明：判定只看同行——瓶子高 149 < 行高 186，跨行碰不到；已触发的瓶子清扫时不再区分怪物是否未死亡（按"碰到的所有怪物"处理）；一个瓶子用完即消失、本局不补（你没说要刷新，所以按一次性处理）；瓶子画在怪物之上，扫过去时不会被怪物遮住；未触发时瓶子纯静态，不吃鼠标点击、也不受断网影响

## v0.0.72（2026-10-25）
- 新增：键盘选卡——数字键 1~6 依次对应第 1~6 个卡槽（超出当前卡数的空槽位不响应），再按同一个键取消选中；` 键（反引号）切换断网，再按取消。选中卡片会清断网态、切换断网会清空选中，与鼠标点卡槽/点断网框的行为完全一致（同样受 milk 花费与冷却约束，开启"无冷却无花费"时不受限）
- 新增：scenes/test.js 的 testKey(e)；核心的 window keydown 监听改为按场景分发（主菜单不响应），Esc 取消选中/断网的原有逻辑搬进 testKey 保持不变
- 修改：不设放置键，放置伙伴仍然只能鼠标点击格子；`e.repeat` 被忽略，长按同一个键不会来回切换
- 说明：读取存档（loading）、选项面板（menuOpen）、两个提示框（resumeAsk/confirmRestart）打开期间键盘选卡与断网一律不响应，但 Esc 仍可用

## v0.0.71（2026-10-25）
- 新增：info.js 每个伙伴加 `id` 字段，按 cards 里的书写顺序从 1 开始——dxbear=1、milk=2、touchhold=3、ran=4，放在各自条目第一行（name 之前），便于后续按 id 调用
- 说明：只做数据侧改动，未加查找表也未改任何代码路径；现有逻辑仍用数组下标（`CARDS[p.card]`、`state.cool[i]`、卡槽 i），注意 id 与下标差 1

## v0.0.70（2026-10-25）
- 修改：选目录（以及旧的"允许访问 data"授权）的时机从"进入场景"改到"启动游戏"——boot 资源加载完成后在 window 上挂一次性的 pointerdown 监听直接调 pickDir()，页面加载后的第一次点击（点在哪都行）就把句柄要到，之后进测试场景1/2 不再弹选择器
- 说明：File System Access API 要求用户手势，纯 DOMContentLoaded 自动弹会被浏览器拒绝，所以"启动时"取的是启动后第一次点击这个最早的合法时机
- 新增：pickDir() 用 dirPromise 去重——第一次点击的 pointerdown 预热与同一点击里 enterRun→loadRun 的请求共用同一个在途 Promise，只可能弹一次选择器；未授权成功时（取消/无权限）清空 dirPromise，下一次点击可重试，dataDir 拿到后长期复用

## v0.0.69（2026-10-25）
- 新增：save.js（106 行，index.html 里排在 game.js 之前）——用 File System Access API 把存档落成 data 目录下的真文件：data/save_test1.json、data/save_test2.json（JSON.stringify 缩进 2，可直接查看手改）
- 新增：目录句柄存进 IndexedDB（库 apollo7s-data / store handles / 键 data）。首次进入场景时因无句柄会弹出系统文件夹选择器，请选 E:\Apollo\7sRef\data；之后每次冷启动（刷新/重开页面）在第一次进入场景时由浏览器自己弹一次"允许访问 data"授权，点允许即可，无需再选目录
- 新增：字段白名单 SAVE_KEYS = clock/lastSpawn/lastMilk/milkInterval/milkDropped/milk/milkShown/cool/opts/plants/bullets/milks/effects/bgmAt；怪物只序列化 row/x/hp/bleed 四个字段（m.eat 指向 plant 对象，直接 stringify 会因循环引用抛错，且 eat/eatT/biteT/frozen 每帧由 update 重算）；scene/mouse/selected/net/menuOpen/confirmRestart/resumeAsk/loading 等临时字段一律不入库
- 修改：makeRun(key) 给每个插槽带上 slot 标识；loop 的冻结条件与 testClick 增加 loading 标志——enterRun 先 state.loading=true 冻住画面，await loadRun(key) 完成后再决定：读到的记录非空则弹"继续/重新开始"框，否则直接放 bgm 开玩（读档期间不会推进时钟、也不会出怪掉奶，也不会误显提示框）
- 修改：按你选的"只在离开时写"，写盘时机只有四处：菜单"退出"、提示框"返回"、提示框"重新开始游戏"、确认框"确定"（后两个是 resetRun 之后立刻落盘，避免旧存档把刚重置的局面又覆盖回来）；"继续"不写，游玩途中也不写，所以直接刷新/关页面会丢最后一次离开之后的进度
- 修复：存档文件里出现未知 card 下标（改过 info.js 之后残留的老档）→ 打印"存档数据无效"并放弃读取，保留当前内存状态；文件不存在属正常（NotFound）不报警；其余读写异常只 console.warn，不会中断游戏
- 说明：两个插槽各写各的 json，互不覆盖；bgm 播放位置（bgmAt）一并入库，重开页面后回到对应场景仍从记录的秒数续播；此方案只在 Chrome/Edge 有效，Firefox/Safari 没有 showDirectoryPicker 时会静默不存档

## v0.0.68（2026-10-25）
- 新增：每个插槽各自记录 bgm 播放位置——state 增加 `bgmAt`（秒，makeRun 初始 0）；updateGame 每帧同步 `state.bgmAt = bgm.currentTime`，enterRun 切插槽时先把旧位置写回离开的插槽、再把 `bgm.currentTime` 定位到进来插槽的 `bgmAt`（没记录过则从 0 开始），所以两关共用一个 Audio 但各续各的音乐
- 修改：resetRun 在把 bgm 归零的同时把该插槽的 `bgmAt` 也归零
- 说明：暂停（菜单面板 bgm.pause、确认框未开播、弹提示框期间）不推进 `bgmAt`，值本就等于当前 currentTime，续播自然接上；快速模式只改游戏倍速，音乐位置仍按真实播放记录

## v0.0.67（2026-10-25）
- 新增：主菜单第三个按钮"测试场景2"（在原"测试场景"下方，按钮间距沿用 110 步进；面板高度 420 → 530 以容纳三键，底部留白仍 126），原按钮改名"测试场景1"
- 新增：两套互不相通的游玩存储——`makeRun()` 工厂 + `const SLOTS = { test1: makeRun(), test2: makeRun() }`，`state` 由 const 改为 `let` 并指向当前插槽；进入场景改走核心的 `enterRun(key)`（切换 state 引用 → scene='game' → 有记录弹继续/重新开始框，否则直接放 bgm）
- 修改：boot 预加载完成后为两个插槽各抽一次初始掉奶间隔（原先只给唯一 state 抽）
- 说明：场景代码完全共用 scenes/test.js，只是各写各的 state，伙伴/怪物/milk/时钟/冷却/选项/menuOpen 等都各自独立；鼠标位置在切换插槽时沿用当前指针，避免进入另一张图时跟随幽灵跳到旧坐标

## v0.0.66（2026-10-25）
- 新增：按场景拆分文件——scenes/menu.js（主菜单：menuRects / menuHover / menuClick / renderMenu，52 行）与 scenes/test.js（测试场景：milk 生产与掉落、出怪、uiRects、resetRun、hasRunRecord、伙伴绘制、render、testHover / testClick、updateGame，807 行）；game.js 只留核心（CFG / CARDS / OPTS / canvas / imgs / state / bgm / 通用绘制 roundRect·drawPanel·drawButton·drawTip / 通用命中 inRect·toLocal / 输入监听 / loop / 资源预加载启动），205 行
- 修改：输入与主循环改为按场景分发——mousemove→menuHover()|testHover()，click→menuClick(p)|testClick(p)，loop 里 `if (!(state.menuOpen || state.resumeAsk)) updateGame(raw); render();`（原先内联在 loop 中的每帧更新整体搬进 updateGame，逻辑未动）；contextmenu 与 keydown（取消选中/断网）留在核心，两场景通用
- 修改：index.html 载入顺序 info/info.js → scenes/menu.js → scenes/test.js → game.js；game.js 放最后是因为它末尾的预加载 Promise 会调用 randMilkInterval() 与 loop，必须等场景函数就位；新增场景时同样把它的 script 标签排在 game.js 之前
- 说明：纯搬运重构，代码行按原始片段逐行搬迁（仅监听器/loop 的分支骨架改写为函数调用），用逐行多重集比对确认除上述骨架外无一行增删；三个文件各自语法检查通过、顶层标识符无重复；未改动 info.js 与任何渲染/数值参数

## v0.0.65（2026-10-25）
- 修改：bgm 不再在进入场景时就响起，只有真正开始游玩才播——无记录直接进场景时立即播放；有记录弹出提示框时保持静音，点"继续"（从暂停处续播）或"重新开始游戏"（resetRun 已回到 0，故从头播放）才开始播放
- 说明：提示框期间本就未开始播放，因此"返回"主菜单不再需要 bgm.pause()

## v0.0.64（2026-10-25）
- 新增：从主菜单点"测试场景"进入场景之后检测游玩记录（hasRunRecord()：游戏时钟已走动，或场上存在伙伴/怪物/milk/特效）；有记录则弹出提示框"你想继续这个游戏，还是重新开始一个新的游戏？"
- 新增：提示框 1040×260 居中，三键横向居中、各 260×64、间距 30，从左到右为"返回""重新开始游戏""继续"——分别执行与菜单中相同的功能：返回主菜单（scene 切回 menu + bgm 暂停，不重置）、resetRun() 重新开始、关闭提示框继续游戏
- 修改：提示框打开期间游戏时钟暂停（与选项面板共用循环早退）、吞掉其它点击（只响应三键），此时悬停仅三键为 pointer；bgm 不因暂停而停播

## v0.0.63（2026-10-25）
- 新增：选项设置面板底行中间的"重新开始"按钮（退出 | 重新开始 | 继续游戏，各 280×64、间距 40、整行以屏幕横向居中）；面板宽度随之 640 → 960 以容纳三键（选项行同步变宽，勾选项仍居中于面板）
- 新增：点击"重新开始"弹出确认框（640×260 居中，样式同提示框）——文案"你确定要重新开始这个游戏吗？"，下方并排"确定""返回"两个 240×64 按钮
- 新增：resetRun()——点"确定"后清空场上伙伴/怪物/子弹/milk/特效，milk 与显示值回到初始 50，冷却回到开局态（slow/very slow 仍初始进入冷却），游戏时钟与掉落计时归零并重新抽取下次掉奶间隔，同时取消选中的卡片与断网态，并把 bgm 从头开始播放
- 新增：点"确定"重置后自动关闭选项设置面板回到游戏界面（等同"继续游戏"，未暂停）
- 修改：确认框打开期间吞掉其它点击（只响应确定/返回），且此时悬停仅两个按钮为 pointer
- 说明：点"返回"仅关闭确认框，不做任何重置

## v0.0.62（2026-10-25）
- 新增：测试场景的选项设置面板底部"退出"按钮，位于"继续游戏"左侧——点击返回主菜单（scene 切回 menu、选项面板关闭、bgm 暂停）
- 修改：为并排放下两个按钮，继续游戏由 320 宽改为 280 并右移，退出同样 280 宽置于左侧（两按钮间距 24，左右各留 28 内边距，底边距面板 32）
- 说明：返回主菜单不重置对局状态，再次点"测试场景"会接着这一局继续（bgm 也从暂停处续播）；悬停退出同样给出 pointer

## v0.0.61（2026-10-25）
- 新增：主菜单场景——游戏启动即停在 main menu（state.scene = 'menu' | 'game'），画面为草坪背景 + 居中面板（640×420）+ 面板顶部"主菜单"标题 + 两个居中按钮：开始游戏、测试场景（320×64，纵向排列）
- 新增：点击"开始游戏"弹出提示框（640×260 居中），内容为"该内容还未开发"，下方一个"返回"按钮，点击返回主菜单
- 新增：点击"测试场景"进入先前所做的场景（state.scene = 'game'），游戏状态从该刻起开始推进
- 修改：菜单场景下 loop 只渲染菜单、不推进任何游戏逻辑（时钟/出怪/掉奶/动画均冻结）；菜单场景的鼠标悬停只对三个按钮给出 pointer
- 修改：bgm 不再在资源加载完成时自动播放，改为点击"测试场景"进入游戏时开始（与"游玩时循环播放"一致），因此首次播放由该次点击这一用户手势触发
- 新增：menuRects() 与 drawPanel() 辅助函数（面板样式沿用选项面板的 rgba(70,50,25,0.95) + 白描边）

## v0.0.60（2026-10-25）
- 删除：选取卡片后在断网框右侧绘制伙伴名的逻辑（右侧不再显示任何名称）
- 新增：鼠标停留在某个卡槽时，在该卡槽正下方（间隔 8px）绘制文本框提示——第一行为 name；若该卡正在冷却则第二行为"重新装填中...%d s"（%d 为剩余冷却秒数向上取整）
- 新增：鼠标停留在断网框上同样显示文本框，内容为"断网"（无冷却行）；停留在 milk 框上不显示
- 新增：drawTip(cx, top, lines) 按 measureText 自适应宽度，样式常量集中在 CFG.tip（字号 26、行高 34、内边距 16/8、圆角 10、底色 rgba(0,0,0,0.78)、白描边）
- 说明：冷却中但开启"无冷却无花费"时不显示第二行（此时并无冷却）；菜单打开时不显示提示框；提示框以槽中心对齐，最左卡槽的框体不会超出画面左缘

## v0.0.59（2026-10-25）
- 修改：自然掉落 milk 的时间间隔改为 `min(已掉落数量 × 100 + 4250, 9500) + rand(0~2750)`（单位 ms），即随掉落次数增多基础间隔每次 +100ms，封顶 9500ms，再叠加 0~2750ms 的随机量
- 新增：state.milkDropped 记录自然掉落累计次数（每次 spawnMilk +1，咪璐库产出的 milk 不计入）
- 修改：CFG.milk 的 dropMin/dropMax 由该公式取代——dropBase 4250、dropStep 100、dropCap 9500、dropRand 2750
- 数值：第 1 个为 [4250, 7000)ms，第 11 个为 [5250, 8000)ms，第 53 个起恒为 [9500, 12250)ms；间隔在游戏时钟上计算，快速模式下实际耗时减半

## v0.0.58（2026-10-25）
- 修改：断网态下鼠标停留格子的底色由绿改为黄（rgba(255,225,74,0.30)，与选中黄框同色系）；仍只在有可消失伙伴时显示，没有可消失伙伴时不显示任何底色

## v0.0.57（2026-10-25）
- 新增：断网选中时与选取卡片一致——net_err 图以 0.6 透明度跟随鼠标指针（尺寸同卡槽 160×160，中心对齐指针）
- 新增：断网态下鼠标停留的格子在该处有可消失伙伴时染绿（rgba(80,255,120,0.30)，与放置预览同色）；不做红色提示，即没有可消失伙伴时不显示任何底色
- 修改：绿色判定与点击移除用同一套命中规则（plantAtPoint 的贴图包围盒），保证"显示绿色 ⇔ 点击必移除"
- 修改：断网态的点击处理提前到收集 milk 之前——此时任何点击只会是"移除伙伴"或"取消状态"两种结果，不再顺带收集 milk；断网态下点击断网框本身也走取消逻辑，效果与原来一致
- 修复：选取卡片后显示的伙伴名原来画在卡槽右侧（第 6 预留槽右边缘 +40），会被新加的断网框压住——改为画在断网框右侧（+40）

## v0.0.56（2026-10-25）
- 修改：断网框改为 1:1 卡槽（160×160，与左侧 milk 框同尺寸、同顶对齐）且只显示图片——去掉底部"断网"文字，图片铺满整个卡槽；淡灰描边与选中黄框保留
- 修改：断网态下点击空气（未命中任何伙伴）即取消该状态；命中伙伴同样在一次点击后退出，因此每次选取只用一次

## v0.0.55（2026-10-25）
- 新增：卡槽框右侧新增"断网"工具框（images/others/net_err.png，CFG.netSlot = 1066,24,107×160）——与卡槽同款面板底、同样的 1:1 图标居上（偏移 8）+ 底部小字显示名"断网"，并带同样的淡灰描边
- 新增：用法——点击该框进入使用状态（黄色高亮，与卡片选中同款），再点击场上任意已放置的伙伴即立刻使其消失；成功移除一次后自动退出该状态
- 说明：断网移除走的是直接从 state.plants 摘除的路径，不触发生命到期的结算，因此 touchhold 被断网移除时不生成 cp 特效、也不造成 1800 伤害；对已存在的特效无影响（工具只检索伙伴列表）
- 新增：取消方式——再次点击断网框、右键、Esc、或改选任一卡片（互斥：选卡清除断网态，选断网清除选卡态）；断网态下点击空白处不取消，可连续移除
- 修改：悬停断网框时指针变为 pointer；资源加载新增 imgs.net_err
- 说明：伙伴命中判定用贴图包围盒（plantSize 得出的绘制尺寸，中心与场上绘制一致），从后往前遍历故视觉上层伙伴优先

## v0.0.54（2026-10-25）
- 修改：冷却中的卡槽同样整体蒙灰——蒙灰条件由"仅实际 milk 不足"改为"实际 milk 不足 或 冷却中"（任一成立即铺 CFG.cardFace.gray）
- 说明：冷却进度仍由原有的黑色遮罩自上而下滑动表示，它叠在灰色之上，因此冷却中的卡是"整卡灰 + 底部黑色进度"两层，冷却结束后只剩黑色遮罩退去后的正常卡面

## v0.0.53（2026-10-25）
- 新增：实际 milk 不足时，对应卡槽整体蒙灰（CFG.cardFace.gray = rgba(120,120,120,0.55)，覆盖整个卡槽矩形）——判定用 state.milk（实际值，非显示值），与可选中条件一致；开启"无冷却无花费"后不再蒙灰
- 说明：绘制顺序为 卡面 → cost → 蒙灰 → 冷却遮罩 → 灰色描边 → 选中黄框；因此蒙灰会一并压住红色的 cost 字（此时整卡已表明不可用），冷却遮罩叠在蒙灰之上，卡槽淡灰描边始终可见

## v0.0.52（2026-10-25）
- 新增：单个卡槽外圈淡灰色描边（rgba(235,235,235,0.7)、线宽 2、圆角 10，画在冷却遮罩之后因此遮罩期间仍可见）
- 修改：卡槽之间的间距 16 → 24（CFG.cardGap）
- 新增：整体卡槽框预留 6 个卡槽位（CFG.cardSlots）——面板宽度按第 6 槽右边缘计算；当前 4 张卡，右侧两个为空槽位，只占面板位置，不绘制卡面/cost/边框等任何信息
- 说明：空槽位不可点击（slotAt 仍只遍历实际存在的卡片），milk 框与卡槽面板的 16px 间隔不变

## v0.0.51（2026-10-25）
- 修改：单个卡槽尺寸——高度保持 160，宽度 160 → 107（约 3:2）；卡槽间距与 milk 框不变，卡槽面板宽度随卡片数量自动收缩
- 新增：卡槽底部用小字标注 costmilk（默认白色 #fff、字号 CFG.cardFace.costFont=30，基线居中于槽底上方 costPad=22 处）
- 新增：实际 milk 不足时该 cost 字体变红（CFG.cardFace.costLow = #ff4a4a）；开启"无冷却无花费"时不变红，与可选中判定保持一致
- 修改：卡面改为 1:1 正方形绘制在卡槽上部——边长取槽宽 107，自槽顶向下偏移 CFG.cardFace.offset=8（占据 8~115），下方留出 cost 文字带；冷却遮罩仍覆盖整个卡槽（含卡面与 cost）

## v0.0.50（2026-10-25）
- 修改：冷却改为统一档位描述——info.js 新增 INFO.cdTiers = { fast: 7.5, slow: 30, 'very slow': 50 }，各卡片原数值字段 cooldown 一律替换为档位字段 cd
- 修改：现有卡片归档——迪拉熊 fast、咪璐库 fast、touchhold very slow、らん slow（数值与原先一致）
- 新增：游戏起始时 slow 与 very slow 档的卡片直接进入冷却（初始 cool 即为该档秒数，fast 仍为 0），因此开局这两张卡为满遮罩、随时间正常滑动
- 修改：放置后写入冷却与卡面冷却遮罩的分母均改用 INFO.cdTiers[cd] 取值

## v0.0.49（2026-10-25）
- 新增：第四张卡片 らん（key: ran）——hp 4000、cooldown 30s、costmilk 50、卡面 images/cards/card_らん.png、伙伴 images/partners/ptn_らん.png、scale 1.00；无 bullet/produce 字段，即无攻击与生产能力
- 新增：特性字段 flip——为 true 时伙伴贴图水平镜像绘制（原图朝左，镜像后朝右）；场上实体与放置跟随预览同样生效，卡面图不镜像
- 修改：drawPartner 增加 flip 参数，镜像用 translate + scale(-1,1) 实现，不改动源图文件
- 说明：卡槽为 CARDS.length 循环绘制，第四格自动排在 x=784；冷却数组本就按 CARDS 长度生成，无需改动

## v0.0.48（2026-10-25）
- 新增：touchhold 放置特效——放置后 1s 内以扇形扫描方式逐渐显示 images/others/touchhold_border.png；0 时刻为图像中心正上方，顺时针为正方向，t 时刻显示 360°×(t/1s) 的扇形（0.25s 时恰为右上 90° 扇区），满 1s 后不再绘制
- 新增：特性字段 place = { img, dur, scale }；扫描用 canvas 裁剪实现（以伙伴中心为圆心的扇形 clip 后贴图），裁剪半径取贴图对角线一半以保证四角可见
- 说明：图层位于伙伴下方（在伙伴绘制之前画），中心与伙伴中心重合；尺寸沿用宽度适配规则（w = 格宽 × place.scale，默认 1.00 → 200×199），place.scale 可调
- 修改：伙伴实体新增 placeT 计时（放置起按 dt 累加，仅带 place 字段的卡片推进）；资源加载新增 plc_<key> 批量加载

## v0.0.47（2026-10-25）
- 修改：burst 命中判定由"按怪物所在格子取整"改为"怪物贴图与攻击区域矩形相交"——攻击区域仍是以自身格子为中心的 3×3 格范围（radius 1 → 600×558px），怪物贴图取其绘制用的半径 52px 方形包围盒（与红框预览同一套尺寸），中心为 (m.x, 所在行格中心 y)
- 说明：因此跨在格线上的怪物只要贴图压到区域边缘即被命中；横向命中区间为区域左右各外扩 52px（radius 1 时约为中心 ±352px），行方向仍只覆盖上下各一行
- 说明：判定用的是怪物当前位置，不含啃食时的挤压形变与 8px 后移（形变量级远小于 52px 包围盒）

## v0.0.46（2026-10-25）
- 新增：touchhold 消失时对以自身格子为中心的 3×3 范围（同行及上下各一行、同列及左右各一列）内的怪物造成 1800 伤害（怪物 hp 为 270，即秒杀）；伤害与消失特效同时触发
- 新增：特性字段 burst = { damage, radius }——radius 为格数，1 即 3×3；怪物所在列按其 x 换算（与啃食判定同一套取整规则），仅带该字段的卡片在消失时结算
- 说明：范围判定用格子而非像素，因此不受怪物贴图宽度影响；第 10 列（出怪列）的怪物若落在范围内同样受伤

## v0.0.45（2026-10-25）
- 修改：touchhold 消失特效改为三段式时间轴——出现时 0.5s 内大小由 1.5 倍格宽线性放大到 2.0 倍（grow），随后保持 0.5s（hold），最后 0.2s 透明度由 1 渐变到 0 消失（fade，尺寸保持 2.0 不变），总时长 1.2s 后移除
- 修改：info.js 中 effect 字段由 { dur, scale } 改为 { grow, hold, fade, scaleFrom, scaleTo }，三段时间与首末大小均可调
- 修改：特效实体不再记录 dur/scale，改为逐帧按 t 计算当前缩放与透明度（渲染时设置 globalAlpha，绘制后复位为 1）

## v0.0.44（2026-10-25）
- 修改：touchhold 消失特效放大——effect.scale 1.00 → 2.00，特效宽度约为 2 格（400px，高按原图比例约 147px），仍以所在格子为中心居中显示

## v0.0.43（2026-10-25）
- 修改：伙伴消失特效改为在所在格子内居中显示（原先底部对齐脚底）；特效数据由 feetY 改为记录格子中心 y，绘制时按中心对齐

## v0.0.42（2026-10-25）
- 新增：第三张卡片 touchhold——hp 300、costmilk 150、cooldown 50s、卡面 images/cards/card_touchhold.png、伙伴 images/partners/ptn_touchhold.png、scale 1.00
- 新增：特性字段 immune——怪物仍会停在该伙伴所在格啃食，但啃食不扣血（immunity 只免伤，不改变怪物停留行为）
- 新增：特性字段 life——放置后倒计时（touchhold 为 1s），归零时伙伴从场上移除
- 新增：特性字段 effect——伙伴消失瞬间在原地留下特效 images/others/cp.png，持续 0.5s 后自动移除；特效按宽度适配格子（effectSize：w = 格宽 × effect.scale，等比算高），底部对齐脚底位置
- 修改：state 新增 effects 列表；冷却数组 cool 由固定 [0, 0] 改为 CARDS.map(() => 0)，以支持第三张卡片
- 修改：资源加载新增按 effect 字段批量加载特效图（键名 eff_ + 卡片 key）

## v0.0.41（2026-10-25）
- 新增：勾选"自动收集"的瞬间，对场上所有尚未被收集的 milk（自然掉落的与咪璐库产出的，含下落中/抛物线中/已落地）执行一次收集——实际 milk 立即各 +25，飞行动画在关闭菜单恢复运行后播放
- 修改：选项行的点击处理改为逐项判断，仅在 autoCollect 由关变开时触发上述一次性收集（关闭该选项不触发）

## v0.0.40（2026-10-25）
- 新增：游玩 BGM——info.js 新增 INFO.bgm = sounds/lawnbgm(1).mp3，资源加载完成后开始循环播放（bgm.loop = true）
- 新增：菜单打开时 bgm.pause()、关闭（继续游戏/再点菜单）时从原位置继续播放；菜单开关统一走 setMenu()
- 新增：浏览器自动播放策略兜底——若加载后播放被拦截，则在菜单未打开时的首次点击重试播放
- 说明：快速模式只缩放 dt 与游戏时钟，不触碰 playbackRate，因此音乐速度不变

## v0.0.39（2026-10-25）
- 修改：milk 点击判定范围加大——在精灵矩形基础上四周各外扩 CFG.milk.hitPad（40px），判定区约 148×200；悬停指针光标同步使用该范围
- 修改：怪物移动速度 CFG.monsterSpeed 44 → 30

## v0.0.38（2026-10-25）
- 修改：自然出怪间隔 CFG.monsterInterval 5000 → 19000（19s，游戏时钟；快速模式下为真实 9.5s）

## v0.0.37（2026-10-25）
- 修复：v0.0.36 引入的游戏时钟单位错误——state.clock 按秒累积却与毫秒阈值（monsterInterval 5000、milkInterval 8000-12000）比较，导致自然出怪与自然掉落 milk 实际不再触发；改为 state.clock 以毫秒累积（dt × 1000），其余按秒推进的逻辑不变

## v0.0.36（2026-10-25）
- 新增：选项设置最上方新增可勾选项"快速模式"（默认关闭），开启后游戏速度为 2 倍速
- 修改：帧时长改为 dt = 实际帧时长 × 倍速，作用于全部按 dt 推进的逻辑（怪物移动/啃食、子弹、冷却、milk 下落/抛物线/飞行/寿命、产奶计时、金光渐变）
- 修改：新增游戏时钟 state.clock（按倍速累积），自然出怪与自然掉落 milk 的计时改用该时钟，因此 2 倍速下出怪/掉奶频率同样翻倍；菜单暂停时时钟停止，原先"暂停期间刷新计时"的写法随之移除
- 修改：选项面板高度 520 → 620 以容纳第四行选项，"继续游戏"按钮仍位于面板底部

## v0.0.35（2026-10-25）
- 新增：咪璐库产奶预兆金光——产奶前 1s 起在伙伴身后渲染金色径向光晕，透明度随剩余时间由 0 渐变至 0.8，产奶瞬间（计时重置）立刻消失
- 新增：CFG.glow 参数（time 1s、radius 0.8×精灵长边、alpha 0.8、color 255,225,120）；仅对带 produce 属性的伙伴生效

## v0.0.34（2026-10-25）
- 新增：咪璐库产奶机制——info.js 中 milk 卡新增 produce 参数（首次 3-12.5s，之后每 23.5-25s），放置时按首次区间随机计时，之后每次产奶重新随机
- 新增：咪璐库产出的 milk 自其头顶以抛物线抛出（0.9s、拱高 150px、落点为脚底附近横向 ±70px 随机且不越出可放置区），落地后不再移动
- 新增：产出的 milk 与自然掉落 milk 共用同一收集流程（点击 +25 实际值、飞向 milk 槽、到达后显示值 +25、生成 20s 未拾取则渐变消失），并同样受"自动收集"选项作用（生成瞬间即被收集）
- 新增：无 produce 属性的伙伴不进入产奶计时

## v0.0.33（2026-10-25）
- 新增：选项设置新增可勾选项"自动收集"（默认关闭）——开启后自然掉落的 milk 在生成瞬间即被收集（走同一条收集流程：实际 milk 立即 +25、飞向 milk 槽、到达后显示值 +25）
- 修改：收集动作抽出为 collectMilk()，点击拾取与自动收集共用
- 修改：选项面板高度 400 → 520 以容纳第三行选项，"继续游戏"按钮仍位于面板底部；悬停指针判定改为遍历全部选项行

## v0.0.32（2026-10-25）
- 修改：显示 milk 与实际 milk 分离（state.milkShown / state.milk）——实际值在点击掉落 milk 的瞬间即 +25，显示值仍在 milk 飞到槽位时才 +25；卡片可选中性与花费判定均使用实际值
- 新增：若有 milk 正在飞行时花费了 milk，显示值立刻同步为花费后的实际值，且这些飞行中的 milk 到达后不再改变显示值（直到下一次收集）

## v0.0.31（2026-10-25）
- 新增：milk 收集动画——点击掉落的 milk 后不再立即入账，而是以 1400px/s 直线飞向 milk 槽，到达时计入 25（受 9999 上限约束），停留 0.2s 后消失
- 修改：飞行中的 milk 不可再次点击、不再下落、不参与 20s 自然消失计时，绘制时保持不透明

## v0.0.30（2026-10-25）
- 修改：选项"无冷却"改名为"无冷却无花费"，启用后放置伙伴不再消耗 milk（同时仍忽略冷却与 milk 不足限制）

## v0.0.29（2026-10-25）
- 修改：milk 总量显示框与卡槽分离——各自独立圆角底板，卡槽整体右移（cardSlot.x 224 → 256），两框之间留 16px 间隔

## v0.0.28（2026-10-25）
- 新增：milk（阳光）系统——INFO.milk 记录图片 images/others/milk.png、单个面值 25、开局 50、上限 9999
- 新增：伙伴属性 costmilk（迪拉熊 100、咪璐库 50，写入 info.js）；milk 不足时该卡片不可选中，放置成功时扣除对应 costmilk
- 新增：卡槽最左侧的 milk 计数面板（仿 PvZ：奶瓶图标 + 当前数量），与卡片栏共用同一底板；卡槽整体右移（cardSlot.x 48 → 224，新增 CFG.milkSlot）
- 新增：自然掉落 milk——每 8-12s（每次随机）自第一行最上方的随机横向位置生成，以 80px/s 缓慢垂直下落；目标行随机取第 3-5 行，瓶底触及目标行底部时停止下落
- 新增：点击 milk 拾取，+25 且不超过上限 9999；悬停 milk 显示指针光标
- 新增：milk 自生成起 20s 未被拾取则消失，最后 1.2s 渐变淡出
- 修改：菜单暂停期间同步刷新 milk 掉落计时，避免恢复瞬间连续掉落

## v0.0.27（2026-10-25）
- 修改：场景方格线颜色略微加深（白色 0.15 透明度改为黑色 0.20 透明度）
- 新增：选项设置面板最底部的"继续游戏"按钮，点击后关闭菜单恢复游戏；按钮文字随高度自适应，悬停显示指针光标

## v0.0.26（2026-10-25）
- 修改：milk.png 右边界改为留余量的逐行边界表 + 肤色像素清除，修复此前奶瓶右轮廓被裁/断口的问题；手臂描边与瓶轮廓交界处保留极小节点（清除会伤及轮廓）

## v0.0.25（2026-10-25）
- 修改：重新截取 milk.png——自 ptn_milk.png 原图重截（逐行右边界遮罩+包围盒裁切），覆盖此前背景被填实的版本，恢复透明背景与完整奶瓶（211×373）

## v0.0.24（2026-10-25）
- 修改：milk.png 改为先截取较大范围（含手臂/身体），再按逐行右边界遮罩——奶瓶轮廓右侧的手臂与身体像素置为透明，保证奶瓶完整；最终 211×373 裁至包围盒

## v0.0.23（2026-10-25）
- 新增：images/others/milk.png——自 ptn_milk.png 截取咪璐库手持的牛奶瓶（192×372，透明背景，不含手臂残边）

## v0.0.22（2026-10-25）
- 新增：最右上角 菜单 按钮；按下后暂停游戏并打开居中"选项设置"界面，关闭自然出怪 / 无冷却 两选项移入其中；再次点击 菜单 关闭界面并恢复游戏
- 修改：出怪 按钮移至 菜单 按钮左侧；原主界面右上角的两个选项复选框移除
- 修改：菜单打开时跳过全部游戏更新（怪物移动/啃食/子弹/冷却/自然出怪计时）；暂停期间自然出怪计时随帧刷新，避免恢复瞬间补出怪

## v0.0.21（2026-10-25）
- 修改：伙伴相关参数移入 info/info.js——各卡片 info 新增 cardImg、ptnImg、scale；game.js 的 CARDS 由 INFO.cards 生成，图片加载与绘制缩放直接读取 info
- 修改：伙伴放置改为脚底对齐——sprite 最低处位于该格底线上方 CFG.footMargin（12px），不再严格垂直居中；跟随预览仍居中于鼠标

## v0.0.20（2026-10-25）
- 修改：card_milk.png 截取范围改为仅头部附近（耳+发+脸+下颌，620×620 正方形）
- 修改：伙伴绘制尺寸改为按卡 scale——迪拉熊 0.92（原 CFG.plantScale）、咪璐库 1.15；放置实例与跟随预览均按各自 scale 绘制，咪璐库允许超出格子范围

## v0.0.19（2026-10-25）
- 修改：ptn_milk.png 锐化（UnsharpMask radius2 / 140% / threshold2）并加深描边（亮度低于 150 的暗部按坡度压向黑），透明通道保持不变

## v0.0.18（2026-10-25）
- 修改：ptn_milk.png 人物外与边缘连通的白色背景改为透明（转 RGBA，仅移除连通背景，保留人物内部白色）
- 修改：重新截取 card_milk.png（自新 ptn_milk.png 的头+双臂+奶瓶+躯干至髋部半身像，1040×1040 正方形）

## v0.0.17（2026-10-25）
- 新增：咪璐库加入卡槽（第二卡槽，位于迪拉熊右侧），可选中、跟随鼠标、放置 ptn_milk，冷却独立计时
- 新增：咪璐库无攻击手段——info 无 bullet 配置的伙伴不进入发射逻辑
- 修改：选中与冷却改为按卡槽独立（state.selected 存卡槽下标、state.cool 为数组）；子弹生成时携带自身速度与伤害；卡面板加宽容纳两卡槽，选中名称移至面板右侧

## v0.0.16（2026-10-25）
- 新增：咪璐库（milk）卡片 info——名称 咪璐库、hp300、冷却 7.5s，存于 info/info.js 的 INFO.cards.milk
- 新增：images/cards/card_milk.png——自 images/partners/ptn_milk.png 截取的人物半身像（365×365 正方形）

## v0.0.15（2026-10-25）
- 修改：迪拉熊索敌逻辑——不索敌自己身后的怪物，攻击范围为本行视野内且 x ≥ 伙伴中心的怪物

## v0.0.14（2026-10-25）
- 修改：怪物进入死亡状态（血量严格低于临界值）时维持原移动状态——啃食中被阻挡的怪物锁定不再前进，行走中的怪物继续行走

## v0.0.13（2026-10-25）
- 修改：怪物血量严格低于临界值时视为死亡状态——不再攻击（停止啃食），但仍可被索敌与击中；移动与掉血规则不变

## v0.0.12（2026-10-25）
- 修改：怪物伤害改为每 0.04s 造成 4 点（int），数值写入 info/info.js 的 INFO.monster
- 修改：伙伴血量为 0 时直接消失，移除 break.png 销毁动画
- 新增：右上角"出怪"按钮，点击一次在随机行出怪一次
- 新增：右上角可勾选选项（默认 off）：关闭自然出怪、无冷却，并实现两功能
- 调整：咀嚼动画改用独立 0.6s 视觉周期（伤害周期已缩短为 0.04s）

## v0.0.11（2026-10-25）
- 回滚：01_FIRST_PLAYABLE.md 中未受要求的改动（第 5 条规格文字改写、自加第 8 条、待确认章节删改），仅保留完成状态标记（第 5 条部分完成、第 7 条已完成 v0.0.9）

## v0.0.10（2026-10-25）
- 文档：更新 01_FIRST_PLAYABLE.md 完成标记——第 7 项冷却标记已完成（v0.0.9），第 5 项标记部分完成并列出已实现/未实现明细，新增第 8 项啃食与销毁（已完成 v0.0.7/v0.0.8），怪物死亡条件移出待确认

## v0.0.9（2026-10-25）
- 新增：卡片冷却系统——放置后进入 7.5s 冷却（取 info 的 cooldown），冷却中不可选中；冷却表现为半透明黑色遮罩自上而下滑动

## v0.0.8（2026-10-25）
- 新增：伙伴销毁动画——伙伴生命 ≤0 消失时在原位显示 break.png，持续 0.7s（CFG.breakTime）后消失

## v0.0.7（2026-10-25）
- 新增：怪物啃食机制——怪物与伙伴同格时停止移动并播放咀嚼动画（挤压+左探），每 1.5s 对该格伙伴造成 50 伤害（int）
- 新增：伙伴血量取 info 的 hp300（int），生命 ≤0 直接消失，啃食它的怪物恢复移动
- 未实现（按要求）：伙伴受击动画

## v0.0.6（2026-10-25）
- 修改：发射逻辑——攻击计时永久运行（到点重新随机间隔），仅当计时到点且本行视野内有怪物时才发射

## v0.0.5（2026-10-25）
- 修改：迪拉熊索敌逻辑——仅本行视野内（怪物 x ≤ 9.3 列右缘）有怪物时才攻击；无目标时攻击计时归零，怪物进入视野即刻首射

## v0.0.4（2026-10-25）
- 修改：子弹命中改为直线飞行判定——同行内子弹与僵尸 x 坐标差 ≤ 40（CFG.hitDist）即命中

## v0.0.3（2026-10-25）
- 移动：info.js 移至 info/info.js，index.html 引用同步更新

## v0.0.2（2026-10-25）
- 新增：info.js 存储卡片/子弹 info（迪拉熊：hp300、攻速随机 1.35-1.45s 每次发射重新随机、初始子弹 tap、子弹速度 5 格/秒、冷却 7.5s；tap：伤害 20、图片 images/others/tap.png）
- 新增：选中卡片时显示名称"迪拉熊"
- 新增：伙伴按攻速向右发射 tap 子弹，子弹速度 5 格/秒（固定），出膛位置为伙伴中心右侧 40px
- 新增：子弹命中同行怪物造成 20 伤害（int），命中或出屏后移除
- 新增：怪物血量 270（int）、临界值 90，血量严格低于临界值时以 30/秒 掉血（按整数扣减），生命 ≤0 直接消失
- 未实现（预留/待指令）：冷却拦截与遮罩（本次仅存储数值）、怪物攻击力、受击动画

## v0.0.1（2026-10-25）
- 新增：测试场景 index.html + game.js（HTML5 Canvas，逻辑分辨率 2048×1152，16:9）
- 新增：网格 5 行 × 10 列，前 9 列可放置，屏幕看到约第 9.3 列；第 10 列为代码层出怪列，无视觉标识
- 新增：卡片点击选中（发光边框）、半透明伙伴跟随鼠标、悬停格子绿/红高亮、点击可放置格子放置 ptn_dxbear；右键/Esc/再点卡片取消选中
- 新增：怪物占位圆怪每 5 秒自第 10 列屏幕外出生并向左移动
- 新增：选中卡片时鼠标悬停怪物显示红框预览
- 移除：回滚误提前实现的攻击反馈、阳光系统、卡片冷却（规格保留于 01_FIRST_PLAYABLE.md）
- 新增：约束文件 00_MASTER_PROMPT.md、01_FIRST_PLAYABLE.md、update.md
