// `node --import ./test/helpers/strict-width.ts ...`: an atom layout never registered for measuring throws instead of measuring 0 wide.
process.env.SVG_DIAGRAM_STRICT_WIDTH = '1';
