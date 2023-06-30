import { isFunction } from '@vue/shared'
import { ReactiveEffect, trackEffects, triggerEffects } from './effect'

class ComputedRefImpl {
  public effect
  public _value
  public dirty = true
  // 解决情况一
  public dep = new Set()

  constructor(getter, public setter) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this.dirty) this.dirty = true
      // 解决情况一
      triggerEffects(this.dep)
    })
  }

  get value() {
    // 解决情况一
    trackEffects(this.dep)
    if (this.dirty) {
      this.dirty = false
      this._value = this.effect.run()
    }
    return this._value
  }

  set value(value) {
    this.setter(value)
  }
}

// computed接收函数或者带set/get的obj
export function computed(getterOrOptions) {
  let setter
  let getter

  const isGetter = isFunction(getterOrOptions)

  if (isGetter) {
    getter = getterOrOptions
    setter = function () {
      console.warn('you maybe need a setter')
    }
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  return new ComputedRefImpl(getter, setter)
}

// 情况一
/*
const name = computed({
  get() {
    const r = obj.firstName + obj.lastName
    console.log(r)
    return r
  },
  set(value) {
    console.log(value)
  }
})

effect(() => {
  console.log(name)
  app.innerHTML = name.value

})

setTimeout(() => {
  obj.lastName = '四'
}, 2000)

上述代码  当更改了响应式对象obj的lastName 并不会触发effect函数 也就没法重新渲染
原因是我们没有去收集effect，那么当数据变化就不会重新执行effect
解决：当获取value的时候我们去收集这个effect  等到依赖的数据变化了那么我们就触发effect
*/
