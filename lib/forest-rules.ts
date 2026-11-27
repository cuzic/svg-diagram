// The rules of forest() (ADR 0084 D3, D5): what its layout noticed. Both are info: the figure is drawn as specified.
export const forestRules = /* @__PURE__ */ Object.freeze({
  'forest-clipped': {doc: 'forest(): 区間が軸の端を越える行がある。研究の行は端で切って矢じりを付け、統合の行は端で平らに切る。全体を見せるなら domain を広げる', scope: 'band'},
  'forest-weight-partial': {doc: 'forest(): 一部の行だけに weight がある。weight の無い行は 10px の四角で描く。全部の行に weight を付けるか、全部外す', scope: 'band'},
} as const);
