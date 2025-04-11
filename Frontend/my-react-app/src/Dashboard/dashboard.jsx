import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import "./Dashboard.css";

function Dashboard({ patients, selectedPatient, loading, user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const isActive = (path) => {
    return location.pathname.includes(path) ? "active" : "";
  };

  const isSosActive = () => {
    return location.pathname.includes("/sos") ? "active" : "";
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <>
          <Navbar user={user} />
    <div className="dashboard">
      {/* 🔥 Top Navigation Bar */}

      <div className={`dashboard-buttons ${menuOpen ? "open" : ""}`}>
        <button
          className={isActive("/summary")}
          onClick={() => handleNavigation("/summary")}
        >
          <i className="icon summary-icon"></i>
          <span>Summary</span>
        </button>

        <button
          className={isActive("/games")}
          onClick={() => handleNavigation("/games")}
        >
          <i className="icon games-icon"></i>
          <span>Games</span>
        </button>

        <button
          className={isActive("/routine")}
          onClick={() => handleNavigation("/routine")}
        >
          <i className="icon routine-icon"></i>
          <span>Routine & Medication</span>
        </button>

        <button
          className={`sos-button ${isSosActive()}`}
          onClick={() => handleNavigation("/sos")}
        >
          <i className="icon sos-icon"></i>
          <span>SOS</span>
        </button>
      </div>
    </div>
    </>
  );
}

export default Dashboard;
