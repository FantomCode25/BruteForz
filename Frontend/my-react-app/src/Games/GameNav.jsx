import { Link } from 'react-router-dom';

function GameNav({ user }) {
  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        {"<"}
      </Link>
      <Link to="/games" className="navbar-brand">
        EchoMind Games
      </Link>
      
      <div className="patient-selector">
        <div className="user-info">
          <span className="user-name">{user?.name || 'Unknown User'}</span>
        </div>
      </div>
    </nav>
  );
}

export default GameNav;