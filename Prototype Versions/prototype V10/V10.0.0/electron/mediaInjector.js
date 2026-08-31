/**
 * mediaInjector.js
 * Injected scripts for Picture-in-Picture, Distraction-free Reader Mode,
 * and Media HUD state synchronization.
 */

const PIP_INJECTOR_SCRIPT = `
(async function() {
  try {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return { success: false, error: 'No video element found on this page' };
    const targetVideo = videos.find(v => !v.paused) || videos.sort((a,b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight))[0];
    if (!targetVideo) return { success: false, error: 'No suitable video found' };

    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return { success: true, pip: false, message: 'Exited Picture-in-Picture' };
    } else {
      await targetVideo.requestPictureInPicture();
      return { success: true, pip: true, message: 'Floating video active 📺' };
    }
  } catch(e) {
    return { success: false, error: e.message };
  }
})()
`

const READER_MODE_EXTRACTOR_SCRIPT = `
(function() {
  try {
    const title = (document.querySelector('meta[property="og:title"]')?.content ||
                   document.querySelector('h1')?.innerText ||
                   document.title || 'Untitled Article').trim();

    const byline = (document.querySelector('meta[name="author"]')?.content ||
                    document.querySelector('meta[property="article:author"]')?.content ||
                    document.querySelector('[rel="author"]')?.innerText ||
                    document.querySelector('.author, .byline, .by-author, .article-author, [itemprop="author"]')?.innerText || '').trim();

    const siteName = (document.querySelector('meta[property="og:site_name"]')?.content ||
                      window.location.hostname.replace(/^www\\./, '')).trim();

    const leadImg = document.querySelector('meta[property="og:image"]')?.content ||
                    document.querySelector('article img, main img, .post-content img, .article-body img, [itemprop="image"]')?.src || '';

    // Junk removal helper
    const stripJunk = (rootEl) => {
      const junkSelectors = [
        'script', 'style', 'noscript', 'nav', 'header', 'footer',
        'aside', '.ad', '.ads', '.advertisement', '.social-share',
        '.share-buttons', '.comments', '#comments', '.sidebar',
        '.cookie-banner', '.cookie-notice', '.newsletter-signup', 'iframe', 'button:not(.action-btn)', 'form',
        '.related-articles', '.recommended', '.nav-links', '#cookie-notice', '.banner-ad',
        '.vector-header', '.vector-page-toolbar', '.vector-column-end', '#mw-navigation', '#mw-head', '#mw-panel',
        '.mw-editsection', '.noprint', '.mw-jump-link', '.navbox', '.sitelist', '.vector-menu'
      ];
      junkSelectors.forEach(sel => {
        try {
          rootEl.querySelectorAll(sel).forEach(el => el.remove());
        } catch(e) {}
      });
      // Convert relative image URLs to absolute
      rootEl.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('src');
        if (src) {
          try {
            img.src = new URL(src, window.location.href).href;
          } catch(e) {}
        }
      });
      // Ensure links open safely
      rootEl.querySelectorAll('a').forEach(a => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
    };

    // Comprehensive article container candidate scoring
    let targetContainers = Array.from(document.querySelectorAll('.mw-parser-output, #mw-content-text, #bodyContent, article, [itemprop="articleBody"], main, .article-content, .post-content, .entry-content, .story-body, .article-body, #article-body, .content-body, #content, #main-content, .main-content, .wiki-content, .documentation, .markdown-body, .prose'));

    let bestContainer = null;
    let maxParagraphCount = 0;

    for (const c of targetContainers) {
      const pCount = c.querySelectorAll('p, h2, h3, pre, blockquote').length;
      if (pCount > maxParagraphCount) {
        maxParagraphCount = pCount;
        bestContainer = c;
      }
    }

    if (!bestContainer || maxParagraphCount < 3) {
      bestContainer = document.body;
    }

    // 1. Clean Article Extraction (Full Content Aggregation)
    const articleClone = bestContainer.cloneNode(true);
    stripJunk(articleClone);

    const nodes = Array.from(articleClone.querySelectorAll('h1, h2, h3, h4, h5, h6, p, blockquote, pre, ul, ol, table, figure, div.highlight, div.code-block, section, hr, img'));
    let cleanHtml = '';
    let textOnly = '';

    if (nodes.length > 0) {
      nodes.forEach(node => {
        const tag = node.tagName.toLowerCase();
        const inner = node.innerHTML ? node.innerHTML.trim() : '';
        if (!inner && tag !== 'img' && tag !== 'hr') return;

        if (tag === 'figure') {
          cleanHtml += '<figure style="margin: 24px 0; text-align: center;">' + node.innerHTML + '</figure>';
        } else if (tag === 'img') {
          const src = node.getAttribute('data-src') || node.getAttribute('data-original') || node.src;
          if (src) {
            cleanHtml += '<div style="text-align: center; margin: 24px 0;"><img src="' + src + '" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" alt="" /></div>';
          }
        } else if (tag === 'table') {
          cleanHtml += '<div class="reader-table-wrap" style="overflow-x: auto; margin: 20px 0;"><table style="width: 100%; border-collapse: collapse; margin: 12px 0;">' + node.innerHTML + '</table></div>';
        } else if (['ul', 'ol', 'blockquote', 'pre'].includes(tag)) {
          cleanHtml += '<' + tag + ' style="margin: 16px 0; line-height: 1.6;">' + node.innerHTML + '</' + tag + '>';
          textOnly += (node.innerText || '') + ' ';
        } else if (tag.startsWith('h')) {
          cleanHtml += '<' + tag + ' style="margin-top: 32px; margin-bottom: 12px; font-weight: 700;">' + node.innerHTML + '</' + tag + '>';
          textOnly += (node.innerText || '') + ' ';
        } else if (tag === 'p') {
          cleanHtml += '<p style="margin-bottom: 18px; line-height: 1.8;">' + node.innerHTML + '</p>';
          textOnly += (node.innerText || '') + ' ';
        } else if (tag === 'hr') {
          cleanHtml += '<hr style="margin: 32px 0; border: none; border-top: 1px solid rgba(255,255,255,0.1);" />';
        }
      });
    }

    if (!cleanHtml || textOnly.length < 80) {
      cleanHtml = articleClone.innerHTML;
      textOnly = articleClone.innerText || '';
    }

    // 2. Full Webpage Extraction
    const fullClone = document.body.cloneNode(true);
    stripJunk(fullClone);
    const fullPageHtml = fullClone.innerHTML;

    const wordCount = textOnly.split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    return {
      success: true,
      title,
      byline,
      siteName,
      leadImg,
      cleanHtml,
      fullPageHtml,
      wordCount,
      readingTimeMinutes,
      url: window.location.href,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
})()
`

