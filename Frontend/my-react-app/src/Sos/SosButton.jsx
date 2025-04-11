import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SosButton.css';

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
  );
};

export default SosButton;