import {defineSwimlanePart} from '../swimlane.ts';
import {swimlane as build} from '../../bands/swimlane.ts';
import {connectDefinition} from '../../bands/connect.ts';

const swimlane = (lanes: never, steps: never, opts: never) => build(lanes, steps, opts, connectDefinition);

export const swimlanePart = /* @__PURE__ */ defineSwimlanePart<ReturnType<typeof swimlane>>(swimlane);
