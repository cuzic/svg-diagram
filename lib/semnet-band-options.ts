export const semnetBandOptions = (opts: {id?: string; width?: number; height?: number; labelRole?: 'note' | 'banner' | 'stat'; reveal?: number; until?: number}) => ({
  ...(opts.id === undefined ? {} : {id: opts.id}),
  ...(opts.width === undefined ? {} : {width: opts.width}),
  ...(opts.height === undefined ? {} : {height: opts.height}),
  ...(opts.labelRole === undefined ? {} : {labelRole: opts.labelRole}),
  ...(opts.reveal === undefined ? {} : {reveal: opts.reveal}),
  ...(opts.until === undefined ? {} : {until: opts.until}),
});
