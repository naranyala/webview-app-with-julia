const googlePdfQuery = (query) => `filetype:pdf "${query}"`;

export const SCHOLARLY_SEARCH_PROVIDERS = [
  {
    id: 'google-pdf',
    name: 'Google PDFs',
    detail: 'Find openly indexed PDF papers.',
    searchUrl: (query) =>
      `https://www.google.com/search?q=${encodeURIComponent(googlePdfQuery(query))}&newwindow=1`,
  },
  {
    id: 'google-scholar',
    name: 'Google Scholar',
    detail: 'Broad scholarly literature and citations.',
    searchUrl: (query) =>
      `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'semantic-scholar',
    name: 'Semantic Scholar',
    detail: 'Papers, citations, and related research.',
    searchUrl: (query) =>
      `https://www.semanticscholar.org/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'crossref',
    name: 'Crossref',
    detail: 'DOIs and publisher metadata.',
    searchUrl: (query) =>
      `https://search.crossref.org/?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'pubmed',
    name: 'PubMed',
    detail: 'Biomedical and life-science journals.',
    searchUrl: (query) =>
      `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`,
  },
  {
    id: 'doaj',
    name: 'DOAJ',
    detail: 'Open-access journals and articles.',
    searchUrl: (query) =>
      `https://doaj.org/search/articles?query=${encodeURIComponent(query)}`,
  },
  {
    id: 'arxiv',
    name: 'arXiv',
    detail: 'Open preprints in science and computing.',
    searchUrl: (query) =>
      `https://arxiv.org/search/?query=${encodeURIComponent(query)}&searchtype=all`,
  },
  {
    id: 'core',
    name: 'CORE',
    detail: 'Open-access research from repositories.',
    searchUrl: (query) =>
      `https://core.ac.uk/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'openalex',
    name: 'OpenAlex',
    detail: 'Open research catalog and metadata.',
    searchUrl: (query) =>
      `https://openalex.org/works?search=${encodeURIComponent(query)}`,
  },
];

export const WEB_SEARCH_PROVIDERS = [
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    detail: 'Reference articles, terminology, and linked sources.',
    searchUrl: (query) =>
      `https://en.wikipedia.org/w/index.php?title=Special:Search&fulltext=1&search=${encodeURIComponent(query)}&ns0=1`,
  },
  {
    id: 'google-web',
    name: 'Google web',
    detail: 'Broad web search beyond scholarly indexes.',
    searchUrl: (query) =>
      `https://www.google.com/search?q=${encodeURIComponent(query)}&newwindow=1`,
  },
  {
    id: 'hacker-news',
    name: 'Hacker News',
    detail: 'Technology discussions and linked source material.',
    searchUrl: (query) =>
      `https://hn.algolia.com/?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'reddit',
    name: 'Reddit',
    detail: 'Community discussions, field reports, and recommendations.',
    searchUrl: (query) =>
      `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'github',
    name: 'GitHub',
    detail: 'Source code, datasets, and research software.',
    searchUrl: (query) =>
      `https://github.com/search?q=${encodeURIComponent(query)}&type=repositories`,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    detail: 'Lectures, demonstrations, and conference talks.',
    searchUrl: (query) =>
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  },
];

export const PUBLISHER_SEARCH_PROVIDERS = [
  {
    id: 'ieee-xplore',
    name: 'IEEE Xplore',
    detail: 'Engineering, computing, and standards literature.',
    searchUrl: (query) =>
      `https://ieeexplore.ieee.org/search/searchresult.jsp?newsearch=true&queryText=${encodeURIComponent(query)}`,
  },
  {
    id: 'acm-dl',
    name: 'ACM Digital Library',
    detail: 'Computer science journals and conference proceedings.',
    searchUrl: (query) =>
      `https://dl.acm.org/action/doSearch?AllField=${encodeURIComponent(query)}`,
  },
  {
    id: 'springer-link',
    name: 'SpringerLink',
    detail: 'Research articles, books, and reference works.',
    searchUrl: (query) =>
      `https://link.springer.com/search?query=${encodeURIComponent(query)}`,
  },
  {
    id: 'science-direct',
    name: 'ScienceDirect',
    detail: 'Elsevier journals, books, and open-access articles.',
    searchUrl: (query) =>
      `https://www.sciencedirect.com/search?qs=${encodeURIComponent(query)}`,
  },
  {
    id: 'nature',
    name: 'Nature',
    detail: 'Nature Portfolio research and news.',
    searchUrl: (query) =>
      `https://www.nature.com/search?q=${encodeURIComponent(query)}`,
  },
];

export const TECH_REFERENCE_SEARCH_PROVIDERS = [
  {
    id: 'stack-overflow',
    name: 'Stack Overflow',
    detail: 'Programming questions, answers, and practical fixes.',
    searchUrl: (query) =>
      `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'mdn',
    name: 'MDN Web Docs',
    detail: 'Web platform documentation and browser references.',
    searchUrl: (query) =>
      `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'internet-archive',
    name: 'Internet Archive',
    detail: 'Digitized books, media, and historical material.',
    searchUrl: (query) =>
      `https://archive.org/search?query=${encodeURIComponent(query)}`,
  },
];

export function buildSearchUrl(provider, query) {
  const normalizedQuery = String(query || '').trim();
  return normalizedQuery ? provider.searchUrl(normalizedQuery) : '';
}
