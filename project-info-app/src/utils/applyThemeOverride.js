/**
 * applyThemeOverride.js
 * 
 * This utility enforces theme variables across all dynamically loaded components
 * by applying theme classes to elements that may not be properly using theme variables.
 */

// Force theme variables on elements that might not be using them
export const applyThemeOverride = () => {
  const currentTheme = document.body.getAttribute('data-theme') || 'light';
  
  // Apply theme to all major containers
  document.querySelectorAll('.container, .card, .section, .panel, .dialog, .modal, .dropdown').forEach(element => {
    // Add theme-aware class to help with targeting in CSS
    element.classList.add('theme-aware');
    // Ensure the element has the current theme attribute
    element.setAttribute('data-theme', currentTheme);
  });
  
  // Apply theme to all form elements
  document.querySelectorAll('input, select, textarea, button').forEach(element => {
    element.classList.add('theme-input');
  });
  
  // Apply theme to all cards
  document.querySelectorAll('.card, .box, .panel').forEach(element => {
    element.classList.add('theme-card');
  });
  
  // Apply theme to all tables
  document.querySelectorAll('table').forEach(element => {
    element.classList.add('theme-table');
    element.setAttribute('data-theme', currentTheme);
  });
  
  // Apply theme to all buttons
  document.querySelectorAll('button:not(.theme-button-primary):not(.theme-button-secondary)').forEach(button => {
    if (button.classList.contains('primary') || 
        button.classList.contains('btn-primary') || 
        button.className.includes('primary')) {
      button.classList.add('theme-button-primary');
    } else {
      button.classList.add('theme-button-secondary');
    }
  });
  
  // Apply theme to scrollable elements
  document.querySelectorAll('div[style*="overflow"], [style*="overflow-y"], [style*="overflow-x"]').forEach(element => {
    element.classList.add('theme-scrollbar');
  });

  // Fix any SVG elements that might not be using theme colors
  document.querySelectorAll('svg path[fill="#000000"], svg path[fill="#000"], svg path[fill="black"]').forEach(path => {
    path.setAttribute('fill', 'var(--text-primary)');
  });
  
  document.querySelectorAll('svg path[fill="#ffffff"], svg path[fill="#fff"], svg path[fill="white"]').forEach(path => {
    path.setAttribute('fill', 'var(--bg-primary)');
  });
};

// Function to register the theme override to run after DOM changes
export const registerThemeOverride = () => {
  // Apply once immediately
  applyThemeOverride();
  
  // Setup observer to detect DOM changes
  const observer = new MutationObserver((mutations) => {
    let shouldApply = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        shouldApply = true;
        break;
      }
    }
    
    if (shouldApply) {
      applyThemeOverride();
    }
  });
  
  // Start observing DOM changes
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // Also run on theme toggle
  document.addEventListener('themeChanged', applyThemeOverride);
  
  return () => {
    observer.disconnect();
    document.removeEventListener('themeChanged', applyThemeOverride);
  };
};

export default registerThemeOverride;
