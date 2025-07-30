// Popup functionality for YouTube Comment TTS Extension

document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on a YouTube page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const isYouTube = currentTab.url.includes('youtube.com');
    
    const statusElement = document.querySelector('.status span');
    const statusDot = document.querySelector('.status-dot');
    
    if (isYouTube) {
      statusElement.textContent = 'Ready on YouTube';
      statusDot.style.background = '#4CAF50';
    } else {
      statusElement.textContent = 'Visit YouTube to use';
      statusDot.style.background = '#ff9800';
    }
  });

  // Add click handlers for footer links
  const links = document.querySelectorAll('.link');
  links.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      if (this.textContent === 'Report Issues') {
        // Open GitHub issues or contact form
        chrome.tabs.create({
          url: 'https://github.com/yourusername/youtube-comment-tts/issues'
        });
      } else if (this.textContent === 'Rate Extension') {
        // Open Chrome Web Store page
        chrome.tabs.create({
          url: 'https://chrome.google.com/webstore/detail/youtube-comment-tts/your-extension-id'
        });
      }
    });
  });
});