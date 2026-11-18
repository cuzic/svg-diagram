import { checkToday } from './today-auto.ts';
export { checkToday };
/** The day for `today: 'auto'`: the CLI's, else the environment's, else the project's (an empty variable counts as unset). */
export declare function resolveToday(cli: string | undefined, cfgToday: string | undefined, env?: NodeJS.ProcessEnv): string | undefined;
