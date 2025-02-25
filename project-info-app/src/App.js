import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './components/auth/Login';
import SignUp from './components/auth/SignUp';
import ProjectDetails from './pages/ProjectDetails';
import ProjectComparison from './pages/ProjectComparison';
import './App.css';

const App = () => {
  return (
    <div className="App">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/compare" element={<ProjectComparison />} />
        <Route path="/project/:planning_id" element={<ProjectDetails />} />
      </Routes>
    </div>
  );
};

export default App;
