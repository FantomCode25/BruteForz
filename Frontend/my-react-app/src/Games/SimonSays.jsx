import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import GameNav from './GameNav';
import './SimonSays.css'

function SimonSays() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('idle'); // idle, sequence, player, gameOver
  const [sequence, setSequence] = useState([]);
  const [playerSequence, setPlayerSequence] = useState([]);
  const [score, setScore] = useState(0);
  const [saveError, setSaveError] = useState(null);
  const [scoreSaved, setScoreSaved] = useState(false);
  
  const colors = ['red', 'blue', 'green', 'yellow'];
  const colorRefs = useRef({});
  
  // Load user data from localStorage on component mount
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }
  }, []);
  
  // When gameState changes to gameOver, save the score
  useEffect(() => {
    if (gameState === 'gameOver' && score > 0 && user?.user_id) {
      saveScore();
    }
  }, [gameState, score, user]);
  
  const saveScore = async () => {
    // Reset state for new save attempt
    setSaveError(null);
    setScoreSaved(false);
    
    if (!user?.user_id) {
      setSaveError("No user ID available");
      return;
    }
    
    try {
      const scoreData = {
        patient_id: user.user_id,
        game_name: 'simon-says',
        score: score,
        user_name: user.name || 'Unknown User'
      };
      
      console.log("Saving score:", scoreData);
      
      const response = await axios.post('http://localhost:5000/api/games', scoreData);
      
      console.log("Save score response:", response.data);
      
      if (response.data.success) {
        setScoreSaved(true);
      } else {
        setSaveError("Failed to save score: " + response.data.error);
      }
    } catch (error) {
      console.error('Error saving score:', error);
      const errorMessage = error.response?.data?.error || error.message;
      setSaveError("Error saving score: " + errorMessage);
    }
  };
  
  const startGame = () => {
    setGameState('sequence');
    setScore(0);
    setSequence([getRandomColor()]);
    setPlayerSequence([]);
    setScoreSaved(false);
    setSaveError(null);
  };
  
  const getRandomColor = () => {
    return colors[Math.floor(Math.random() * colors.length)];
  };
  
  const playSequence = async () => {
    setGameState('sequence');
    setPlayerSequence([]);
    
    // Play the sequence with delays
    for (let i = 0; i < sequence.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      flashColor(sequence[i]);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setGameState('player');
  };
  
  useEffect(() => {
    if (gameState === 'sequence' && sequence.length > 0) {
      playSequence();
    }
  }, [sequence, gameState]);
  
  const flashColor = (color) => {
    if (colorRefs.current[color]) {
      colorRefs.current[color].classList.add('active');
      setTimeout(() => {
        colorRefs.current[color].classList.remove('active');
      }, 300);
    }
  };
  
  const handleColorClick = (color) => {
    if (gameState !== 'player') return;
    
    flashColor(color);
    
    const newPlayerSequence = [...playerSequence, color];
    setPlayerSequence(newPlayerSequence);
    
    // Check if the player made a mistake
    const index = playerSequence.length;
    if (color !== sequence[index]) {
      setGameState('gameOver');
      return; // Score saving is handled by useEffect
    }
    
    // Check if the player completed the sequence correctly
    if (newPlayerSequence.length === sequence.length) {
      // Update score first
      setScore(prevScore => prevScore + 1);
      
      // Then go to next round with a new extended sequence
      setTimeout(() => {
        const newSequence = [...sequence, getRandomColor()];
        setSequence(newSequence);
        setGameState('sequence'); // This triggers the playSequence effect
      }, 1000);
    }
  };
  
  return (
    <div className="game-page">
      <GameNav user={user} />
      
      <div className="game-header">
        <Link to="/games" className="back-button">
          ← Back to Games
        </Link>
        <div>
          Score: {score}
        </div>
      </div>
      
      <div className="game-content">
        <h2 className="game-title-header">Simon Says</h2>
        
        {gameState === 'idle' && (
          <div className="instructions">
            <p>Watch the sequence of colors and repeat it by clicking the colors in the same order.</p>
            <p>Get ready to test your memory!</p>
            <button className="start-button" onClick={startGame}>
              Start Game
            </button>
          </div>
        )}
        
        {gameState === 'gameOver' && (
          <div className="game-over">
            <h3>Game Over!</h3>
            <p>Your score: {score}</p>
            {scoreSaved && <p className="score-saved">Score saved successfully!</p>}
            {saveError && <p className="score-error">Error: {saveError}</p>}
            <button className="start-button" onClick={startGame}>
              Play Again
            </button>
          </div>
        )}
        
        <div className={`simon-container ${gameState === 'player' ? 'active' : ''}`}>
          {colors.map(color => (
            <div
              key={color}
              className={`simon-button ${color}`}
              ref={el => colorRefs.current[color] = el}
              onClick={() => handleColorClick(color)}
            ></div>
          ))}
        </div>
        
        {gameState === 'sequence' && (
          <div className="status-message">Watch the sequence...</div>
        )}
        
        {gameState === 'player' && (
          <div className="status-message">Your turn! Repeat the sequence.</div>
        )}
      </div>
    </div>
  );
}

export default SimonSays;