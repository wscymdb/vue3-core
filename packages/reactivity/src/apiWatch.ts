// vue3 watch api 用法有很多 这里只判断两种
// 第一种就是 监听某个函数的返回值  watch(() => obj.age, () => {...})
// 第二种就是 监听一个响应式对象 watch(obj, () => {...})

import { ifFunction, isObject } from '@vue/shared'
import { isReactive } from './reactive'
import { ReactiveEffect } from './effect'

export function watch(source, cb, options) {
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

  const effect = new ReactiveEffect(getter, () => {
    const newVal = effect.run()
    cb(newVal, oldVal)
    oldVal = newVal
  })

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
