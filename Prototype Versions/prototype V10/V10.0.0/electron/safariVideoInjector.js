/**
 * safariVideoInjector.js (NeXus Media Engine)
 * Robust Video Controller for YouTube, Vimeo, HTML5 Video embeds
 * Fixes Theater mode, Picture-in-Picture, Fullscreen, and Playback controls.
 */

const SAFARI_VIDEO_CONTROL_SCRIPT = (command, payloadJson = '{}') => `
(function() {
  try {
    const payload = JSON.parse(${JSON.stringify(payloadJson)});
    const videos = Array.from(document.querySelectorAll('video'));

    let targetVideo = videos.find(v => !v.paused && v.currentTime > 0) ||
                      videos.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight))[0] ||
                      videos[0];

    // If no video tag found, try checking iframe or YouTube player
    if (!targetVideo) {
      if (command === 'get-state') {
        return { success: true, hasVideo: false, paused: true, isPlaying: false, currentTime: 0, duration: 0, title: document.title || '' };
      }
      return { success: false, error: 'No video element found on this page' };
    }

    switch ('${command}') {
      case 'play': {
        targetVideo.play();
        return { success: true, paused: false, isPlaying: true };
      }

      case 'pause': {
        targetVideo.pause();
        return { success: true, paused: true, isPlaying: false };
      }

      case 'play-pause': {
        if (targetVideo.paused) {
          targetVideo.play();
        } else {
          targetVideo.pause();
        }
        return { success: true, paused: targetVideo.paused, isPlaying: !targetVideo.paused };
      }

      case 'skip': {
        const delta = typeof payload.delta === 'number' ? payload.delta : 10;
        const newTime = Math.max(0, Math.min(targetVideo.duration || Infinity, targetVideo.currentTime + delta));
        targetVideo.currentTime = newTime;
        return { success: true, currentTime: targetVideo.currentTime, duration: targetVideo.duration };
      }

      case 'seek': {
        if (typeof payload.time === 'number') {
          targetVideo.currentTime = Math.max(0, Math.min(targetVideo.duration || Infinity, payload.time));
        }
        return { success: true, currentTime: targetVideo.currentTime };
      }

      case 'volume': {
        if (typeof payload.volume === 'number') {
          targetVideo.volume = Math.max(0, Math.min(1, payload.volume));
          if (targetVideo.volume > 0) targetVideo.muted = false;
        }
        return { success: true, volume: targetVideo.volume, muted: targetVideo.muted };
      }

      case 'mute-toggle': {
        targetVideo.muted = !targetVideo.muted;
        return { success: true, muted: targetVideo.muted };
      }

      case 'rate': {
        if (typeof payload.rate === 'number') {
          targetVideo.playbackRate = payload.rate;
        }
        return { success: true, playbackRate: targetVideo.playbackRate };
      }

      case 'pip': {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
          return { success: true, pip: false };
        }
        const ytPip = document.querySelector('.ytp-miniplayer-button, .ytp-pip-button');
        if (ytPip) {
          ytPip.click();
          return { success: true, pip: true };
        }
        if (targetVideo.requestPictureInPicture) {
          try {
            targetVideo.requestPictureInPicture();
            return { success: true, pip: true };
          } catch(e) {
            return { success: false, error: e.message };
          }
        }
        return { success: false, error: 'PiP not supported' };
      }

      case 'fullscreen': {
        if (document.fullscreenElement) {
          document.exitFullscreen();
          return { success: true, fullscreen: false };
        }
        const ytFs = document.querySelector('.ytp-fullscreen-button, button[aria-label*="Full screen"], button[title*="Full screen"]');
        if (ytFs) {
          ytFs.click();
          return { success: true, fullscreen: true };
        }
        const player = targetVideo.closest('.video-container, .player, [class*="player"]') || targetVideo;
        if (player.requestFullscreen) {
          player.requestFullscreen();
        } else if (targetVideo.requestFullscreen) {
          targetVideo.requestFullscreen();
        } else if (targetVideo.webkitRequestFullscreen) {
          targetVideo.webkitRequestFullscreen();
        }
        return { success: true, fullscreen: true };
      }

      case 'theater': {
        // 1. YouTube Native Theater Mode Toggle
        const ytTheater = document.querySelector('.ytp-size-button, button[data-title-no-tooltip*="Theater"], button[aria-label*="Theater"], button[title*="Theater"]');
        if (ytTheater) {
          ytTheater.click();
          const isTheater = document.querySelector('ytd-watch-flexy[theater]') !== null || ytTheater.getAttribute('data-title-no-tooltip') === 'Default view';
          return { success: true, theater: isTheater };
        }

        // 2. Generic HTML5 Video Ambient Theater Mode (Non-destructive, zero blackscreen)
        let existing = document.getElementById('__nexus_ambient_theater');
        if (existing) {
          existing.remove();
          return { success: true, theater: false };
        } else {
          const backdrop = document.createElement('div');
          backdrop.id = '__nexus_ambient_theater';
          backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.88); z-index: 999990; pointer-events: none; transition: opacity 0.3s ease;';
          const player = targetVideo.closest('.video-container, .player, [class*="player"]') || targetVideo.parentElement || targetVideo;
          if (player && player !== document.body) {
            player.style.position = 'relative';
            player.style.zIndex = '999995';
          }
          targetVideo.style.position = 'relative';
          targetVideo.style.zIndex = '999996';
          document.body.appendChild(backdrop);
          return { success: true, theater: true };
        }
      }

      case 'snapshot': {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetVideo.videoWidth || targetVideo.clientWidth || 1280;
          canvas.height = targetVideo.videoHeight || targetVideo.clientHeight || 720;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(targetVideo, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          return {
            success: true,
            dataUrl: dataUrl,
            width: canvas.width,
            height: canvas.height,
            videoTitle: document.title || 'Video Snapshot'
          };
        } catch(err) {
          return { success: false, error: 'Snapshot failed: ' + err.message };
        }
      }

      case 'get-state': {
        let bufferedEnd = 0;
        if (targetVideo.buffered && targetVideo.buffered.length > 0) {
          bufferedEnd = targetVideo.buffered.end(targetVideo.buffered.length - 1);
        }
        return {
          success: true,
          hasVideo: true,
          paused: targetVideo.paused,
          isPlaying: !targetVideo.paused,
          currentTime: targetVideo.currentTime || 0,
          duration: targetVideo.duration || 0,
          volume: targetVideo.volume || 1,
          muted: !!targetVideo.muted,
          playbackRate: targetVideo.playbackRate || 1,
          bufferedEnd: bufferedEnd,
          videoWidth: targetVideo.videoWidth || 0,
          videoHeight: targetVideo.videoHeight || 0,
          title: (document.title || 'Video Stream').replace(/ - YouTube$/, '').trim(),
          isPip: document.pictureInPictureElement === targetVideo,
          isFullscreen: !!document.fullscreenElement,
        };
      }

      default:
        return { success: true };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
})()
`;

module.exports = {
  SAFARI_VIDEO_CONTROL_SCRIPT,
  SAFARI_IN_PAGE_VIDEO_PLAYER_SCRIPT: '',
};
