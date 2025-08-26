// YouTube Comment TTS Extension
class YouTubeTTS {
  constructor() {
    this.isInitialized = false;
    this.currentUtterance = null;
    this.observedComments = new Set();
    this.textNodesMap = []; // Store text nodes and their offsets
    this.currentHighlightSpan = null; // Track current highlight
    this.init();
  }

  init() {
    if (this.isInitialized) return;
    
    // Check if SpeechSynthesis is supported
    if (!window.speechSynthesis) {
      console.warn('Text-to-Speech not supported in this browser');
      return;
    }

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
    // If this button is currently playing, stop it
    if (button.classList.contains('tts-playing')) {
      speechSynthesis.cancel();
      this.resetAllButtons();
      this.clearHighlight();
      this.currentUtterance = null;
      return;
    }
    
    // Stop any other currently playing speech
    if (this.currentUtterance) {
      speechSynthesis.cancel();
      this.resetAllButtons();
      this.clearHighlight();
      this.currentUtterance = null;
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

    // Map text nodes for highlighting
    this.buildTextNodesMap(commentElement);

    // Set up event listeners
    this.currentUtterance.onstart = () => {
      button.innerHTML = '⏸️';
      button.classList.add('tts-playing');
      button.title = 'Stop reading';
    };

    this.currentUtterance.onend = () => {
      this.resetAllButtons();
      this.clearHighlight();
      this.currentUtterance = null;
      this.textNodesMap = [];
    };

    this.currentUtterance.onerror = () => {
      this.resetAllButtons();
      this.clearHighlight();
      this.currentUtterance = null;
      this.textNodesMap = [];
      console.error('TTS Error occurred');
    };

    // Highlight words during speech
    if ('onboundary' in this.currentUtterance) {
      this.currentUtterance.onboundary = (event) => {
        if (event.name === 'word') {
          this.highlightWord(event.charIndex, event.charLength, commentElement);
        }
      };
    } else {
      console.warn('Word boundary detection not supported in this browser');
    }

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

  buildTextNodesMap(commentElement) {
    // Build a map of text nodes and their character offsets
    this.textNodesMap = [];
    let offset = 0;

    const walker = document.createTreeWalker(
      commentElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (!node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent;
      this.textNodesMap.push({ node, start: offset, end: offset + text.length });
      offset += text.length + 1; // Account for space
    }
  }

  highlightWord(charIndex, charLength, commentElement) {
    // Clear previous highlight
    this.clearHighlight();

    // Find the text node containing the current word
    let targetNode = null;
    let nodeOffset = 0;

    for (const entry of this.textNodesMap) {
      if (charIndex >= entry.start && charIndex < entry.end) {
        targetNode = entry.node;
        nodeOffset = charIndex - entry.start;
        break;
      }
    }

    if (!targetNode) return;

    // Split the text node and wrap the word in a span
    const text = targetNode.textContent;
    const before = text.substring(0, nodeOffset);
    const word = text.substring(nodeOffset, nodeOffset + charLength);
    const after = text.substring(nodeOffset + charLength);

    const parent = targetNode.parentNode;
    const span = document.createElement('span');
    span.className = 'tts-highlight';
    span.textContent = word;

    // Replace the text node with before + span + after
    const beforeNode = document.createTextNode(before);
    const afterNode = document.createTextNode(after);
    parent.insertBefore(beforeNode, targetNode);
    parent.insertBefore(span, targetNode);
    parent.insertBefore(afterNode, targetNode);
    parent.removeChild(targetNode);

    // Update textNodesMap to reflect new structure
    this.textNodesMap = [];
    this.buildTextNodesMap(commentElement);

    this.currentHighlightSpan = span;
  }

  clearHighlight() {
    // Remove existing highlight and restore original text
    if (this.currentHighlightSpan) {
      const parent = this.currentHighlightSpan.parentNode;
      const text = this.currentHighlightSpan.textContent;
      const textNode = document.createTextNode(text);
      parent.replaceChild(textNode, this.currentHighlightSpan);
      this.currentHighlightSpan = null;

      // Normalize to merge adjacent text nodes
      parent.normalize();

      // Rebuild textNodesMap to ensure consistency
      const commentElement = parent.closest('#content-text');
      if (commentElement) {
        this.buildTextNodesMap(commentElement);
      }
    }
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
          this.resetAllButtons();
          this.clearHighlight();
          this.currentUtterance = null;
        }
        
        // Reset observed comments
        this.observedComments.clear();
        this.textNodesMap = [];
        
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