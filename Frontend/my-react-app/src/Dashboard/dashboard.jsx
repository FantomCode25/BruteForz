import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import "./Dashboard.css";

function Dashboard({ patients, selectedPatient, loading, user }) {
  const location = useLocation();
  const navigate = useNavigate();

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

  return (
    <div className="dashboard-container">
      <Navbar user={user} />

      {/* User Greeting */}
      <div className="user-profile-card">
        <h2>Hello, {user?.name || "User"}!</h2>
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

      {/* Navigation Tiles */}
      <div className={`dashboard-buttons ${menuOpen ? "open" : ""}`}>
        <button className={isActive("/summary")} onClick={() => handleNavigation("/summary")}>
          <i className="icon summary-icon"></i>
          <span>Summary</span>
        </button>

        <button className={isActive("/games")} onClick={() => handleNavigation("/games")}>
          <i className="icon games-icon"></i>
          <span>Games</span>
        </button>

        <button className={isActive("/routine")} onClick={() => handleNavigation("/routine")}>
          <i className="icon routine-icon"></i>
          <span>Routine & Medication</span>
        </button>

        <button className={isActive("/contacts")} onClick={() => handleNavigation("/contacts")}>
          <i className="icon contacts-icon"></i>
          <span>Contacts</span>
        </button>

        <button className={`sos-button ${isActive("/sos")}`} onClick={() => handleNavigation("/sos")}>
          <i className="icon sos-icon"></i>
          <span>SOS</span>
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
