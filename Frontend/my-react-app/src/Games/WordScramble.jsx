import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import GameNav from './GameNav';

import './WordScramble.css';

// Words related to everyday objects and activities
const wordBank = [
  "apple", "table", "chair", "clock", "water",
  "house", "bread", "shirt", "phone", "smile",
  "beach", "plant", "brush", "sleep", "happy",
  "music", "paper", "light", "plate", "sunny"
];

function WordScramble() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('idle'); // idle, playing, complete
  const [currentWord, setCurrentWord] = useState('');
  const [scrambledWord, setScrambledWord] = useState('');
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(60); // 60-second timer
  const [feedback, setFeedback] = useState('');
  const [usedWords, setUsedWords] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [scoreSaved, setScoreSaved] = useState(false);
  
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
  
  useEffect(() => {
    let interval;
    if (gameState === 'playing' && timer > 0) {
      interval = setInterval(() => {
        setTimer(prevTimer => prevTimer - 1);
      }, 1000);
    } else if (timer === 0 && gameState === 'playing') {
      endGame();
    }
    return () => clearInterval(interval);
  }, [gameState, timer]);
  
  useEffect(() => {
    if (gameState === 'complete' && score > 0 && user?.user_id) {
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
        game_name: 'word-scramble',
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
    setTimer(60);
    setUsedWords([]);
    setFeedback('');
    setGameState('playing');
    setSaveError(null);
    setScoreSaved(false);
    generateNewWord();
  };
  
  const endGame = () => {
    setGameState('complete');
    // Score saving is now handled by the useEffect
  };
  
  const generateNewWord = () => {
    // Filter out used words
    const availableWords = wordBank.filter(word => !usedWords.includes(word));
    
    // If we've used all words, end the game
    if (availableWords.length === 0) {
      endGame();
      return;
    }
    
    // Pick a random word
    const randomIndex = Math.floor(Math.random() * availableWords.length);
    const word = availableWords[randomIndex];
    
    // Scramble the word
    const scrambled = scrambleWord(word);
    
    setCurrentWord(word);
    setScrambledWord(scrambled);
    setUserInput('');
    setFeedback('');
  };
  
  const scrambleWord = (word) => {
    // Convert to array, shuffle, and join back
    const wordArray = word.split('');
    let scrambled;
    
    // Keep scrambling until we get a different arrangement
    do {
      scrambled = [...wordArray].sort(() => Math.random() - 0.5).join('');
    } while (scrambled === word);
    
    return scrambled;
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const cleanInput = userInput.trim().toLowerCase();
    
    if (cleanInput === currentWord) {
      // Correct answer
      setScore(prevScore => prevScore + 10);
      setFeedback('Correct! +10 points');
      setUsedWords(prev => [...prev, currentWord]);
      
      // Show feedback briefly before moving to next word
      setTimeout(() => {
        generateNewWord();
      }, 1000);
    } else {
      // Incorrect answer
      setFeedback('Try again!');
    }
  };
  
  const skipWord = () => {
    setUsedWords(prev => [...prev, currentWord]);
    setScore(prevScore => Math.max(0, prevScore - 2)); // Penalty for skipping
    setFeedback('Word skipped.');
    
    setTimeout(() => {
      generateNewWord();
    }, 1000);
  };
  
  return (
    <div className="game-page">
      <GameNav user={user} />
      
      <div className="game-header">
        <Link style={{color:"black", display:"flex", fontSize:"15px",width:"30%"}} to="/games" className="back-button">
          ← Back to Games
        </Link>
        <div>
          Score: {score}
        </div>
      </div>
      
      <div className="game-content">
        <h2 className="game-title-header">Word Scramble</h2>
        
        {gameState === 'idle' && (
          <div className="instructions">
            <p>Unscramble the letters to form a valid word.</p>
            <p>You have 60 seconds to solve as many words as you can!</p>
            <button className="start-button" onClick={startGame}>
              Start Game
            </button>
          </div>
        )}
        
        {gameState === 'complete' && (
          <div className="game-complete">
            <h3>Time's Up!</h3>
            <p>Your final score: {score}</p>
            {scoreSaved && <p className="score-saved">Score saved successfully!</p>}
            {saveError && <p className="score-error">Error: {saveError}</p>}
            <button className="start-button" onClick={startGame}>
              Play Again
            </button>
          </div>
        )}
        
        {gameState === 'playing' && (
          <>
            <div className="game-timer">
              Time Remaining: {timer} seconds
            </div>
            
            <div className="scrambled-word">
              {scrambledWord}
            </div>
            
            <form onSubmit={handleSubmit} className="word-form">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Enter your answer"
                autoFocus
              />
              <button type="submit" className="submit-button">
                Submit
              </button>
              <button type="button" className="skip-button" onClick={skipWord}>
                Skip
              </button>
            </form>
            
            {feedback && (
              <div className={`feedback ${feedback.includes('Correct') ? 'correct' : ''}`}>
                {feedback}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default WordScramble;