// 正在执行的effect函数
export let activeEffect = undefined

function cleanupEffect(effect) {
  const { deps } = effect
  console.log(deps)
  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(effect)
  }

  effect.deps.length = 0
}
export class ReactiveEffect {
  constructor(private fn, public scheduler) {}
  // 解决情况四
  deps = []
  // 解决情况二 嵌套effect的问题
  parent = undefined

  //
  active = true

  run() {
    if (!this.active) return this.fn()
    // try包裹是为了防止执行fn函数报错 影响后续代码
    // 下面的代码解决了 情况一和情况二的问题
    try {
      this.parent = activeEffect
      activeEffect = this
      // 解决情况四
      cleanupEffect(this)
      return this.fn()
    } finally {
      activeEffect = this.parent
      // 复原parent  可要可不要 最好写上 保持好习惯
      this.parent = undefined
    }
  }
  // 解决情况五
  stop() {
    if (this.active) {
      this.active = false
      cleanupEffect(this)
    }
  }
}

export function effect(fn, options: any = {}) {
  // 创建一个响应式effect
  const _effect = new ReactiveEffect(fn, options.scheduler)
  _effect.run()

  // 绑定this 不然外界调用this会有问题
  const runner = _effect.run.bind(_effect)

  runner.effect = _effect
  return runner
}

// 这个函数的主要作用就是将key 和对应的函数组成如下的数据结构
// WeakMap {Object => Map(1)}  Map(1) {'name' => Set(2)}
// {name:'zs'} => name => [effect1,effect2]
// weakMap => map => set
const targetMap = new WeakMap()
export function track(target, key) {
  // 只用是effect中的才跟踪收集依赖
  if (!activeEffect) return

  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  // 虽然set是不会重复的 但是内部肯定会做逻辑的 那么如果我们判断一下在加入会提升性能
  let shouldTrack = !dep.has(activeEffect)
  if (shouldTrack) {
    dep.add(activeEffect)
    // 解决情况四
    activeEffect.deps.push(dep)
  }
}

// 此方法目的是等到修改数据了从依赖表中拿到对应的effect 然后执行
export function trigger(target, key, newValue, oldValue) {
  const depsMap = targetMap.get(target)

  if (!depsMap) return

  const dep = depsMap.get(key)

  // 解决情况四
  const effects = [...dep]

  effects &&
    effects.forEach((effect) => {
      // 做个判断 为了防止情况三 的发生
      if (effect !== activeEffect) {
        // 解决情况六
        if (effect.scheduler) {
          effect.scheduler()
        } else {
          effect.run()
        }
      }
    })
}

// effect函数的作用
/**
 * effect是一个副作用函数，返回当前触发get的key对应的函数
 * 当某个key触发了对应的get 会调用track函数来收集跟踪依赖 那么这时候就需要拿到key对应的函数
 *
 */

// 情况一
/**
    effect(() => {
      app.innerHTML += proxyObj1.age
    })

    proxyObj1.address

    这种情况 proxyObj1.address也会触发get 但是这个并没有被effect函数包裹，所以他并没有对应的effect函数 
    
    解决：执行当前的fn后让activeEffect为undefined  这样proxyObj1.address触发get 执行track函数的时候 activeEffect就是undefined了 就不会执行后续逻辑了

  run() {
    try {
      activeEffect = this
      return this.fn()
    } finally {
      activeEffect = undefined
    }
  }
    
*/

// 情况二  effect嵌套
/**
 *   effect(() => {  // e1
      app.innerHTML = proxyObj1.name
      effect(() => {  // e2
        app.innerHTML += proxyObj1.age
      })
      proxyObj1.address
    })
    上面这段代码 如果使用情况一的解决方案 还是会有问题  
    name 对应的effect是 e1  
    age 对应的effect是 e2
    address 对应的effect是undefined 这就不对了 address应该对应e1

    解决： vue2和早期的vue3使用的是栈来解决 但是这会多出一个全局的变量 不太好
    现在的解决方案是 使用树结构来解决 
    原理是：给每个effect指定一个parent，指向的是当前effect的父effect，等到子effect执行完毕 在让activeEffect执行父effect  具体看上面完整代码
 */

