import React from "react";
import ReminderList from "./ReminderList";
import MedicationReminderForm from "./MedicationReminderForm";

const Combined = () => {
  const refreshReminders = () => {
    // Trigger a refresh of the reminders list
    window.location.reload();
  };

  return (
    <div>
      <h1>Medication Reminder App</h1>
      <MedicationReminderForm onReminderCreated={refreshReminders} />
      <ReminderList />
    </div>
  );
};

export default Combined;