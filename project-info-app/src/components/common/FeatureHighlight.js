import React, { useState, useEffect } from 'react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import Tooltip from './Tooltip';
import './FeatureHighlight.css';

const FeatureHighlight = ({ 
  feature, 
  taskId, 
  tooltipText, 
  position = 'top', 
  pulsate = true,
  children 
}) => {
  const { onboardingTasks, isTaskCompleted } = useOnboarding();
  const [shouldHighlight, setShouldHighlight] = useState(false);
  
  useEffect(() => {
    // Only highlight if the feature has a related task that isn't completed yet
    if (taskId && onboardingTasks) {
      setShouldHighlight(!isTaskCompleted(taskId));
    }
  }, [taskId, onboardingTasks, isTaskCompleted]);

  return (
    <div className={`feature-highlight ${shouldHighlight ? 'highlighting' : ''} ${pulsate ? 'pulsate' : ''}`}>
      {shouldHighlight ? (
        <Tooltip text={tooltipText} position={position}>
          {children}
        </Tooltip>
      ) : (
        children
      )}
    </div>
  );
};

export default FeatureHighlight;
