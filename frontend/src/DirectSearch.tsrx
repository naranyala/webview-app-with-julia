import { useState } from 'octane';
import {
  buildSearchUrl,
  PUBLISHER_SEARCH_PROVIDERS,
  SCHOLARLY_SEARCH_PROVIDERS,
  TECH_REFERENCE_SEARCH_PROVIDERS,
  WEB_SEARCH_PROVIDERS,
} from './search-providers.js';
import { IconSearch, IconExternalLink, IconBookOpen } from './utils.js';

function openSearch(url) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened === null) window.location.assign(url);
}

function ProviderGrid({ providers, query }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
      gap: 'var(--space-3)',
    }}>
      {providers.map((provider) => (
        <button
          class="card"
          type="button"
          key={provider.id}
          onClick={() => {
            const url = buildSearchUrl(provider, query);
            if (url) openSearch(url);
          }}
          disabled={!query.trim()}
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {provider.name}
            </span>
            <IconExternalLink size="0.8rem" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {provider.detail}
          </span>
        </button>
      ))}
    </div>
  );
}

function SearchSection({ title, description, providers, query }) {
  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--accent)',
          marginBottom: 'var(--space-1)',
        }}>
          {description}
        </div>
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          {title}
        </h3>
      </div>
      <ProviderGrid providers={providers} query={query} />
    </div>
  );
}

export function DirectSearch({ onBack }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Enter a topic, organism, method, or exact paper title.');

  function submit(event) {
    event.preventDefault();
    const url = buildSearchUrl(SCHOLARLY_SEARCH_PROVIDERS[0], query);
    if (url) {
      openSearch(url);
      setStatus(`Opening ${SCHOLARLY_SEARCH_PROVIDERS[0].name} for "${query.trim()}".`);
    }
  }

  return (
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-icon">
            <IconBookOpen size="1rem" />
          </div>
          <div>
            <div class="panel-header-title">Direct web search</div>
            <div class="panel-header-subtitle">
              Search scholarly sources, publishers, and technical references
            </div>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <div class="card" style={{ marginBottom: 'var(--space-8)' }}>
          <div class="card-header">
            <div class="card-title">Search</div>
          </div>
          <form onSubmit={submit}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
              <div class="form-group" style={{ flex: 1 }}>
                <label class="form-label">Research topic</label>
                <div class="search-input-wrapper">
                  <span class="search-input-icon">
                    <IconSearch size="0.9rem" />
                  </span>
                  <input
                    class="form-input"
                    autofocus
                    value={query}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                    placeholder="e.g. trichoderma biocontrol"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>
              <button class="btn btn-primary" type="submit">
                Search papers
              </button>
            </div>
          </form>
        </div>

        <SearchSection
          title="Scholarly search"
          description="Papers and journals"
          providers={SCHOLARLY_SEARCH_PROVIDERS}
          query={query}
        />

        <SearchSection
          title="Web & reference"
          description="Context and discovery"
          providers={WEB_SEARCH_PROVIDERS}
          query={query}
        />

        <SearchSection
          title="Publisher libraries"
          description="Publisher collections"
          providers={PUBLISHER_SEARCH_PROVIDERS}
          query={query}
        />

        <SearchSection
          title="Technical & reference"
          description="Implementation and archives"
          providers={TECH_REFERENCE_SEARCH_PROVIDERS}
          query={query}
        />
      </div>

      <div class="status-bar">
        <div class="status-message">
          <span class="status-icon status-icon--info" />
          {status}
        </div>
      </div>
    </div>
  );
}
