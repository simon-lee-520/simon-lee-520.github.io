---
title: JS四则运算重新封装，解决精度丢失问题
comments: true
date: '2021-07-28 13:42:12'
tags:
- javascript
- 原型模式
- 前端
categories:
- 前端踩坑笔记
abbrlink: 4f53ca67
updated: '2021-07-28 13:42:12'
---

## math.js
    
    
    /* eslint-disable one-var */
    /* eslint-disable no-extend-native */
    /*
     * @Author: Simon
     * @Date: 2021-07-14 16:32:43
     * @LastEditors: Simon
     * @LastEditTime: 2022-04-11 18:49:53
     * @Description: 四则运算重新封装，解决精度丢失问题
     */
    
    // 加法
    Number.prototype.add = function (arg) {
      let r1, r2, m
      try { r1 = this.toString().split('.')[1].length } catch (e) { r1 = 0 }
      try { r2 = arg.toString().split('.')[1].length } catch (e) { r2 = 0 }
      m = Math.pow(10, Math.max(r1, r2))
      return (this * m + arg * m) / m
    }
    // 减法
    Number.prototype.sub = function (arg) {
      let r1, r2, m, n
      try { r1 = this.toString().split('.')[1].length } catch (e) { r1 = 0 }
      try { r2 = arg.toString().split('.')[1].length } catch (e) { r2 = 0 }
      m = Math.pow(10, Math.max(r1, r2))
      // 动态控制精度长度
      n = (r1 >= r2) ? r1 : r2
      return Number(((this * m - arg * m) / m).toFixed(n))
    }
    // 乘法
    Number.prototype.mul = function (arg) {
      let m = 0, s1 = this.toString(), s2 = arg.toString()
      try { m += s1.split('.')[1].length } catch (e) { }
      try { m += s2.split('.')[1].length } catch (e) { }
      return Number(s1.replace('.', '')) * Number(s2.replace('.', '')) / Math.pow(10, m)
    }
    // 除法
    Number.prototype.div = function (arg) {
      let t1 = 0, t2 = 0, r1, r2
      try { t1 = this.toString().split('.')[1].length } catch (e) { }
      try { t2 = arg.toString().split('.')[1].length } catch (e) { }
      r1 = Number(this.toString().replace('.', ''))
      r2 = Number(arg.toString().replace('.', ''))
      return (r1 / r2) * Math.pow(10, t2 - t1)
    }
    
    // 三位分节法（千分位加逗号）
    Number.prototype.toThousandsString = function () {
      let str = this.toString()
      let reg = ~str.indexOf('.') ? /(\d)(?=(\d{3})+\.)/g : /(\d)(?=(?:\d{3})+$)/g
      return str.replace(reg, '$1,')
    }
