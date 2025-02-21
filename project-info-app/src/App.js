import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import ProjectComparison from './pages/ProjectComparison';
import ProjectDetails from './pages/ProjectDetails';
import './App.css';

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          Infrastructure Project Tracker
        </div>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/compare">Compare Projects</Link>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/compare" element={<ProjectComparison />} />
        <Route path="/project/:planning_id" element={<ProjectDetails />} />
      </Routes>
    </div>
  );
}

export default App;
