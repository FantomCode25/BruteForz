import React from "react";
import { useNavigate } from "react-router-dom";
import "./Navbar.css";

function Navbar({ user }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear session/local storage if used
    localStorage.removeItem("user");
    sessionStorage.clear();
    
    // Redirect to login
    navigate("/login");
  };

  return (
    <div className="echomind-navbar">
      <div className="app-brand">
        <span className="app-logo">🧠</span>
        <h1>EchoMind</h1>
      </div>
      <div className="navbar-right">
        {user && <span className="user-greeting">Hi, {user.name}</span>}
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default Navbar;