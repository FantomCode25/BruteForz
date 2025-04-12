import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle } from 'react-feather';
import './medication.css';

const ReminderList = ({ refreshTrigger }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingReminder, setEditingReminder] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    instruction: "",
    date_time: "",
    frequency: "daily",
    email: "",
  });

  const fetchReminders = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("http://localhost:5000/api/medication-reminders");
      const result = await response.json();
      
      if (result.success) {
        setReminders(result.reminders || []);
      } else {
        setError(result.message || "Failed to fetch reminders.");
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
      setError("An error occurred while fetching reminders.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/medication-reminders/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      
      if (result.success) {
        fetchReminders();
      } else {
        setError(result.message || "Failed to delete reminder.");
      }
    } catch (error) {
      console.error("Error deleting reminder:", error);
      setError("An error occurred while deleting the reminder.");
    }
  };

  const handleComplete = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/medication-reminders/${id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchReminders();
      } else {
        setError(result.message || 'Failed to mark medication as taken');
      }
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      setError('An error occurred while marking medication as taken');
    }
  };

  const startEdit = (reminder) => {
    const dateTime = new Date(reminder.date_time);
    const formattedDateTime = dateTime.toISOString().slice(0, 16);

    setFormData({
      name: reminder.name,
      dosage: reminder.dosage,
      instruction: reminder.instruction,
      date_time: formattedDateTime,
      frequency: reminder.frequency,
      email: reminder.email,
    });
    
    setEditingReminder(reminder._id);
  };

  const cancelEdit = () => {
    setEditingReminder(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      const formattedData = {
        ...formData,
        date_time: formData.date_time.replace("T", " ") + ":00",
      };

      const response = await fetch(`http://localhost:5000/api/medication-reminders/${editingReminder}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setEditingReminder(null);
        fetchReminders();
      } else {
        setError(result.message || "Failed to update reminder.");
      }
    } catch (error) {
      console.error("Error updating reminder:", error);
      setError("An error occurred while updating the reminder.");
    }
  };

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleString(undefined, options);
  };

  useEffect(() => {
    fetchReminders();
  }, [refreshTrigger]);

  return (
    <div className="medication-container">
      <div className="medication-card p-6">
        <h2 className="medication-header">Active Medication Reminders</h2>
        
        {error && (
          <div className="medication-error">
            {error}
          </div>
        )}
        
        {loading && reminders.length === 0 ? (
          <div className="text-center p-4">
            <div className="medication-loading-spinner" />
            <p className="mt-4">Loading reminders...</p>
          </div>
        ) : reminders.length === 0 ? (
          <p className="text-gray-500 italic">No reminders found. Create your first reminder using the form.</p>
        ) : (
          <div className="space-y-4">
            {reminders.map((reminder) => (
              <div 
                key={reminder._id} 
                className={`medication-reminder-item ${
                  reminder.status === 'completed' ? 'medication-status-completed' : 
                  reminder.status === 'missed' ? 'medication-status-missed' : 
                  'medication-status-active'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-3">
                    <div className="mt-1">
                      {reminder.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : reminder.status === 'missed' ? (
                        <XCircle className="w-5 h-5 text-red-500" />
                      ) : (
                        <button
                          onClick={() => handleComplete(reminder._id)}
                          className="medication-status-indicator"
                          title="Mark as taken"
                        >
                          <div className="w-4 h-4 border-2 border-gray-400 rounded-full" />
                        </button>
                      )}
                    </div>
                    <div>
                      <h3 className={`medication-title ${
                        reminder.status === 'completed' ? 'medication-title-completed' : ''
                      }`}>
                        {reminder.name}
                      </h3>
                      <p className="text-gray-600">{reminder.dosage}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {reminder.frequency.charAt(0).toUpperCase() + reminder.frequency.slice(1)}
                  </div>
                </div>
                
                <p className={`my-2 ${
                  reminder.status === 'completed' ? 'medication-title-completed' : ''
                }`}>
                  {reminder.instruction}
                </p>
                
                <div className="flex justify-between mt-3 text-sm">
                  <p className="text-gray-600">
                    Next: {formatDate(reminder.date_time)}
                  </p>
                  <p className="text-gray-600">{reminder.email}</p>
                </div>
                
                {reminder.status !== 'completed' && (
                  <div className="mt-3 flex space-x-2">
                    <button 
                      onClick={() => startEdit(reminder)}
                      className="medication-link-edit"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(reminder._id)}
                      className="medication-link-delete"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReminderList;