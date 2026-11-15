import * as editor from './edytor/layout';
import * as wizard from './kreator/layout';
import * as published from './opublikowano/layout';
import * as panel from './panel/layout';

it.each([
  ['/panel', panel],
  ['/kreator', wizard],
  ['/edytor', editor],
  ['/opublikowano', published],
])('%s is kept out of search results', (_, layout) => {
  expect(layout.metadata.robots).toEqual({ index: false, follow: false });
  expect(layout.default).toBeTypeOf('function');
});
