import React, { createContext, useState, useContext, useEffect } from 'react';

// Create a context for theme management
const ThemeContext = createContext();

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

// Theme provider component
export const ThemeProvider = ({ children }) => {
  // Check if dark mode is stored in localStorage or if user prefers dark mode
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      return savedTheme;
    }
    
    // Check for user's system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [theme, setTheme] = useState(getInitialTheme);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      return newTheme;
    });
  };

  // Update localStorage and document body class when theme changes
  useEffect(() => {
    // Store theme preference
    localStorage.setItem('theme', theme);
    
    // Apply transition class first for smooth transition
    document.body.classList.add('theme-transition');
    
    // Set the theme
    document.body.setAttribute('data-theme', theme);
    
    // Remove transition class after the transition is complete
    const transitionTimeout = setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 500); // Match this to your transition duration
    
    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      clearTimeout(transitionTimeout);
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  // Provide theme state and functions to children
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
