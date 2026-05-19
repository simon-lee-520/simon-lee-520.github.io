---
title: Vue props传入function时的this指向问题
copyright_type: original
comments: true
date: '2021-01-04 16:01:58'
tags:
- vue
- uni-app
categories:
- Vue
abbrlink: ffe0b7c
updated: '2021-01-04 16:01:58'
---

### Vue props传入function时的this指向问题

**Parent.vue**
    
    
    <template>
      <div>
        <Child :func="parentFunc"></Child>
      </div>
    </template>
    
    <script>
    import Child from './Child'
    export default {
      data () {
        return {
          msg: 'this is parent.'
        }
      },
      components: {
        Child
      },
      methods: {
        parentFunc () {
          console.log(this.msg)
        }
      }
    }
    </script>
    

**Child.vue**
    
    
    <template>
      <div>
        <button @click="childFunc">click</button>
      </div>
    </template>
    
    <script>
    export default {
      props: {
        func: {
          require: false,
          type: Function,
          default: () => {
            return () => {
              console.log(this.msg)
            }
          }
        }
      },
      data () {
        return {
          msg: 'this is child.'
        }
      },
      methods: {
        childFunc () {
          this.func()
        }
      }
    }
    </script>
    

### 踩坑笔记

  * props传入function时，函数中this自动绑定Vue实例；
  * 在H5的Vue中项目中，console将输出 “this is parent.”；  
但在uni-app小程序中使用Vue时，console将输出“this is child”；
  * 我的解决方案：  
将父组件msg作为参数传给子组件，子组件props接收msg，然后在父组件的parantFunc中，无论this 指向父组件还是子组件，this.msg总能取得正确的值；
  * 为什么不使用v-on监听子组件事件并用$emit触发事件？ 
    1. Vue中不推荐向子组件传递Function的方式，因为Vue有更好的事件父子组件通信机制；
    2. 我的原因：项目中的子组件是一个公共组件，原本的代码是使用props+Function的方式，且存在默认值，默认调用函数default默认值；如果改为事件$emit的方式，则涉及修改的地方较多；
    3. 因此，在尽量不影响原来的业务代码的原则下，采用上述解决方案解决该问题；
