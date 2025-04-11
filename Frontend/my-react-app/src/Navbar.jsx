import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';
import { useEffect, useState } from 'react';

function Navbar({ isAuthenticated, onLogout }) {
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user?.name) setUserName(user.name);
  }, [isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    onLogout();
    navigate('/login');
  };

  if (!isAuthenticated) return null;

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <span className="navbar-title">🧠 BrainBoost</span>
        <Link to="/dashboard">Dashboard</Link>
      </div>
      <div className="navbar-right">
        <span className="navbar-user">👤 {userName}</span>
        <button onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}

export default Navbar;