// 情况三
/**
 * 当定时器更改obj.name 那么就会触发effect函数 执行obj.name = Math.random() 此时又会触发effect...如此往复成了死循环 因为random是随机数
 *    effect(() => {
      obj.name = Math.random()
      app.innerHTML = obj.name
    })

    setTimeout(() => {
      obj.name = 'wzng'
    }, 2000)
 */

// 情况四
// 如下代码 当我们执行定时器的内容 flag 已经是false了 然后在执行obj.name=‘xxx' 这时候不应该执行console.log
// 换句话来说就是 因为flag是false了就不应该再去收集name的依赖了，只用收集flag和age的依赖就行 这样会节约性能

// 做法  当我们在收集依赖的时候 收集当前effect和触发的key之间的关系 每次执行run的时候先将其清空
// 然后等到更新时再次收集 eg：更新的时候会触发get和set
// 说句白话就是 在当前的effect.deps中存储key对应的effect

// effect(() => {
//   app.innerHTML = obj.flag ? obj.name : obj.age
// })

// setTimeout(() => {
//   obj.flag = false
//   setTimeout(() => {
//     console.log('name')
//     obj.name = 'xxx'
//   }, 1000)
// }, 2000)

// 使用该解决方案后代码会进入死循环 分析如下

/*
跟新数据触发 trigger  会执行 
dep &&
    dep.forEach((effect) => {
      if (effect !== activeEffect) effect.run()
    })
接着执行 effect.run() 
run中会执行cleanupEffect()  该还是会将当前的dep中的内容清空
然后 会执行fn fn中又会收集依赖 会对dep中继续add 
此时代码还在forEach中 因为add了所以会继续往后遍历 继续执行run 然后就形成了死循环
下面是模仿上面的代码

// 这个就是dep
const set = new Set([1])

// 遍历
set.forEach((item) => {
  // 执行run方法
  run()
})

function run() {
  // 简单模仿
  set.delete(1)
  set.add(1)
}

解决
触发死循环的是因为在同一个set中添加 删除导致的 所以我们可以将其set中的内容放到一个数组 然后遍历数组即可 
const effects = [...dep]

  effects &&
    effects.forEach((effect) => {
      // 做个判断 为了防止情况三 的发生
      if (effect !== activeEffect) effect.run()
    })
*/

// 情况五
// 官网的effect还实现了一个功能 就是当数据变化时我们不希望自动更新，而是我们调用方法手动跟新

// const runner = effect(() => {
//   app.innerHTML = obj.name

// })
// runner.effect.stop()

// setTimeout(() => {
//   obj.name = 'lisi'
//   runner()
// }, 2000)

/*现在我们来分析一下怎么实现上述说的功能，说白了就是当调用stop方法的时候，清空当前的依赖关系即可(上面已经编写过了该方法cleanupEffect)，这样等到set的时候去依赖表里找依赖关系找不到 就不会更新了  但是会有一个问题 虽然清空了依赖 但是当修改数据的时候又会重新的搜集依赖，所以我们需要一个标识来表示是否是活跃的 如果不是活跃的那么就代表了调用了stop 只有激活的时候才执行run中的逻辑  非激活状态直接调用fn即可 (当用户手动调用runner的时候要执行fn 这样就做到了手动跟新)*/

// 情况六
/*
effect还提供了一个功能就是 当数据修改之后，不使用原来的effect跟新而是使用我们自己提供的方法来跟新
const runner = effect(() => {
  app.innerHTML = obj.name

}, {
  scheduler() {
    app.innerHTML = 123
  }
})

// 当数据修改 不使用effect中的函数来更新 而使用提供的scheduler来更新
setTimeout(() => {
  obj.name = 'lisi'
}, 2000)

那么现在我们来分析一下实现的原理，其实原理是比较简单的，我们在使用effect时传入自己的方法，格式按照上面的来(官方的)，那么当修改的数据的时候 调用trigger时 判断当前effect是否有scheduler 如果有就调用。没有就调用原来的effect
*/
