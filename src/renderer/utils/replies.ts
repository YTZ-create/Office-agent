/** 共享的随机回复数组，避免在多处重复定义 */
export const START_REPLIES = [
  '好的，我看看',
  '收到，马上处理',
  '没问题，交给我',
  '了解了，这就开始',
  '好的，我来分析一下',
  '收到，稍等片刻',
  '明白，马上搞定',
  '好嘞，这就安排',
]

export const END_REPLIES = [
  '生成完毕',
  '搞定了',
  '完成了',
  '处理好了',
  '分析完毕',
  '报告已生成',
  '全部完成',
  '搞定了，请查看',
]

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
