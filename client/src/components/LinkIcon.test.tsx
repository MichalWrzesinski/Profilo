import { render } from '@testing-library/react';
import { LinkIcon, shortUrl } from './LinkIcon';

describe('LinkIcon', () => {
  it.each([
    ['linkedin', 'in'],
    ['behance', 'Bē'],
    ['x', 'X'],
  ] as const)('marks %s as %s', (service, mark) => {
    const { container } = render(<LinkIcon service={service} />);
    expect(container.textContent).toBe(mark);
  });

  it('uses the globe for other sites', () => {
    const { container } = render(<LinkIcon service="other" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it.each([
    ['https://www.linkedin.com/in/anna/', 'linkedin.com/in/anna'],
    ['http://studio.pl', 'studio.pl'],
  ])('shortens %s', (url, short) => {
    expect(shortUrl(url)).toBe(short);
  });
});
