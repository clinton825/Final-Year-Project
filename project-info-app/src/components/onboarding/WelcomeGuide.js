import React, { useState, useEffect } from 'react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import './WelcomeGuide.css';

const WelcomeGuide = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [exiting, setExiting] = useState(false);
  const { completeWelcomeGuide, setShowWelcomeGuide } = useOnboarding();

  // Define the slides content for the welcome guide
  const slides = [
    {
      title: "Welcome to Infrastructure Project Tracking",
      content: "This app helps you track, manage, and compare infrastructure projects easily.",
      icon: "fas fa-building",
      tip: "You can access this guide anytime through the help button in the navigation bar."
    },
    {
      title: "Track Projects",
      content: "Find projects on the homepage and add them to your tracked list for easy access and monitoring.",
      icon: "fas fa-search",
      tip: "Projects you track will appear on your dashboard for quick reference."
    },
    {
      title: "Dashboard Overview",
      content: "Your dashboard shows all your tracked projects, statistics, and activity in one place.",
      icon: "fas fa-tachometer-alt",
      tip: "The dashboard automatically updates with new information about your projects."
    },
    {
      title: "Project Notes",
      content: "Add notes to any project to keep track of important information or observations.",
      icon: "fas fa-sticky-note",
      tip: "Notes are private to your account and can be edited or deleted anytime."
    },
    {
      title: "Compare Projects",
      content: "Select multiple projects to compare their details side by side in the compare view.",
      icon: "fas fa-chart-bar",
      tip: "Comparing helps you identify patterns and make better decisions about infrastructure investments."
    },
    {
      title: "Ready to Get Started?",
      content: "Follow the Getting Started guide on your dashboard to make the most of this app.",
      icon: "fas fa-rocket",
      tip: "You can customize your experience in the settings."
    }
  ];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  // Go to the next slide or finish if on the last slide
  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleFinish();
    }
  };

  // Go to the previous slide if not on the first slide
  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // Handle finishing the guide
  const handleFinish = async () => {
    setExiting(true);
    
    // If the user checked "don't show again", save to localStorage
    if (dontShowAgain) {
      localStorage.setItem('hasSeenWelcomeGuide', 'true');
    }
    
    // Allow exit animation to complete
    setTimeout(() => {
      completeWelcomeGuide();
    }, 500);
  };

  // Handle closing the guide without completing
  const handleClose = () => {
    setExiting(true);
    
    // Allow exit animation to complete
    setTimeout(() => {
      setShowWelcomeGuide(false);
    }, 500);
  };

  // Handle checkbox toggle
  const handleCheckboxChange = (e) => {
    setDontShowAgain(e.target.checked);
  };

  return (
    <div className={`welcome-guide-overlay ${exiting ? 'exiting' : ''}`}>
      <div className="welcome-guide-container">
        <button className="close-button" onClick={handleClose} aria-label="Close guide">
          <i className="fas fa-times"></i>
        </button>
        
        {/* Progress indicators */}
        <div className="slide-progress">
          {slides.map((_, index) => (
            <div 
              key={index} 
              className={`progress-dot ${index === currentSlide ? 'active' : ''}`}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            ></div>
          ))}
        </div>
        
        {/* Slide content */}
        <div className="slide-content">
          <div className="slide-icon">
            <i className={slides[currentSlide].icon}></i>
          </div>
          <h2>{slides[currentSlide].title}</h2>
          <p>{slides[currentSlide].content}</p>
          <div className="tip-container">
            <i className="fas fa-lightbulb"></i>
            <span className="tip-text">{slides[currentSlide].tip}</span>
          </div>
        </div>
        
        {/* Navigation controls */}
        <div className="navigation-controls">
          <div className="dont-show-again">
            <label>
              <input 
                type="checkbox" 
                checked={dontShowAgain} 
                onChange={handleCheckboxChange}
              />
              <span>Don't show this guide automatically</span>
            </label>
          </div>
          
          <div className="buttons">
            {currentSlide > 0 && (
              <button 
                className="nav-button prev-button" 
                onClick={handlePrev}
                aria-label="Previous slide"
              >
                <i className="fas fa-arrow-left"></i>
                <span>Previous</span>
              </button>
            )}
            
            <button 
              className="nav-button next-button" 
              onClick={handleNext}
              aria-label={currentSlide < slides.length - 1 ? "Next slide" : "Finish guide"}
            >
              <span>{currentSlide < slides.length - 1 ? 'Next' : 'Finish'}</span>
              <i className={currentSlide < slides.length - 1 ? "fas fa-arrow-right" : "fas fa-check"}></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeGuide;
