import {withSourceLine, withTitleLine} from './layout-caption-lines.ts';
import {withStatus} from './status.ts';
import type {DiagramData} from './types/core.ts';

export const decorateDiagram = (data: DiagramData): DiagramData => withStatus(withSourceLine(withTitleLine(data)));
