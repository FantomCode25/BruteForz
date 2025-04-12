import React, { useEffect, useState } from "react";

const ReminderList = () => {
  const [reminders, setReminders] = useState([]);

  const fetchReminders = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/medication-reminders");
      const result = await response.json();
      if (result.success) {
        setReminders(result.reminders || []);
      } else {
        alert(result.message || "Failed to fetch reminders.");
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
      alert("An error occurred while fetching reminders.");
    }
  };

  const deleteReminder = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/medication-reminders/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        alert("Reminder deleted successfully!");
        fetchReminders();
      } else {
        alert(result.message || "Failed to delete reminder.");
      }
    } catch (error) {
      console.error("Error deleting reminder:", error);
      alert("An error occurred while deleting the reminder.");
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  return (
    <div>
      <h2>Medication Reminders</h2>
      <ul>
        {reminders.map((reminder) => (
          <li key={reminder._id}>
            <strong>{reminder.name}</strong> - {reminder.dosage} - {reminder.instruction} -{" "}
            {new Date(reminder.date_time).toLocaleString()} - {reminder.frequency}
            <button onClick={() => deleteReminder(reminder._id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ReminderList;