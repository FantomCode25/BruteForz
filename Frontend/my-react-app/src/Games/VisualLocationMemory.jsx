import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import GameNav from './GameNav';
import './VisualLocationMemory.css';

function VisualLocationMemory() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('idle'); // idle, memorize, recall, complete
  const [grid, setGrid] = useState([]);
  const [correctLocations, setCorrectLocations] = useState([]);
  const [playerSelections, setPlayerSelections] = useState([]);
  const [gridSize, setGridSize] = useState(4); // 4x4 grid to start
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(null);
  const [timeToMemorize, setTimeToMemorize] = useState(3); // Changed from 5 to 3 seconds
  const [saveError, setSaveError] = useState(null);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [remainingLives, setRemainingLives] = useState(3);
  
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
  
  // When game state changes to complete, save the score
  useEffect(() => {
    if (gameState === 'complete' && score > 0 && user?.user_id) {
      saveScore();
    }
  }, [gameState, score, user]);
  
  useEffect(() => {
    let interval;
    if (gameState === 'memorize' && timer > 0) {
      interval = setInterval(() => {
        setTimer(prevTimer => Math.max(0, prevTimer - 1));
      }, 1000);
    } else if (gameState === 'memorize' && timer === 0) {
      // Time's up, switch to recall phase
      setGameState('recall');
    }
    return () => clearInterval(interval);
  }, [gameState, timer]);
  
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
        game_name: 'visual-location-memory',
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
    setScore(0);
    setLevel(1);
    setRemainingLives(3);
    setSaveError(null);
    setScoreSaved(false);
    setGridSize(4); // Start with 4x4 grid
    setTimeToMemorize(3); // Changed from 5 to 3 seconds for initial timer
    startNewRound();
  };
  
  const startNewRound = () => {
    // Create empty grid
    const emptyGrid = Array(gridSize * gridSize).fill(false);
    
    // Number of objects to remember increases with level
    const objectCount = Math.min(3 + Math.floor(level / 2), Math.floor(gridSize * gridSize / 2));
    
    // Randomly place objects
    const objectLocations = [];
    while (objectLocations.length < objectCount) {
      const randomPosition = Math.floor(Math.random() * (gridSize * gridSize));
      if (!objectLocations.includes(randomPosition)) {
        objectLocations.push(randomPosition);
      }
    }
    
    // Create grid with placed objects
    const newGrid = [...emptyGrid];
    objectLocations.forEach(position => {
      newGrid[position] = true;
    });
    
    setGrid(newGrid);
    setCorrectLocations(objectLocations);
    setPlayerSelections([]);
    setTimer(timeToMemorize);
    setGameState('memorize');
  };
  
  const handleCellClick = (index) => {
    if (gameState !== 'recall') return;
    
    // Toggle selection
    let newSelections;
    if (playerSelections.includes(index)) {
      newSelections = playerSelections.filter(pos => pos !== index);
    } else {
      newSelections = [...playerSelections, index];
    }
    
    setPlayerSelections(newSelections);
  };
  
  const submitAnswers = () => {
    if (gameState !== 'recall') return;
    
    // Check if player got all locations correct
    let correct = true;
    let matches = 0;
    
    // Check if player selected all correct locations
    if (playerSelections.length !== correctLocations.length) {
      correct = false;
    } else {
      // Check each selection
      for (const selection of playerSelections) {
        if (correctLocations.includes(selection)) {
          matches++;
        } else {
          correct = false;
          break;
        }
      }
    }
    
    // Calculate points based on matches and misses
    const pointsPerCorrect = 10;
    const earnedPoints = matches * pointsPerCorrect;
    
    if (correct) {
      // All correct - go to next level
      setScore(prevScore => prevScore + earnedPoints);
      setLevel(prevLevel => prevLevel + 1);
      
      // Increase grid size every 3 levels
      if (level % 3 === 0 && gridSize < 6) {
        setGridSize(prevSize => prevSize + 1);
      }
      
      // Decrease memorization time as levels progress, but not below 2 seconds
      if (level % 2 === 0) {
        setTimeToMemorize(prevTime => Math.max(2, prevTime - 0.5));
      }
      
      // Start new round with more complex pattern
      startNewRound();
    } else {
      // Add partial points for partial matches
      setScore(prevScore => prevScore + earnedPoints);
      
      // Lose a life
      const newLives = remainingLives - 1;
      setRemainingLives(newLives);
      
      if (newLives <= 0) {
        // Game over
        setGameState('complete');
      } else {
        // Try again with same level
        startNewRound();
      }
    }
  };
  
  return (
    <div className="game-page">
      <GameNav user={user} />
      
      <div className="game-header">
        <Link to="/games" className="back-button">
          ← Back to Games
        </Link>
        <div className="visual-game-header">
          Score: {score} | Level: {level} | Lives: {'💚'.repeat(remainingLives)}
        </div>
      </div>
      
      <div className="game-content">
        <h2 className="game-title-header">Visual Location Memory</h2>
        
        {gameState === 'idle' && (
          <div className="instructions">
            <p>Remember the locations of the stars shown on the grid.</p>
            <p>After they disappear, click on the cells where you saw them.</p>
            <button className="start-button" onClick={startGame}>
              Start Game
            </button>
          </div>
        )}
        
        {gameState === 'complete' && (
          <div className="game-complete">
            <h3>Game Over!</h3>
            <p>Your final score: {score}</p>
            <p>You reached level: {level}</p>
            {scoreSaved && <p className="score-saved">Score saved successfully!</p>}
            {saveError && <p className="score-error">Error: {saveError}</p>}
            <button className="start-button" onClick={startGame}>
              Play Again
            </button>
          </div>
        )}
        
        {gameState === 'memorize' && (
          <>
            <div className="game-timer">
              Memorize the star positions: {timer} seconds
            </div>
            
            <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
              {grid.map((hasObject, index) => (
                <div 
                  key={index}
                  className={`grid-cell ${hasObject ? 'has-object' : ''}`}
                >
                  {hasObject && '⭐'}
                </div>
              ))}
            </div>
            
            <div className="game-instruction">
              Remember where the stars are located!
            </div>
          </>
        )}
        
        {gameState === 'recall' && (
          <>
            <div className="game-instruction">
              <strong>Click on the cells where you saw the stars!</strong>
            </div>
            
            <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
              {grid.map((_, index) => (
                <div 
                  key={index}
                  className={`grid-cell recall-cell ${playerSelections.includes(index) ? 'selected' : ''}`}
                  onClick={() => handleCellClick(index)}
                >
                  {playerSelections.includes(index) && '✓'}
                </div>
              ))}
            </div>
            
            <div className="selection-info">
              You've selected {playerSelections.length} cells.
              {correctLocations.length > 0 && ` (Need to select ${correctLocations.length} in total)`}
            </div>
            
            <button className="submit-button" onClick={submitAnswers}>
              Submit Answers
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default VisualLocationMemory;