# 浏览器自动化性能复用约定

这份文档记录当前仓库里已经验证过、后面可以继续复用的浏览器自动化“节能”模式。

## 1. 大脚本只安装一次，后续走轻量调用

适用场景：
- 登录自动填充
- 页面 helper
- 调试快照
- 页面内状态读取

推荐做法：
- 主进程第一次进入目标页面时，通过 `executeJavaScript` 安装一个页面内 helper。
- helper 挂到稳定的 `window.__xxx__` 键上。
- 后续只发送很短的小脚本，例如：
  - `window.__xxx__.run()`
  - `window.__xxx__.getSnapshot()`
  - `window.__xxx__.setMode(...)`
- 页面重新加载、URL 变化、渲染进程重启时，清掉本地缓存并允许重新安装。

当前落点：
- 登录 helper
  - `src/windows/shopWindowLoginAutofill.js`
  - `src/windows/shopWindowBrowserController.js`

## 2. 同一轮页面事件保留更早的任务，不要反复重排

适用场景：
- `did-navigate`
- `did-navigate-in-page`
- `dom-ready`
- `did-finish-load`

推荐做法：
- 同一个 `view + url` 已经有待执行任务时：
  - 如果新任务不会比旧任务更早，不要清掉旧定时器。
  - 只有新任务明显更早时，才重排一次。
- 不要无条件 `clearTimeout -> setTimeout`。

收益：
- 少一次到多次无意义定时器重排。
- 降低一次页面加载阶段里重复进入自动化入口的频率。

当前落点：
- `src/windows/shopWindowBrowserController.js`
  - `queueLoginAutofillInjection`
  - `queueSellerSessionStatusCheck`

## 3. 会话探测优先走主进程 session.fetch

适用场景：
- 登录态检测
- seller / agentseller 用户信息探测
- 依赖同 partition Cookie 的接口探测

推荐做法：
- 优先用 `session.fromPartition(partition).fetch(...)`
- 复用当前 partition 的 Cookie / 会话环境
- 不必把 `window.fetch(...)` 注入到页面里执行

收益：
- 少一次页面注入和脚本解析。
- 更容易做超时控制、重试、日志压缩。
- 页面 DOM 或 CSP 变化时更稳。

当前落点：
- `src/windows/shopWindowBrowserController.js`
  - `probeSellerSessionForView`
  - `executeSellerAuthSessionFetch`

## 4. 高频结果日志只记摘要，并做节流

适用场景：
- 自动填充执行结果
- 会话探测结果
- 周期性状态检查

推荐做法：
- 日志只保留摘要字段：
  - `status`
  - `attempts`
  - `httpStatus`
  - `mallCount`
  - `message`
- 同一 `url + status + kind` 在短时间内重复出现时，不重复记录。
- 详细诊断留给单独的调试快照。

收益：
- runtime log 更短、更稳定。
- 减少 JSON 序列化和磁盘写入压力。

当前落点：
- `src/windows/shopWindowBrowserController.js`
  - `shouldLogLoginAutofillResult`
  - `shouldLogSellerSessionProbeResult`
  - `buildLoginAutofillLogResult`

## 5. UI 状态提示也要去重

适用场景：
- 浏览器窗口状态条
- 自动同步提示
- 登录流程提示

推荐做法：
- 相同消息、相同持久化属性，在短时间内重复到达时：
  - 只刷新隐藏计时器
  - 不重复改 DOM
  - 不重复触发布局同步

收益：
- 少一次无意义的状态条抖动。
- 少一次浏览器宿主区域同步。

当前落点：
- `src/renderer/shopWindowView.js`
  - `showTabStatus`
  - `hideTabStatus`

## 6. 失败诊断要单独节流，不要和主流程混在一起

适用场景：
- 登录输入框定位失败
- 登录方式卡片没切过去
- 提交按钮缺失
- 验证码 / 协议阻塞

推荐做法：
- 主流程日志只记结果摘要。
- 进入异常状态后，再抓调试快照。
- 调试快照按 `status + url` 做节流，不要每次都抓。

当前落点：
- `src/windows/shopWindowBrowserController.js`
  - `collectLoginDebugSnapshot`

## 7. 不建议把自动化脚本改成 localhost 拉取

可以做，但不建议作为默认方案。

原因：
- 额外依赖本地 HTTP 服务是否存活。
- 容易被 CSP / CORS / 本地端口冲突影响。
- 出问题时链路更长，更难排查。
- 对生产环境稳定性不如“应用内置脚本 + 主进程直接安装 helper”。

推荐策略：
- 生产默认：应用内置脚本，主进程直接安装 helper。
- 仅开发调试时：可以保留一个可选的 localhost 热更模式，但不要默认启用。
