// YouTube Comment TTS Extension
class YouTubeTTS {
  constructor() {
    this.isInitialized = false;
    this.currentUtterance = null;
    this.observedComments = new Set();
    this.init();
  }

  init() {
    if (this.isInitialized) return;
    
    // Wait for page to load and check if we're on a video page
    this.waitForYouTube(() => {
      this.setupCommentObserver();
      this.isInitialized = true;
    });
  }

  waitForYouTube(callback) {
    const checkForComments = () => {
      // Check if we're on a video page and comments section exists
      if (window.location.pathname === '/watch' && document.querySelector('#comments')) {
        callback();
      } else {
        setTimeout(checkForComments, 1000);
      }
    };
    checkForComments();
  }

  setupCommentObserver() {
    // Observer for new comments being loaded (YouTube uses dynamic loading)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processCommentsInNode(node);
            }
          });
        }
      });
    });

    // Start observing the comments section
    const commentsSection = document.querySelector('#comments');
    if (commentsSection) {
      observer.observe(commentsSection, {
        childList: true,
        subtree: true
      });
      
      // Process existing comments
      this.processCommentsInNode(commentsSection);
    }

    // Handle YouTube navigation (single page app)
    this.handleNavigation();
  }

  processCommentsInNode(node) {
    // Find all comment content elements
    const comments = node.querySelectorAll('#content-text');
    
    comments.forEach((comment) => {
      if (!this.observedComments.has(comment)) {
        this.addTTSButton(comment);
        this.observedComments.add(comment);
      }
    });
  }

  addTTSButton(commentElement) {
    // Check if button already exists
    if (commentElement.querySelector('.tts-button')) return;

    // Create TTS button
    const button = document.createElement('button');
    button.className = 'tts-button';
    button.innerHTML = '🔊';
    button.title = 'Read comment aloud';
    
    // Add click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleTTS(button, commentElement);
    });

    // Find the best place to insert the button (next to like/dislike buttons)
    const toolbar = commentElement.closest('ytd-comment-view-model')?.querySelector('#toolbar');
    if (toolbar) {
      toolbar.appendChild(button);
    } else {
      // Fallback: add after the comment text
      commentElement.parentNode.insertBefore(button, commentElement.nextSibling);
    }
  }

  toggleTTS(button, commentElement) {
    // Stop current speech if playing
    if (this.currentUtterance) {
      speechSynthesis.cancel();
      this.resetAllButtons();
      
      // If clicking the same button, just stop
      if (button.classList.contains('tts-playing')) {
        return;
      }
    }

    // Get comment text
    const commentText = this.extractCommentText(commentElement);
    if (!commentText) return;

    // Create speech utterance
    this.currentUtterance = new SpeechSynthesisUtterance(commentText);
    
    // Configure speech settings
    this.currentUtterance.rate = 1.0;
    this.currentUtterance.pitch = 1.0;
    this.currentUtterance.volume = 1.0;

    // Set up event listeners
    this.currentUtterance.onstart = () => {
      button.innerHTML = '⏸️';
      button.classList.add('tts-playing');
      button.title = 'Stop reading';
    };

    this.currentUtterance.onend = () => {
      this.resetAllButtons();
      this.currentUtterance = null;
    };

    this.currentUtterance.onerror = () => {
      this.resetAllButtons();
      this.currentUtterance = null;
      console.error('TTS Error occurred');
    };

    // Speak the comment
    speechSynthesis.speak(this.currentUtterance);
  }

  extractCommentText(commentElement) {
    // Extract text content, handling YouTube's complex comment structure
    let text = '';
    
    // Get all text nodes, excluding reply indicators and timestamps
    const walker = document.createTreeWalker(
      commentElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip empty text nodes and whitespace-only nodes
          if (!node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      text += node.textContent + ' ';
    }

    return text.trim();
  }

  resetAllButtons() {
    document.querySelectorAll('.tts-button').forEach(btn => {
      btn.innerHTML = '🔊';
      btn.classList.remove('tts-playing');
      btn.title = 'Read comment aloud';
    });
  }

  handleNavigation() {
    // Handle YouTube's single-page navigation
    let currentUrl = window.location.href;
    
    const checkUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        
        // Stop any current speech
        if (this.currentUtterance) {
          speechSynthesis.cancel();
          this.currentUtterance = null;
        }
        
        // Reset observed comments
        this.observedComments.clear();
        
        // Reinitialize if we're still on a video page
        if (window.location.pathname === '/watch') {
          setTimeout(() => {
            this.setupCommentObserver();
          }, 2000); // Wait for new page to load
        }
      }
    };

    // Check for URL changes every second
    setInterval(checkUrlChange, 1000);
  }
}

// Initialize the extension when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeTTS();
  });
} else {
  new YouTubeTTS();
}