---
title: Markdown 语法速览：本站支持的写法
date: 2026-09-15
category: 学习笔记
summary: 一篇自带样式的速查帖：标题、列表、引用、行内代码、代码块在终端风主题下的实际效果。
---

写文章用标准 Markdown 就行。这篇帖子本身就是一个"活的样式表"，每个元素长什么样，看这里。

## 标题与正文

上面是二级标题。正文段落支持 **粗体**、*斜体*、[链接](https://docs.astro.build)、行内代码比如 `pnpm build`，以及图片语法。

## 列表

- 无序列表项一
- 无序列表项二
1. 有序列表项一
2. 有序列表项二

> 引用块：适合放摘录、备注，或者自嘲。

## 代码块

围栏代码块用 ``` 语言名 开头，会得到暗色终端窗 + 语法高亮：

```c
#include <stdio.h>

/* 经典开场：磷光绿关键字，琥珀字符串 */
int main(void) {
    const char *msg = "hello, world";
    printf("%s\n", msg);
    return 0;
}
```

```bash
# 构建与预览
pnpm build && pnpm preview
```

## 分隔线

---

以上。写完保存，首页和归档页会自动出现这篇文章。
