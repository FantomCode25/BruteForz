import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './Login';
import Signup from './Signup';
import SimonSays from './Games/SimonSays';
import VisualLocationMemory from './Games/VisualLocationMemory';
import WordScramble from './Games/WordScramble';
import PictureMatch from './Games/PictureMatch';
import GameHome from './Games/GameHome';
import Dashboard from './Dashboard/dashboard';
import SosButton from './Sos/SosButton';

// Placeholder components
const Summary = () => <div className="placeholder-page"><h1>Summary Page</h1><p>This feature is coming soon!</p></div>;
const Routine = () => <div className="placeholder-page"><h1>Routine & Medication</h1><p>This feature is coming soon!</p></div>;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('user');
    if (token) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  return (
    <div className="app">
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={
          isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />
        } />
        <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
        <Route path="/signup" element={<Signup onSignup={() => setIsAuthenticated(true)} />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={
          isAuthenticated ? (
            <Dashboard />
          ) : (
            <Navigate to="/login" />
          )
        } />

        {/* Placeholder Routes */}
        <Route path="/summary" element={isAuthenticated ? <Summary /> : <Navigate to="/login" />} />
        <Route path="/routine" element={isAuthenticated ? <Routine /> : <Navigate to="/login" />} />
        <Route path="/sos" element={isAuthenticated ? <SosButton /> : <Navigate to="/login" />} />

        {/* Game Routes */}
        <Route path="/games" element={
          isAuthenticated ? <GameHome /> : <Navigate to="/login" />
        } />
        <Route path="/games/simon-says" element={
          isAuthenticated ? <SimonSays /> : <Navigate to="/login" />
        } />
        <Route path="/games/picture-match" element={
          isAuthenticated ? <PictureMatch /> : <Navigate to="/login" />
        } />
        <Route path="/games/word-scramble" element={
          isAuthenticated ? <WordScramble /> : <Navigate to="/login" />
        } />
        <Route path="/games/visual-location" element={
          isAuthenticated ? <VisualLocationMemory /> : <Navigate to="/login" />
        } />
      </Routes>
    </div>
  );
}

export default App;
