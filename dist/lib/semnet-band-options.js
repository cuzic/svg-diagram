export const semnetBandOptions = (opts) => ({
    ...(opts.id === undefined ? {} : { id: opts.id }),
    ...(opts.width === undefined ? {} : { width: opts.width }),
    ...(opts.height === undefined ? {} : { height: opts.height }),
    ...(opts.labelRole === undefined ? {} : { labelRole: opts.labelRole }),
    ...(opts.reveal === undefined ? {} : { reveal: opts.reveal }),
    ...(opts.until === undefined ? {} : { until: opts.until }),
});
