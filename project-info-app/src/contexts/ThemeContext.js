import React, { createContext, useState, useContext, useEffect } from 'react';

// Create a context for theme management
const ThemeContext = createContext();

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

// Theme provider component
export const ThemeProvider = ({ children }) => {
  // Check if dark mode is stored in localStorage or if user prefers dark mode
  const getInitialTheme = () => {
    // First try to get from localStorage
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      return savedTheme;
    }
    
    // Check for user's system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [theme, setTheme] = useState(getInitialTheme);
  const [themeReady, setThemeReady] = useState(false);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      return newTheme;
    });
  };

  // Apply theme to specific elements that might be inside iframes or shadow DOM
  const applyThemeToSpecialElements = (themeName) => {
    // Apply to any iframes if they exist
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        if (iframe.contentDocument) {
          iframe.contentDocument.body.setAttribute('data-theme', themeName);
          iframe.contentDocument.body.classList.add('theme-transition');
        }
      } catch (e) {
        // Silent catch for cross-origin iframes
      }
    });

    // Apply to any components with theme class
    const themeableComponents = document.querySelectorAll('.themeable');
    themeableComponents.forEach(component => {
      component.setAttribute('data-theme', themeName);
    });

    // Apply to any custom elements with shadow DOM
    const customElements = document.querySelectorAll('[data-uses-shadow-dom]');
    customElements.forEach(element => {
      try {
        if (element.shadowRoot) {
          const root = element.shadowRoot;
          // Add a style element to the shadow root if not already present
          if (!root.querySelector('#theme-vars')) {
            const style = document.createElement('style');
            style.id = 'theme-vars';
            root.appendChild(style);
          }
          // Update the style with the current theme
          const styleEl = root.querySelector('#theme-vars');
          styleEl.textContent = `:host { --current-theme: ${themeName}; }`;
        }
      } catch (e) {
        console.error('Error applying theme to shadow DOM:', e);
      }
    });
  };

  // Update localStorage and document body class when theme changes
  useEffect(() => {
    // Store theme preference
    localStorage.setItem('theme', theme);
    
    // Apply transition class first for smooth transition
    document.body.classList.add('theme-transition');
    document.documentElement.classList.add('theme-transition');
    
    // Set the theme on both body and root element for maximum compatibility
    document.body.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    
    // Apply theme to special elements
    applyThemeToSpecialElements(theme);
    
    // Remove transition class after the transition is complete
    const transitionTimeout = setTimeout(() => {
      document.body.classList.remove('theme-transition');
      document.documentElement.classList.remove('theme-transition');
      // Mark theme as ready for components that wait for theme application
      setThemeReady(true);
    }, 500); // Match this to your transition duration
    
    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    
    // Use the appropriate event listener method based on browser support
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      // For older browsers
      mediaQuery.addListener(handleChange);
    }
    
    // Setup a MutationObserver to detect and theme dynamically added content
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          applyThemeToSpecialElements(theme);
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => {
      clearTimeout(transitionTimeout);
      // Clean up event listeners
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.removeListener) {
        // For older browsers
        mediaQuery.removeListener(handleChange);
      }
      observer.disconnect();
    };
  }, [theme]);

  // Provide theme state and functions to children
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeReady }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ThemeConsumer component for components that need theme awareness
export const ThemeConsumer = ({ children }) => {
  const { theme } = useTheme();
  return React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { 'data-theme': theme, className: `${child.props.className || ''} theme-aware` });
    }
    return child;
  });
};

// Higher-order component for theme awareness
export const withTheme = (Component) => {
  return (props) => {
    const { theme } = useTheme();
    return <Component {...props} theme={theme} />;
  };
};

export default ThemeProvider;
