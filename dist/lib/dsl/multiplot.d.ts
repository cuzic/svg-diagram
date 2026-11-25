import type { MultiOpts, XY } from '../charts-multi.ts';
import type { ChartBand } from '../charts.ts';
import type { Declares, HandleOf } from '../strict.ts';
/** 2次元ヒストグラム (seaborn histplot(x=, y=)): the points counted in round-sized cells, the count written in each and shaded. `hist2d({x: [..], y: [..]})` */
export declare const hist2d: <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
/** ジョイントプロット (seaborn jointplot): a scatter with the histogram of each variable beside it. `jointplot({x: [..], y: [..], group?: [..]})` */
export declare const jointplot: <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
/** 2次元密度 (seaborn kdeplot(x=, y=)): a Gaussian density over the plane as five filled bands with their contour lines. `kde2d({x: [..], y: [..]})` */
export declare const kde2d: <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
/** 散布図行列 (seaborn pairplot): every pair of 2 to 6 variables as a scatter, each variable's histogram on the diagonal. `pairplot({身長: [..], 体重: [..]}, {groups: [..]})` */
export declare const pairplot: <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