const MEDIA_HUD_CONTROL_SCRIPT = (command, value) => `
(function() {
  try {
    const mediaList = Array.from(document.querySelectorAll('video, audio'));
    if (mediaList.length === 0) return { success: false, error: 'No media found' };
    const primary = mediaList.find(m => !m.paused) || mediaList[0];

    switch ('${command}') {
      case 'play-pause':
        if (primary.paused) primary.play();
        else primary.pause();
        return { success: true, paused: primary.paused, isPlaying: !primary.paused };
      
      case 'skip-forward':
        primary.currentTime = Math.min(primary.duration || Infinity, primary.currentTime + 10);
        return { success: true, currentTime: primary.currentTime, duration: primary.duration };

      case 'skip-backward':
        primary.currentTime = Math.max(0, primary.currentTime - 10);
        return { success: true, currentTime: primary.currentTime, duration: primary.duration };

      case 'seek':
        if (typeof ${value} === 'number') {
          primary.currentTime = ${value};
        }
        return { success: true, currentTime: primary.currentTime };

      case 'volume':
        if (typeof ${value} === 'number') {
          primary.volume = Math.max(0, Math.min(1, ${value}));
          if (primary.volume > 0) primary.muted = false;
        }
        return { success: true, volume: primary.volume, muted: primary.muted };

      case 'rate':
        if (typeof ${value} === 'number') {
          primary.playbackRate = ${value};
        }
        return { success: true, playbackRate: primary.playbackRate };

      case 'mute-toggle':
        primary.muted = !primary.muted;
        return { success: true, muted: primary.muted };

      case 'get-state':
        return {
          success: true,
          hasMedia: true,
          paused: primary.paused,
          isPlaying: !primary.paused,
          currentTime: primary.currentTime || 0,
          duration: primary.duration || 0,
          volume: primary.volume || 1,
          muted: !!primary.muted,
          playbackRate: primary.playbackRate || 1,
          videoTitle: document.title,
        };

      default:
        return { success: true };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
})()
`

module.exports = {
  PIP_INJECTOR_SCRIPT,
  READER_MODE_EXTRACTOR_SCRIPT,
  MEDIA_HUD_CONTROL_SCRIPT,
}
