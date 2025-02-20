import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ProjectDetails from './pages/ProjectDetails';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project/:planningId" element={<ProjectDetails />} />
      </Routes>
    </div>
  );
}

export default App;
