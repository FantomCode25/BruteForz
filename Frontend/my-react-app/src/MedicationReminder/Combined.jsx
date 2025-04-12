import React, { useState } from "react";
import ReminderList from "./ReminderList";
import MedicationReminderForm from "./MedicationReminderForm";
import './medication.css'
import NavBack from "../NavBack";

const Combined = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshReminders = () => {
    // Trigger a refresh of the reminders list without reloading the page
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="medication-container container mx-auto p-4">
      <NavBack />
      <h1 className="medication-header text-2xl font-bold mb-6">Medication Reminder Dashboard</h1>
      <div className="medication-dashboard flex flex-col md:flex-row gap-6">
        <div className="medication-dashboard-column w-full md:w-1/2">
          <div className="medication-card p-6">
            <MedicationReminderForm onReminderCreated={refreshReminders} />
          </div>
        </div>
        <div className="medication-dashboard-column w-full md:w-1/2">
          <ReminderList refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  );
};

export default Combined;