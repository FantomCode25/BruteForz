import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios"; // Added missing import
import Navbar from "../Navbar";
import "./Dashboard.css";

function Dashboard({ patients, selectedPatient, loading, user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem("user"));
  const [isRecording, setIsRecording] = useState(false);

  const isActive = (path) => (location.pathname.includes(path) ? "active" : "");

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleSOS = () => {
    navigate("/sos");
  };

  const toggleRecording = async () => {
    try {
      // Determine which endpoint to call based on current state
      const endpoint = isRecording
        ? "https://lbq629b2-5000.inc1.devtunnels.ms/stop"
        : "https://lbq629b2-5000.inc1.devtunnels.ms/recognize";

      console.log(`Calling endpoint: ${endpoint}`);
      setIsRecording(!isRecording);

      // Make the API call with appropriate method
      let response;
      if (isRecording) {
        // GET request for /stop
        response = await axios.post(endpoint);
      } else {
        // POST request for /recognize
        response = await axios.get(endpoint);
      }

      if (response.status === 200) {
        // Toggle recording state with functional update to ensure latest state
        setIsRecording((prevState) => !prevState);
        console.log(`Recording state toggled to: ${!isRecording}`);
      } else {
        console.error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error toggling recording:`, error);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your profile...</p>
      </div>
    );
  }

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

      <button className="record-button" onClick={toggleRecording}>
        <span className="record-icon">
          {isRecording ? (
            <span className="red">Stop Recording</span>
          ) : (
            <span className="green">Start Recording</span>
          )}
        </span>
      </button>
    </div>
  );
}

export default Dashboard;
