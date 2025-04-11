import React from "react";
import { useNavigate } from "react-router-dom";
import "./NavBack.css";

function NavBack({ user, title }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear session/local storage if used
    localStorage.removeItem("user");
    sessionStorage.clear();
    
    // Redirect to login
    navigate("/login");
  };

  const handleBack = () => {
    // Navigate to dashboard
    navigate("/dashboard");
  };

  return (
    <div className="echomind-navbar">
      <div className="navbar-left">
        <button className="back-button" onClick={handleBack}>
          <span className="back-icon">{"<"}</span> 
        </button>
      </div>
      <div className="app-brand">
        <span className="app-logo">🧠</span>
        <h1>{title || "EchoMind"}</h1>
      </div>
      <div className="navbar-right">
        {user && <span className="user-greeting">Welcome, {user.name}</span>}
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default NavBack;