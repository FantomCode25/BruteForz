import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import "./Dashboard.css";

function Dashboard({ patients, selectedPatient, loading, user }) {
  const location = useLocation();
  const navigate = useNavigate();

  const userData = JSON.parse(localStorage.getItem('user'));

  const [isRecording, setIsRecording] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // Recording logic goes here
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const isActive = (path) => location.pathname.includes(path) ? "active" : "";

  const handleNavigation = (path) => {
    navigate(path);
    setMenuOpen(false); // Close menu after navigating
  };

  const handleSOS = () => {
    navigate("/sos");
  };

  return (
    <div className="dashboard-container">
      <Navbar user={user} />

      {/* User Greeting with SOS Button */}
      <div className="user-profile-card">
        <div className="user-greeting">
          <h2>Hello, {userData?.name || "User"}!</h2>
          <p>
            Today is{" "}
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button className="sos-card-button" onClick={handleSOS}>
          <i className="icon sos-icon"></i>
          <span>SOS</span>
        </button>
      </div>

      {/* Navigation Tiles - Now in 2 columns */}
      <div className="dashboard-tiles">
        <button 
          className={`dashboard-tile ${isActive("/summary")}`} 
          onClick={() => handleNavigation("/summary")}
        >
          <i className="icon summary-icon"></i>
          <span>Summary</span>
        </button>

        <button 
          className={`dashboard-tile ${isActive("/games")}`} 
          onClick={() => handleNavigation("/games")}
        >
          <i className="icon games-icon"></i>
          <span>Games</span>
        </button>

        <button 
          className={`dashboard-tile ${isActive("/medication-reminder")}`} 
          onClick={() => handleNavigation("/medication-reminder")}
        >
          <i className="icon routine-icon"></i>
          <span>Routine & Medication</span>
        </button>

        <button 
          className={`dashboard-tile ${isActive("/contacts")}`} 
          onClick={() => handleNavigation("/contacts")}
        >
          <i className="icon contacts-icon"></i>
          <span>Contacts</span>
        </button>
      </div>

      {/* Recording Button */}
      <button 
        className={`recording-button ${isRecording ? 'recording' : ''}`}
        onClick={toggleRecording}
      >
        <i className="icon recording-icon"></i>
        <span>{isRecording ? "Stop Recording" : "Start Recording"}</span>
      </button>
    </div>
  );
}

export default Dashboard;