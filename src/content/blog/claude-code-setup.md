---
title: 在 Ubuntu 中安装 Claude Code CLI 与 VS Code 插件，搭建嵌入式 Linux + AI开发环境
date: 2026-09-24
category: 学习笔记
summary: 在 Ubuntu 里装好 Node 22、Claude Code CLI 和 VS Code 插件并联动，配第三方模型端点，再用 Docker 容器做交叉编译
---

> 实验环境：VMware 虚拟机 / Ubuntu 24.04.5 LTS（4 核 8G）/ Windows 宿主机
>
> 记录时间：2026-09 / Claude Code 2.1.280 / Node.js v22.23.2
>
> 场景：嵌入式开发（交叉编译固件、驱动开发、调试），在 Linux 侧引入 AI 辅助编程

## 0. 为什么这样搭

嵌入式南向开发的常态是：代码在 Windows 上的 VS Code 里写，编译在 Linux 服务器/虚拟机/容器里跑（`make`、`scons`、`hb`、`yocto` 之类）。把 **Claude Code CLI** 装在 Ubuntu 里、再给它配上 **VS Code 插件**，就得到一套"编辑器 + AI 命令行助手"的组合：

- 在 VS Code 里选中代码直接问、让 AI 生成/修改驱动代码、解释寄存器手册片段
- 编译报错时，把几百行编译日志直接甩给 Claude 分析，不用手动翻
- 交叉编译工具链跑在 Docker 容器里，宿主机只装编辑器，环境干净
- 命令行也可以随时 `claude`，适合脚本化和 SSH 远端场景

全程只需三样：**Node.js 22 → Claude Code CLI → VS Code + Claude Code 插件**。

## 1. 安装 Node.js 22（跳过 apt 和 nvm）

Claude Code 2.x 要求 **Node ≥ 22**，而 Ubuntu 24.04 软件源里的 nodejs 还是 18.x，直接 `apt install` 会得到不满足要求的版本；`nvm` 的官方安装脚本要从 github.com 克隆仓库，国内网络经常被重置。最稳的是 **npmmirror 的 Node 二进制，解压即用**：

```bash
cd /tmp

# 从 npmmirror 选一个 22.x 版本（以镜像站实际列表为准）
VER=v22.23.2

curl -LO "https://registry.npmmirror.com/-/binary/node/${VER}/node-${VER}-linux-x64.tar.xz"
tar -xf "node-${VER}-linux-x64.tar.xz"
rm -rf ~/node22 && mv "node-${VER}-linux-x64" ~/node22

# 写进 PATH（npm 也在这个包里，后续全局包装载都是用户目录，无权限问题）
echo 'export PATH="$HOME/node22/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

node -v && npm -v      # 应输出 v22.23.2 和 10.x
```

> 小知识：npmmirror 的二进制目录在 `registry.npmmirror.com/-/binary/node/`，不是 `npmmirror.com/mirrors/node/`（后者现在是个 JS 页面，grep 不到版本号，别踩）。

## 2. 安装 Claude Code CLI

官方原生安装脚本是 `curl -fsSL https://claude.ai/install.sh | bash`，但 **Anthropic 对部分地区 IP 有区域屏蔽**，该地址会 302 跳到 "app unavailable in region"，下载到的是 HTML 错误页而不是脚本。**npm 渠道不受影响**，国内用镜像装：

```bash
npm config set registry https://registry.npmmirror.com
npm install -g @anthropic-ai/claude-code
claude --version        # 2.1.280 (Claude Code)
```

几个说明：

- npm 全局包装在 `~/node22/lib/node_modules/`，卸载/升级都走 npm，不需要 sudo（这也是不用 apt 版 node 的原因之一——系统级 nodejs 的全局目录要 root 权限，容易 EACCES）
- 如果坚持用 apt 的 Node，需要 NodeSource 脚本装 22，但其域名海外访问不稳定，优先级低于上面的二进制方案

## 3. 配置模型供应商

`claude` 本体走 Anthropic 官方端点（国内直连不通），一般两种用法：

