// packages/shared/src/index.ts
var isObject = (value) => value !== null && typeof value === "object";

// packages/reactivity/src/reactive.ts
var mutableHandles = {
  get(target, key, receiver) {
    if (!target["__v_isReactive" /* IS_REACTIVE */])
      target["__v_isReactive" /* IS_REACTIVE */] = true;
    return Reflect.get(target, key, receiver);
  },
  set(target, key, value, receiver) {
    return Reflect.set(target, key, value, receiver);
  }
};
var reactiveMap = /* @__PURE__ */ new WeakMap();
function reactive(target) {
  if (!isObject(target))
    return;
  const existsProxy = reactiveMap.get(target);
  if (existsProxy)
    return existsProxy;
  if (target["__v_isReactive" /* IS_REACTIVE */])
    return target;
  const proxy = new Proxy(target, mutableHandles);
  reactiveMap.set(target, proxy);
  return proxy;
}

// packages/reactivity/src/effect.ts
function effect() {
}
export {
  effect,
  reactive
};
//# sourceMappingURL=reactivity.js.map
