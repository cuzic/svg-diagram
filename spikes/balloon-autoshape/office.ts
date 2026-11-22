// This file transcribes the guide formulas of wedgeRectCallout from presetShapeDefinitions.xml (ECMA-376 Part 1, 5th edition, 2016).
// (c) Ecma International. The default notice of Ecma's text copyright policy (version 3) applies: by obtaining and/or copying this work you agree to
// comply with it. https://ecma-international.org/wp-content/uploads/Ecma_text_copyright_policy_version_3.pdf
// Source: the unmodified copy in the public repository cuzic/ooxml-rs, reference/ecma-376-drawingml-geometries/ (commit d8741d4e).
// A literal evaluation of ECMA-376 presetShapeDefinitions wedgeRectCallout (gdLst copied one to one), to compare with balloon.ts in 'office' mode.
import type {Pt} from './balloon.ts';
export function officeWedgeRect(w: number, h: number, adj1: number, adj2: number): Pt[] {
  const q = (c: number, a: Pt[0], b: Pt[0]): number => c > 0 ? a : b; // fmla "?: x y z"
  const l = 0, t = 0, r = w, bt = h, hc = w / 2, vc = h / 2;
  const dxPos = w * adj1 / 100000, dyPos = h * adj2 / 100000, xPos = hc + dxPos, yPos = vc + dyPos;
  const dq = dxPos * h / w, dz = Math.abs(dyPos) - Math.abs(dq);
  const x1 = w * q(dxPos, 7, 2) / 12, x2 = w * q(dxPos, 10, 5) / 12, y1 = h * q(dyPos, 7, 2) / 12, y2 = h * q(dyPos, 10, 5) / 12;
  const xl = q(dz, l, q(dxPos, l, xPos)), xt = q(dz, q(dyPos, x1, xPos), x1), xr = q(dz, r, q(dxPos, xPos, r)), xb = q(dz, q(dyPos, xPos, x1), x1);
  const yl = q(dz, y1, q(dxPos, y1, yPos)), yt = q(dz, q(dyPos, t, yPos), t), yr = q(dz, y1, q(dxPos, yPos, y1)), yb = q(dz, q(dyPos, yPos, bt), bt);
  return [[l, t], [x1, t], [xt, yt], [x2, t], [r, t], [r, y1], [xr, yr], [r, y2], [r, bt], [x2, bt], [xb, yb], [x1, bt], [l, bt], [l, y2], [xl, yl], [l, y1]];
}
