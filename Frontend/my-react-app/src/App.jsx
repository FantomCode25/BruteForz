import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Game components
import SimonSays from './Games/SimonSays';
import VisualLocationMemory from './Games/VisualLocationMemory';
import WordScramble from './Games/WordScramble';
import PictureMatch from './Games/PictureMatch';
import GameHome from './Games/GameHome';

// Main dashboard and other section components
import Dashboard from './Dashboard/dashboard';

// Placeholder components for unimplemented features
const Summary = () => <div className="placeholder-page"><h1>Summary Page</h1><p>This feature is coming soon!</p></div>;
const Routine = () => <div className="placeholder-page"><h1>Routine & Medication</h1><p>This feature is coming soon!</p></div>;
const SOS = () => <div className="placeholder-page"><h1>SOS Page</h1><p>This feature is coming soon!</p></div>;

function App() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/patients');
      setPatients(response.data.patients);
      
      if (response.data.patients.length > 0) {
        setSelectedPatient(response.data.patients[0]);
      }
      
      setLoading(false);
    } catch (err) {
      setError('Failed to load patients data');
      setLoading(false);
      console.error('Error fetching patients:', err);
    }
  };

  const handlePatientChange = (patientId) => {
    const patient = patients.find(p => p._id === patientId);
    setSelectedPatient(patient);
  };

  return (
    <div className="app">
      <Routes>
        {/* Main Dashboard Route */}
        <Route path="/" element={
          <Dashboard 
            patients={patients} 
            selectedPatient={selectedPatient}
            loading={loading}
          />
        } />
        
        {/* Placeholder routes for unimplemented features */}
        <Route path="/summary" element={<Summary />} />
        <Route path="/routine" element={<Routine />} />
        <Route path="/sos" element={<SOS />} />
        
        {/* Games Routes */}
        <Route path="/games" element={
          <GameHome 
            patients={patients} 
            selectedPatient={selectedPatient}
            onPatientChange={handlePatientChange}
            loading={loading}
          />
        } />
        <Route path="/games/simon-says" element={
          selectedPatient ? 
            <SimonSays patient={selectedPatient} /> : 
            <Navigate to="/games" replace />
        } />
        <Route path="/games/picture-match" element={
          selectedPatient ? 
            <PictureMatch patient={selectedPatient} /> : 
            <Navigate to="/games" replace />
        } />
        <Route path="/games/word-scramble" element={
          selectedPatient ? 
            <WordScramble patient={selectedPatient} /> : 
            <Navigate to="/games" replace />
        } />
        <Route path="/games/visual-location" element={
          selectedPatient ? 
            <VisualLocationMemory patient={selectedPatient} /> : 
            <Navigate to="/games" replace />
        } />
      </Routes>
    </div>
  );
}

export default App;