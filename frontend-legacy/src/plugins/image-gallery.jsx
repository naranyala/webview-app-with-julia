import { useEffect, useRef, useState } from 'preact/hooks';
import { AsyncFeedback } from '../async-feedback.jsx';
import { backend, backendError } from '../backend.js';
import { formatBytes } from '../format-bytes.js';
import { sx } from '../stylex-styles.js';

const IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.bmp',
  '.tiff',
  '.ico'
];

const MOCK_DIR = '~/Pictures';
const MOCK_IMAGES = [
  {
    name: 'landscape.jpg',
    isDir: false,
    size: 245760,
    modified: '2026-09-15T10:00:00Z'
  },
  {
    name: 'portrait.png',
    isDir: false,
    size: 102400,
    modified: '2026-09-14T08:30:00Z'
  },
  {
    name: 'screenshot.png',
    isDir: false,
    size: 81920,
    modified: '2026-09-13T12:00:00Z'
  },
  {
    name: 'banner.svg',
    isDir: false,
    size: 4096,
    modified: '2026-09-12T16:45:00Z'
  },
  {
    name: 'logo.webp',
    isDir: false,
    size: 12288,
    modified: '2026-09-11T11:30:00Z'
  },
  {
    name: 'texture.jpg',
    isDir: false,
    size: 512000,
    modified: '2026-09-10T09:00:00Z'
  }
];

