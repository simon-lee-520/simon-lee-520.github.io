---
title: git pre-commit & husky配置教程
copyright_type: original
comments: true
date: '2024-12-18 18:55:31'
tags:
- git
categories:
- 前端踩坑笔记
abbrlink: 50ee93fb
updated: '2024-12-18 18:55:31'
---

用于git commit的前置检查，阻断不合格的git提交

分步指南  
添加包含的步骤：

自动化安装[husky](https://typicode.github.io/husky/)，并安装lint-staged
    
    
    npx husky-init && npm install
    npm i lint-staged prettier -D
    npx husky set .husky/pre-commit "npx lint-staged && npm run checktype"
    npx husky set .husky/pre-push "npm test"
    

> tip:
> 
>   * husky: 对git hooks进行了封装完善，更方便地调用git hooks;
>   * lint-staged: 只检查暂存区的文件，速度更快；
>   * prettier自动格式化代码
>   * pre-push → npm test # push推送代码前,跑一遍测试用例
> 


在package.json中添加配置
    
    
    {
      "scripts": {
        ...
        "checktype": "tsc --noEmit"
      },
      ...
      "lint-staged": {
        "*.js": [
          "prettier --write"
        ],
        "*.ts?(x)": [
          "eslint",
          "prettier --parser=typescript --write"
        ]
      },
      ...
    }
    

提交至git

`git add -A && git commit -m "xxx" && git push`

> **注意事项**  
>  **Mac下或可能出现类似以下提示，husky钩子未生效：**  
>  hint: The ‘.husky/pre-commit’ hook was ignored because it’s not set as executable.  
>  hint: You can disable this warning with `git config advice.ignoredHook false`.

这是文件权限问题，需要将脚本文件设置为可执行Unix文件：

`chmod ug+x .husky/*`
