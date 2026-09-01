/**
 * eventBus.js — 事件总线（观察者模式）
 * 组件间通信的发布/订阅中心，解耦模块之间的直接调用。
 */
export const eventBus = {
  _events: new Map(),

  /**
   * 订阅事件
   * @param {string} event 事件名
   * @param {Function} handler 处理器
   * @returns {Function} 取消订阅函数
   */
  on(event, handler) {
    if (!this._events.has(event)) this._events.set(event, new Set());
    this._events.get(event).add(handler);
    return () => this.off(event, handler);
  },

  /**
   * 取消订阅
   */
  off(event, handler) {
    const handlers = this._events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) this._events.delete(event);
    }
  },

  /**
   * 触发事件（同步，所有监听者按注册顺序执行）
   * @param {string} event 事件名
   * @param {*} payload 载荷
   */
  emit(event, payload) {
    const handlers = this._events.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[eventBus] 处理事件 "${event}" 时出错:`, err);
      }
    });
  },

  /** 一次性订阅 */
  once(event, handler) {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  },

  /** 清空全部事件监听 */
  clear() {
    this._events.clear();
  }
};

export default eventBus;
