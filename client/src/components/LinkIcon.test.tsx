import { render } from '@testing-library/react';
import { domainName, LinkIcon, shortUrl } from './LinkIcon';

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

describe('domainName', () => {
  it.each([
    ['https://webhome.pl', 'Webhome'],
    ['https://blog.webhome.pl', 'BlogWebhome'],
    ['https://www.webhome.pl/kontakt', 'Webhome'],
    ['https://www.blog.webhome.pl', 'BlogWebhome'],
    ['https://studio-wisniewska.pl', 'StudioWisniewska'],
    ['https://sklep.com.pl', 'Sklep'],
    ['https://shop.example.co.uk', 'ShopExample'],
    ['https://blog.net.com', 'BlogNet'],
    ['http://localhost:8080', 'Localhost'],
    ['https://żabka.pl', 'Żabka'],
    ['https://blog.żółw.com.pl/', 'BlogŻółw'],
    ['https://xn--e1afmkfd.xn--p1ai/strona', 'xn--e1afmkfd.xn--p1ai/strona'],
    ['HTTPS://Blog.Webhome.PL.', 'BlogWebhome'],
    ['nie adres', 'nie adres'],
  ])('%s → %s', (url, name) => {
    expect(domainName(url)).toBe(name);
  });
});
