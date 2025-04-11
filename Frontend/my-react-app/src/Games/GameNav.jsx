import { Link } from 'react-router-dom';

function GameNav({ patients, selectedPatient, onPatientChange }) {
  const handleChange = (e) => {
    onPatientChange(e.target.value);
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        {"<"}
      </Link>
      <Link to="/games" className="navbar-brand">
        EchoMind Games
      </Link>
      
      <div className="patient-selector">
        <select 
          className="patient-select"
          value={selectedPatient?._id || ''}
          onChange={handleChange}
        >
          {patients.map(patient => (
            <option key={patient._id} value={patient._id}>
              {patient.name || 'Unknown Patient'}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}

export default GameNav;