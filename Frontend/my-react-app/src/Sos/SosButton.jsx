import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SosButton.css';
import NavBack from '../NavBack';

const SosButton = ({ user, apiUrl = 'http://localhost:8000/api' }) => {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [battery, setBattery] = useState(null);
  const [location, setLocation] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Get battery level if available
  useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setBattery(Math.round(battery.level * 100));
      });
    }
  }, []);

  // Clear status message after 5 seconds
  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => {
        setStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Handle countdown timer
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Send SOS when countdown reaches 0
      sendSos();
    }
  }, [countdown]);

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setLocation(locationData);
          resolve(locationData);
        },
        error => {
          console.error("Error getting location:", error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const startSosCountdown = async () => {
    // Get location first
    await getLocation();
    
    // Start a 5-second countdown
    setCountdown(5);
    setExpanded(true);
  };

  const cancelSos = () => {
    setCountdown(null);
    setExpanded(false);
    setStatus({ type: 'info', message: 'SOS canceled' });
  };

  const sendSos = async () => {
    setSending(true);
    
    try {
      // If location wasn't already fetched, try again
      const locationData = location || await getLocation();
      
      const response = await axios.post(`${apiUrl}/sos`, {
        user_id: user?.user_id,  // Send user ID if available
        name: user?.name || "Anonymous User",
        location: locationData,
        battery: battery
      });

      if (response.data.success) {
        setStatus({
          type: 'success',
          message: 'SOS alert sent successfully! Help is on the way.',
          details: response.data
        });
      } else {
        throw new Error(response.data.message || 'Failed to send SOS');
      }
    } catch (error) {
      console.error('SOS error:', error);
      setStatus({
        type: 'error',
        message: `SOS alert failed: ${error.message}`,
      });
    } finally {
      setSending(false);
      setCountdown(null);
      setExpanded(false);
    }
  };

  return (
    <div className="sos-page-container">
      <NavBack />
      <div className="sos-info-header">
        <h1>Memory Helper Emergency Alert</h1>
        <p className="sos-description">
          This SOS button is designed specifically for individuals with dementia and Alzheimer's. 
          In moments of disorientation or emergency, a single press can alert caregivers with your 
          exact location and status.
        </p>
      </div>

      <div className={`sos-container ${expanded ? 'expanded' : ''}`}>
        {countdown !== null ? (
          <div className="countdown-container">
            <div className="countdown-timer">
              <span className="countdown-number">{countdown}</span>
              <span className="countdown-text">Sending SOS in {countdown} seconds</span>
            </div>
            <button 
              className="cancel-button"
              onClick={cancelSos}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button 
              className={`sos-button ${sending ? 'sending' : ''}`}
              onClick={startSosCountdown}
              disabled={sending}
              aria-label="Send emergency alert"
            >
              {sending ? 'Sending...' : 'SOS'}
            </button>
            
            {status && (
              <div className={`status-message ${status.type}`}>
                {status.message}
              </div>
            )}
          </>
        )}
        
        {expanded && !countdown && (
          <div className="sos-details">
            <div className="location-status">
              {location ? (
                <span className="available">✓ Location available</span>
              ) : (
                <span className="unavailable">✗ Location unavailable</span>
              )}
            </div>
            
            {battery !== null && (
              <div className="battery-status">
                Battery: {battery}%
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sos-info-footer">
        <h2>How This Helps</h2>
        <div className="info-cards-container">
          <div className="info-card">
            <div className="info-icon location-icon"></div>
            <h3>Instant Location Sharing</h3>
            <p>Automatically sends your precise location to designated emergency contacts.</p>
          </div>
          <div className="info-card">
            <div className="info-icon alert-icon"></div>
            <h3>Quick Emergency Response</h3>
            <p>Alerts caregivers immediately, reducing response time during critical moments.</p>
          </div>
          <div className="info-card">
            <div className="info-icon safety-icon"></div>
            <h3>Enhanced Independence</h3>
            <p>Provides peace of mind for both users and caregivers, allowing more freedom with safety.</p>
          </div>
        </div>
        <div className="usage-instructions">
          <h3>When to Use</h3>
          <ul>
            <li>If you feel lost or disoriented</li>
            <li>During medical emergencies</li>
            <li>When you need immediate assistance</li>
            <li>If you're feeling unsafe or vulnerable</li>
          </ul>
          <p className="caregiver-note">
            <strong>For Caregivers:</strong> When an alert is triggered, you'll receive the user's 
            current location, battery status, and timestamp via your connected application or SMS.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SosButton;