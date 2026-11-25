import { defineSwimlanePart } from '../swimlane.js';
import { swimlane as build } from '../../bands/swimlane.js';
import { connectDefinition } from '../../bands/connect.js';
const swimlane = (lanes, steps, opts) => build(lanes, steps, opts, connectDefinition);
export const swimlanePart = /* @__PURE__ */ defineSwimlanePart(swimlane);