**方式 A：第三方兼容端点（国内推荐）**。GLM、Kimi、MiniMax、DeepSeek 等服务商都提供 Anthropic 兼容端点，用自己的 key：

```bash
export ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/anthropic"   # 以服务商文档为准
export ANTHROPIC_AUTH_TOKEN="你的key"
claude
```

**方式 B：官方渠道**。有代理的条件下：

```bash
export https_proxy=http://127.0.0.1:<端口>
claude        # 首次 /login 用 Claude 账号授权
```

**图形化管理**：推荐 [cc-switch](https://github.com/farion1231/cc-switch)（Tauri 小工具），把多个供应商的 Base URL + Key 存起来一键切换，本质是管理 `~/.claude/settings.json`：

```bash
# Linux 下从 GitHub Releases 下载 deb 安装（GitHub 慢就用镜像前缀，见第 7 节）
curl -fLO "https://ghfast.top/https://github.com/farion1231/cc-switch/releases/download/v3.20.4/CC-Switch-v3.20.4-Linux-x86_64.deb"
sudo apt install -y ./CC-Switch-v3.20.4-Linux-x86_64.deb
cc-switch
```

> 安全提醒：`~/.claude/settings.json` 里是明文 key，别同步进任何公开仓库；写 `.gitignore` 时把它挡掉。

## 4. 安装 VS Code

```bash
cd ~
wget -O code.deb "https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64"
sudo apt install -y ./code.deb
```

装完从应用菜单启动，先装中文语言包（扩展商店搜 "Chinese"），按自己偏好配主题字体即可。

## 5. 安装 Claude Code 插件并联动

1. VS Code 扩展商店（Ctrl+Shift+X）搜索 **Claude Code**，安装 Anthropic 官方发布的 "Claude Code for VS Code"（识别 CLI 用的是第 2 步装在 `~/node22/bin/claude` 的那个，所以 CLI 必须先装好）
2. 装好后左侧活动栏出现 Claude 图标，或命令面板（Ctrl+Shift+P）搜 "Claude Code: Open"
3. 典型用法：
   - **侧边栏对话**：直接问架构、要它写驱动骨架/寄存器配置代码，改动以 diff 形式审查后应用
   - **选中即问**：编辑器里选中一段代码提问/重构
   - **终端集成**：集成终端里直接跑 `claude`，和 CLI 完全一致
   - **项目记忆**：在项目根写 `CLAUDE.md`（板级外设地址、编译命令、目录约定），Claude 每次会话自动读取，相当于给 AI 的"项目说明"

```markdown
# 例子：嵌入式项目的 CLAUDE.md 片段
- 目标平台：RK2206（RISC-V），交叉编译
- 编译在 Docker 容器内执行：docker exec -it oh_dev bash -c "cd /home/openharmony/txsmartropopenharmony && hb build -f"
- 外设手册位置：docs/datasheet/
```

## 6. 嵌入式场景实战：宿主机编辑器 + 容器编译器

这是我最常用的分工，Docker 里是完整的交叉编译环境（gn/ninja/gcc_riscv32 等），宿主机只跑 VS Code：

```bash
# 一次性：起编译容器，源码目录映射到宿主机（源码持久化，删容器不丢代码）
mkdir -p ~/oh
docker run -it --name oh_dev -v /home/<用户名>/oh:/home/openharmony oh-docker:1.0.0

# 日常：宿主机 VS Code 直接打开映射目录编辑
# （VM 终端）把源码属主改回自己，否则 root 容器写出的文件你保存不了
sudo chown -R $USER:$USER ~/oh

# 一键编译（可在 VS Code 集成终端里直接跑）
docker exec -it oh_dev bash -c "cd /home/openharmony/txsmartropopenharmony && hb build -f"
```

**编译报错的标准处理流程**：复制报错的最后几十行（前面的冗余行对定位没用），粘给 VS Code 侧边栏的 Claude，它会指出是缺头文件、宏开关没开还是链接顺序问题；改完再跑上面那条一键编译命令闭环。

## 7. 踩坑记录（国内网络向）

1. **`claude.ai/install.sh` 下不到脚本**：区域屏蔽，返回的是 HTML 页面，直接 `| bash` 会报语法错误。改用 npm 安装。
2. **`npm install -g` 报 EACCES**：apt 版 nodejs 的全局目录要 root。用第 1 节的用户级 Node 22 二进制方案，全局包都在自己家目录，无此问题。
3. **npm 装的是 Node 18 时代老包、EBADENGINE 警告**：claude-code 要求 Node ≥ 22，别装 apt 的 nodejs，先 `node -v` 确认。
4. **GitHub Releases 下不动/连接被重置**：域名解析能过但传输被重置。用镜像前缀：`https://ghfast.top/https://github.com/<原链接>`，把原 GitHub 链接去掉 `https://` 拼在后面即可，亲测 cc-switch、Watt Toolkit 都是这么拖下来的（92MB 的包断点续传 `curl -C -` 也能跑完，最后 SHA256 与官方一致）。
5. **VM 里 DNS 被劫持**（`gitee.com` 解析到 baiduads.com、HTTPS 被插广告页）：先在 VM 里 `resolvectl dns ens33 223.5.5.5 119.29.29.29` 覆盖网卡 DNS；测通方法是 `git ls-remote`，能列出 refs 就说明 git 通道可用，不用管域名解析多畸形。
6. **Dev Containers 插件 attach 老容器报 "Missing GLIBC >= 2.28"**：2024 年后新版 VS Code Server 要求 glibc ≥ 2.28，而很多嵌入式 Docker 镜像是 Ubuntu 18.04 底子（glibc 2.27）。两个解法：VS Code 降级到 1.85.2 并禁止更新；或者干脆别 attach 容器，源码映射到宿主机后用宿主机 VS Code 编辑 + `docker exec` 编译（本文第 6 节方案，更顺）。

## 8. 验收清单

```bash
node -v                  # v22.x
claude --version         # 2.1.280
code --version           # VS Code 版本号（终端可直接拉起）
```

VS Code 里点开 Claude 侧边栏，随便问一句"这个工程是干什么的"，能结合 `CLAUDE.md` 和仓库内容回答，即全套打通。

## 小结

<table style="width:100%;border-collapse:collapse;margin:1.8em 0;font-family:var(--font-mono);font-size:12.5px;line-height:1.8;">
  <thead>
    <tr>
      <th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);color:var(--ink);font-weight:700;">组件</th>
      <th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);color:var(--ink);font-weight:700;">安装方式</th>
      <th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);color:var(--ink);font-weight:700;">国内网络注意点</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--text);white-space:nowrap;">Node.js 22</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--muted);">npmmirror 二进制解压</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--muted);">别用 apt 的 18.x、别用 nvm（git 易被重置）</td>
    </tr>
    <tr>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--text);white-space:nowrap;">Claude Code CLI</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--muted);">npm + npmmirror 源</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--muted);">官方 install.sh 有区域屏蔽，走 npm</td>
    </tr>
    <tr>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--text);white-space:nowrap;">供应商</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--muted);">环境变量或 cc-switch</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--muted);">key 明文存放，别进公开仓库</td>
    </tr>
    <tr>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--text);white-space:nowrap;">VS Code + 插件</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--muted);">官网 deb + 应用市场</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--line);color:var(--muted);">老容器 attach 有 glibc 2.28 门槛</td>
    </tr>
    <tr>
      <td style="padding:9px 10px;color:var(--text);white-space:nowrap;">GitHub 下载</td>
      <td style="padding:9px 10px;color:var(--muted);">ghfast.top 镜像前缀</td>
      <td style="padding:9px 10px;color:var(--muted);">大文件可断点续传，记得校验 SHA256</td>
    </tr>
  </tbody>
</table>

对嵌入式开发来说，这套组合真正省时间的地方不是"写代码"，而是**读代码和读日志**：陌生的 SoC BSP、几十页外设手册、上千行编译输出，都可以直接丢给 Claude 解释——编辑器负责改，容器负责编，AI 负责读。

---


