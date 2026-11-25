export declare const stepsPart: {
    type: string;
    description: string;
    schema: import("../../spec-kit.ts").JsonSchema;
    example: import("../../spec-kit.ts").Json;
    check: import("../../spec-kit.ts").Check;
    build: (part: import("../../spec-kit.ts").Json, at: string) => import("../../band-def.ts").WithBandDef<import("../../dsl-pure.ts").RowBand & import("../../strict.ts").Declares<never>, import("../../dsl-pure.ts").LaidOutRow>;
    anchors?: string | ((part: import("../../spec-kit.ts").Json, at: string) => {
        id: string;
        path: string;
    }[]);
    en?: import("../../spec-kit.ts").Json;
    legendEn?: Readonly<Record<string, string>>;
    connectors: import("../../band-def.ts").BandDef<import("../../dsl-pure.ts").ConnectBand, import("../../dsl-pure.ts").LaidOutConnect>;
};
