import { render } from '@testing-library/react';
import { HydrationMarker } from './HydrationMarker';

it('marks the document as hydrated', () => {
  render(<HydrationMarker />);

  expect(document.documentElement.dataset.hydrated).toBe('true');
});
