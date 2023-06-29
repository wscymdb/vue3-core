// vue3 watch api 用法有很多 这里只判断两种
// 第一种就是 监听某个函数的返回值  watch(() => obj.age, () => {...})
// 第二种就是 监听一个响应式对象 watch(obj, () => {...})

import { ifFunction, isObject } from '@vue/shared'
import { isReactive } from './reactive'
import { ReactiveEffect } from './effect'

export function watch(source, cb, options) {
  return dowatch(source, cb, options)
}

export function watchEffect(source, cb, options) {
  return dowatch(source, null, options)
}

export function dowatch(source, cb, options) {
  let getter
  // 如果传入的是响应式对象 那么对该对象中所有的属性进行依赖搜集
  if (isReactive(source)) {
    getter = () => traverse(source)
  } else if (ifFunction(source)) {
    getter = source
  }

  // 上面已经做了判断且 getter是一个函数了
  // 那么我们只需要去创建一个响应的effect即可
  // 然后我们需要调用run方法来收集依赖  这一步其实和effect api做的事情一样 且这时候的返回值就是修改数据之前的值(老值)
  // 当数据变化 因为我们传入了调度函数 所以会执行调度函数 接下来都是函数内的操作
  // 这里为了获取变化后的值(新值) 我们需要手动调用run 然后调用cb即可
  // 最后 为了防止这种情况，setInterval(() => {obj.name=Math.random()} 模仿更新多次name都是不一样的值, 1000),下次跟新当前的新值就是老值了
  // 这里主意 如果你监听的是响应式对象 是无法获取哪个值变化的 官方亦是如此

  let oldVal

  // 解决情况二
  let clear
  let onCleanup = (fn) => {
    clear = fn
  }

  // 首先要明确 watchEffect 是不需要传入回调函数的
  // 因为没有回调 那么当数据变化我们调用effect.run即可
  // 这里我们判断有没有cb就知道是watch还是watchEffect了
  const job = () => {
    if (cb) {
      if (clear) clear()
      const newVal = effect.run()
      cb(newVal, oldVal, onCleanup)
      oldVal = newVal
    } else {
      effect.run()
    }
  }

  const effect = new ReactiveEffect(getter, job)

  oldVal = effect.run()
}

// 目的是让响应式对象种的所有属性都能够触发get 收集依赖
// seen 目的是解决死循环 详情见情况一
function traverse(value, seen = new Set()) {
  if (!isObject(value)) return

  // 解决情况一
  if (seen.has(value)) return
  seen.add(value)

  for (let key in value) {
    traverse(value[key], seen)
  }
  return value
}

// 情况一
/*
const obj = reactive({
  name: 'zs',
  age: 19
})
obj.obj = obj
console.log(obj)

watch(obj, () => {
  console.log(123)
})

上述代码 出现了循环引用 obj中永远会有obj 那么这样递归的时候就会造成死循环 
*/

// 情况二
/*
现在有这种情况 用户在搜索框输入 我们监听输入框的变化每次变化 就去发送请求 类似于你在百度搜索的时候每次输入都会有联想词  那么我们在输入框输入两个字符 都会触发watch 但是第一次的请求2s后才拿到结果(s) 第二次的1s就拿到结果(d)了 那么现在页面上显示的是s 因为第一次的请求慢覆盖了第二次的结果 


let time = 4000
function getDate(value) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(value)
    }, (time -= 1000))
  })
}

// vue2中的解决方案
// 只要触发了watch 就将上次的flag设置为false 那么就不会执行渲染了 注意每次的flag都不是同一个

let arr = []
watch(
  () => obj.name,
  async (newVal, oldVal) => {
    while (arr.length) {
      let fn = arr.shift()
      fn && fn()
    }

    arr.push(() => {
      flag = false
    })

    let flag = true
    const r = await getDate(newVal)
    console.log(r)
    flag && (app.innerHTML = r)
  },
  { flush: 'sync' }
)

// vue3中提供了一个方法 你只需要将回调放入该方法 那么下一次watch中就会自动执行该回调 原理和上面的差不多

watch(
  () => obj.name,
  async (newVal, oldVal, onCleanup) => {
    onCleanup(() => {
      flag = false
    })

    let flag = true
    const r = await getDate(newVal)
    flag && (app.innerHTML = r)
  },
  { flush: 'sync' }
)

obj.age = 's'
obj.age = 'd'
*/
