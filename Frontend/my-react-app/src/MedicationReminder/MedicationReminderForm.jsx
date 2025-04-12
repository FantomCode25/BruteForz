import React, { useState } from "react";
import './medication.css'

const MedicationReminderForm = ({ onReminderCreated }) => {
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    instruction: "",
    date_time: "",
    frequency: "daily",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError(""); // Clear error when user makes changes
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      // Make sure the date is in the future
      const reminderDate = new Date(formData.date_time.replace("T", " "));
      if (reminderDate <= new Date()) {
        setError("Reminder date must be in the future");
        setLoading(false);
        return;
      }
      
      // Format date_time to match the backend's expected format
      const formattedData = {
        ...formData,
        date_time: formData.date_time.replace("T", " ") + ":00", // Convert 'YYYY-MM-DDTHH:mm' to 'YYYY-MM-DD HH:MM:SS'
      };

      const response = await fetch("http://localhost:5000/api/medication-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Reset form and notify parent component
        setFormData({
          name: "",
          dosage: "",
          instruction: "",
          date_time: "",
          frequency: "daily",
          email: "",
        });
        onReminderCreated();
      } else {
        setError(result.message || "Failed to create reminder.");
      }
    } catch (error) {
      console.error("Error creating reminder:", error);
      setError("An error occurred while creating the reminder.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="medication-subheader">Create New Medication Reminder</h2>
      
      {error && (
        <div className="medication-error">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="medication-form-group">
          <label className="medication-label">Medication Name:</label>
          <input 
            type="text" 
            name="name" 
            value={formData.name} 
            onChange={handleChange} 
            className="medication-input w-full" 
            required 
          />
        </div>
        
        <div className="medication-form-group">
          <label className="medication-label">Dosage:</label>
          <input 
            type="text" 
            name="dosage" 
            value={formData.dosage} 
            onChange={handleChange} 
            placeholder="e.g., 10mg, 2 tablets" 
            className="medication-input w-full" 
            required 
          />
        </div>
        
        <div className="medication-form-group">
          <label className="medication-label">Instructions:</label>
          <input 
            type="text" 
            name="instruction" 
            value={formData.instruction} 
            onChange={handleChange}
            placeholder="e.g., Take with food" 
            className="medication-input w-full" 
            required 
          />
        </div>
        
        <div className="medication-form-group">
          <label className="medication-label">Start Date & Time:</label>
          <input 
            type="datetime-local" 
            name="date_time" 
            value={formData.date_time} 
            onChange={handleChange} 
            className="medication-datetime w-full" 
            required 
          />
        </div>
        
        <div className="medication-form-group">
          <label className="medication-label">Frequency:</label>
          <select 
            name="frequency" 
            value={formData.frequency} 
            onChange={handleChange}
            className="medication-select w-full bg-white"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        
        <div className="medication-form-group">
          <label className="medication-label">Email for Notifications:</label>
          <input 
            type="email" 
            name="email" 
            value={formData.email} 
            onChange={handleChange} 
            placeholder="example@email.com"
            className="medication-input w-full" 
            required 
          />
        </div>
        
        <button 
          type="submit" 
          className="medication-button medication-button-primary w-full"
          disabled={loading}
        >
          {loading ? 
            <div className="flex items-center justify-center">
              <div className="medication-loading-spinner mr-2"></div>
              Creating...
            </div> 
            : "Create Reminder"}
        </button>
      </form>
    </div>
  );
};

export default MedicationReminderForm;