export function ImageGallery() {
  const [dirPath, setDirPath] = useState(MOCK_DIR);
  const [inputValue, setInputValue] = useState(MOCK_DIR);
  const [images, setImages] = useState([]);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [imageInfo, setImageInfo] = useState(null);
  const mountedRef = useRef(true);
  const native = backend.isNative();

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadImages(dirPath);
  }, [dirPath]);

  useEffect(() => {
    if (lightboxIndex < 0) return;
    function handleKey(e) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') navigateLightbox(-1);
      else if (e.key === 'ArrowRight') navigateLightbox(1);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, images.length]);

  async function loadImages(path) {
    if (!path.trim()) return;
    setPending('Loading...');
    setError('');
    setMessage('');
    setImageInfo(null);
    try {
      if (native) {
        const result = await backend.listDirectory(path.trim(), {
          extensions: IMAGE_EXTENSIONS
        });
        if (!mountedRef.current) return;
        const files = (result.entries || []).filter((e) => !e.isDir);
        setImages(files);
        setMessage(
          `${files.length} image${files.length !== 1 ? 's' : ''}${result.truncated ? ' (truncated)' : ''}`
        );
      } else {
        await new Promise((r) => setTimeout(r, 150));
        if (!mountedRef.current) return;
        setImages(MOCK_IMAGES);
        setMessage(`${MOCK_IMAGES.length} images (mock)`);
      }
    } catch (failure) {
      if (mountedRef.current) setError(backendError(failure));
    } finally {
      if (mountedRef.current) setPending('');
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed && trimmed !== dirPath) setDirPath(trimmed);
  }

  function openLightbox(index) {
    setLightboxIndex(index);
    setImageInfo(null);
    loadImageInfo(images[index]);
  }

  function closeLightbox() {
    setLightboxIndex(-1);
    setImageInfo(null);
  }

  function navigateLightbox(delta) {
    const next = lightboxIndex + delta;
    if (next >= 0 && next < images.length) {
      setLightboxIndex(next);
      setImageInfo(null);
      loadImageInfo(images[next]);
    }
  }

  async function loadImageInfo(entry) {
    if (!entry || !native) return;
    try {
      const filePath = entry.path || `${dirPath}/${entry.name}`;
      const info = await backend.inspectMedia(filePath);
      if (mountedRef.current) setImageInfo(info);
    } catch {
      // Lightbox stays usable without info.
    }
  }

  const currentImage = lightboxIndex >= 0 ? images[lightboxIndex] : null;

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Local images</p>
          <h1 className={sx('pageTitle')}>Image Gallery</h1>
          <p className={sx('lede')}>
            Browse a directory and view images in a lightbox.
          </p>
        </div>
        <span className={sx('mock-badge')}>{native ? 'Native' : 'Mock'}</span>
      </div>

      <AsyncFeedback pending={pending} error={error} message={message} />

      <div className={sx('tool-panel')}>
        <div className={sx('panel-heading')}>
          <div>
            <span className={sx('panel-label')}>Directory</span>
            <h2 className={sx('panel-title')}>Image folder</h2>
          </div>
          <span className={sx('panel-status')}>
            {images.length > 0 ? `${images.length} images` : '—'}
          </span>
        </div>
        <form onSubmit={handleSubmit} className={sx('media-actions')}>
          <input
            className={sx('media-path-input')}
            value={inputValue}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            placeholder="/home/user/Pictures"
            disabled={Boolean(pending)}
          />
          <button
            type="submit"
            className={sx('primary')}
            disabled={Boolean(pending) || !inputValue.trim()}
          >
            Load
          </button>
          <button
            type="button"
            className={sx('text-button')}
            onClick={() => loadImages(dirPath)}
            disabled={Boolean(pending) || !dirPath.trim()}
          >
            Refresh
          </button>
        </form>
      </div>

      {images.length === 0 && !pending && (
        <p className={sx('empty-notes')}>No images found in this directory.</p>
      )}

      {images.length > 0 && (
        <div className={sx('gallery-grid')}>
          {images.map((entry, index) => (
            <button
              key={entry.name}
              type="button"
              className={sx('gallery-thumb')}
              onClick={() => openLightbox(index)}
              title={entry.name}
            >
              <div
                className={sx('gallery-thumb-img')}
                style={`background: linear-gradient(135deg, var(--wb-surface-alt, #f0f0f0) 0%, var(--wb-surface, #fff) 100%); display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: var(--wb-text-secondary, #888);`}
              >
                {entry.name.split('.').pop().toUpperCase()}
              </div>
              <span className={sx('gallery-thumb-label')}>{entry.name}</span>
            </button>
          ))}
        </div>
      )}

      {lightboxIndex >= 0 && currentImage && (
        <div
          className={sx('lightbox-overlay')}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLightbox();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeLightbox();
          }}
          role="dialog"
          aria-label="Image lightbox"
        >
          <div className={sx('lightbox-toolbar')}>
            <div className={sx('lightbox-toolbar-left')}>
              <strong>{currentImage.name}</strong>
              <span className={sx('lightbox-counter')}>
                {lightboxIndex + 1} / {images.length}
              </span>
            </div>
            <div className={sx('lightbox-toolbar-right')}>
              <span className={sx('lightbox-counter')}>
                {formatBytes(currentImage.size)}
              </span>
              <button
                type="button"
                className={sx('lightbox-close')}
                onClick={closeLightbox}
              >
                Close (Esc)
              </button>
            </div>
          </div>

          <div className={sx('lightbox-body')}>
            {lightboxIndex > 0 && (
              <button
                type="button"
                className={sx('lightbox-nav', 'lightbox-nav-prev')}
                onClick={() => navigateLightbox(-1)}
                aria-label="Previous image"
              >
                ←
              </button>
            )}

            <div
              className={sx('lightbox-image')}
              style={`background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); min-width: 300px; min-height: 200px; display: flex; align-items: center; justify-content: center; border-radius: 4px;`}
            >
              <div style="text-align: center; color: rgba(255,255,255,0.6);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">
                  {currentImage.name.split('.').pop().toUpperCase()}
                </div>
                <div style="font-size: 0.8rem;">{currentImage.name}</div>
                {imageInfo?.width && imageInfo.height && (
                  <div style="font-size: 0.7rem; margin-top: 0.25rem; opacity: 0.5;">
                    {imageInfo.width} x {imageInfo.height}
                  </div>
                )}
              </div>
            </div>

            {lightboxIndex < images.length - 1 && (
              <button
                type="button"
                className={sx('lightbox-nav', 'lightbox-nav-next')}
                onClick={() => navigateLightbox(1)}
                aria-label="Next image"
              >
                →
              </button>
            )}
          </div>

          {imageInfo && (
            <div className={sx('lightbox-info')}>
              <span>Kind: {imageInfo.kind}</span>
              <span>MIME: {imageInfo.mime}</span>
              {imageInfo.width && imageInfo.height && (
                <span>
                  Dimensions: {imageInfo.width} x {imageInfo.height}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
