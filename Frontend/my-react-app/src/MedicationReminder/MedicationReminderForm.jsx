import React, { useState } from "react";

const MedicationReminderForm = ({ onReminderCreated }) => {
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    instruction: "",
    date_time: "",
    frequency: "daily",
    email: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
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
        alert("Reminder created successfully!");
        onReminderCreated();
        setFormData({
          name: "",
          dosage: "",
          instruction: "",
          date_time: "",
          frequency: "daily",
          email: "",
        });
      } else {
        alert(result.message || "Failed to create reminder.");
      }
    } catch (error) {
      console.error("Error creating reminder:", error);
      alert("An error occurred while creating the reminder.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Medication Reminder</h2>
      <div>
        <label>Name:</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div>
        <label>Dosage:</label>
        <input type="text" name="dosage" value={formData.dosage} onChange={handleChange} required />
      </div>
      <div>
        <label>Instruction:</label>
        <input type="text" name="instruction" value={formData.instruction} onChange={handleChange} required />
      </div>
      <div>
        <label>Date & Time:</label>
        <input type="datetime-local" name="date_time" value={formData.date_time} onChange={handleChange} required />
      </div>
      <div>
        <label>Frequency:</label>
        <select name="frequency" value={formData.frequency} onChange={handleChange}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div>
        <label>Email:</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} required />
      </div>
      <button type="submit">Create Reminder</button>
    </form>
  );
};

export default MedicationReminderForm;