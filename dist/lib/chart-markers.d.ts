export type Shape = 'disc' | 'diamond' | 'square' | 'triangle' | 'ring';
export declare const SHAPES: Shape[];
export declare function markerPath(shape: Shape, x: number, y: number, r: number): string;
