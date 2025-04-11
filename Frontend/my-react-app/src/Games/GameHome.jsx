import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GameNav from './GameNav';

function GameHome() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="loading">Loading user data...</div>;
  }

  if (!user) {
    return (
      <div className="error">
        <h2>User not found</h2>
        <p>Please log in to continue.</p>
        <Link to="/login" className="auth-link">Go to Login</Link>
      </div>
    );
  }

  const games = [
    {
      id: 'simon-says',
      title: 'Simon Says',
      description: 'Test your memory by repeating patterns in the correct sequence.',
      path: '/games/simon-says'
    },
    {
      id: 'picture-match',
      title: 'Picture Match',
      description: 'Find matching pairs of pictures to test your visual memory.',
      path: '/games/picture-match'
    },
    {
      id: 'word-scramble',
      title: 'Word Scramble',
      description: 'Unscramble letters to form valid words and improve cognition.',
      path: '/games/word-scramble'
    },
    {
      id: 'visual-location',
      title: 'Visual Location Memory',
      description: 'Remember positions of objects to enhance spatial memory and attention.',
      path: '/games/visual-location'
    }
  ];

  return (
    <div className="home">
      <GameNav user={user} />
      
      <div className="games-container">
        <h1 className="games-heading">Cognitive Training Games</h1>
        
        <div className="games-grid">
          {games.map(game => (
            <div key={game.id} className="game-card">
              <div className="game-card-content">
                <h2 className="game-title">{game.title}</h2>
                <p className="game-description">{game.description}</p>
                <Link to={game.path} className="game-button">
                  Play Game
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GameHome;