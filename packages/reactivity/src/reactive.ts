import { isObject } from '@vue/shared'
import { track, trigger } from './effect'

export const enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive',
}

export const mutableHandles = {
  get(target, key, receiver) {
    // 解决情况二
    if (!target[ReactiveFlags.IS_REACTIVE])
      target[ReactiveFlags.IS_REACTIVE] = true

    // 解决情况三

    if (isObject(target[key])) return reactive(target[key])

    return Reflect.get(target, key, receiver)
  },

  set(target, key, value, receiver) {
    const oldValue = target[key]

    const r = Reflect.set(target, key, value, receiver)

    if (oldValue !== value) trigger(target, key, value, oldValue)
    return r
  },
}

const reactiveMap = new WeakMap()
export function reactive(target) {
  // reactive只能处理对象类型的数据
  if (!isObject(target)) return

  // 解决情况一 无需重复代理
  const existsProxy = reactiveMap.get(target)
  if (existsProxy) return existsProxy

  // 解决情况二
  if (target[ReactiveFlags.IS_REACTIVE]) return target

  // 创建代理
  const proxy = new Proxy(target, mutableHandles)
  // 缓存代理结果 无需重复代理
  reactiveMap.set(target, proxy)
  return proxy
}

// 情况一 obj已经被代理过一次了，不需要再次代理，否则会浪费性能
/*
const obj = {
  name: 'zs',
  age: 19
}
const proxyObj1 = reactive(obj)
const proxyObj2 = reactive(obj)
*/

// 情况二 代理 代理对象
/**
 * 解决思路 利用get 给当前被代理对象添加一个标识符 标识该对象已经被代理了
 * 具体做法
 * 当代码走到reactive函数的if (target[ReactiveFlags.IS_REACTIVE]) return target这段其实就会触发get （target[ReactiveFlags.IS_REACTIVE]主要是这部分触发的get） 这时候给原对象添加标识符即可  第一次肯定不存在这个标识符 所以会被代理
 *
 * 那么即使再代理这个代理对象 就像下面proxyObj2一样，也不会继续代理 因为target[ReactiveFlags.IS_REACTIVE]的结果是true
 */

/*
const obj = {
  name: 'zs',
  age: 19,
}
const proxyObj1 = reactive(obj)
const proxyObj2 = reactive(proxyObj1)
*/

// 情况三
/*
如下代码 info并不是一个代理对象那么当数据发生变化就不会自动更新 
原因是 Proxy只能浅层的代理
解决方案 使用递归代理  在get中判断key是否是对象 如果是则继续用reactive代理
const obj = {
  name: 'zs',
  info: {
    age: 19
  }
}
console.log(obj.info)
*/
