import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import html2canvas from 'html2canvas';
import Sidebar from '../components/Sidebar';
import BadgeBox from '../components/BadgeBox';
import HintBox from '../components/HintBox';


// --- CONFIGURATION ---
const BASE_VOLUME = 0.5;
const CHAOS_MUSIC_VOLUME = 0.7;
const VOICE_DIM_VOLUME = 0.2;

// --- SCATTERED TEXT COMPONENT ---
const ScatteredText = ({ text, className = '' }) => {
  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <span 
          key={i} 
          className="scatter-char"
          style={{ 
            animationDelay: `${i * 0.02}s`,
            '--char-index': i 
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
};

// --- MUSIC CONTROL FUNCTIONS ---
const getBackgroundMusic = () => document.getElementById('bg-music');
const getCreepyMusic = () => document.getElementById('creepy-music');
const getMonitorFrame = () => document.querySelector('.monitor-frame');

const setMusicVolume = (volume) => {
  const music = getBackgroundMusic();
  if (music) {
    music.volume = volume;
  }
};

const startChaosMusic = () => {
  const bgMusic = getBackgroundMusic();
  const creepyMusic = getCreepyMusic();
  
  // PAUSE background music completely during chaos
  if (bgMusic) {
    bgMusic.pause();
  }
  
  // Play creepy chaos sound
  if (creepyMusic) {
    creepyMusic.volume = CHAOS_MUSIC_VOLUME;
    creepyMusic.currentTime = 0;
    creepyMusic.play().catch(e => console.warn("Creepy music play failed.", e));
  }
};

const stopChaosMusic = () => {
  const bgMusic = getBackgroundMusic();
  const creepyMusic = getCreepyMusic();
  
  // Stop creepy sound
  if (creepyMusic) {
    creepyMusic.pause();
    creepyMusic.currentTime = 0;
  }
  
  // Resume background music at lowered volume for TTS
  if (bgMusic) {
    bgMusic.volume = VOICE_DIM_VOLUME;
    bgMusic.play().catch(e => console.warn("Background music resume failed.", e));
  }
};

const controlMusicStart = () => {
  const music = getBackgroundMusic();
  if (music && music.paused) {
    music.volume = BASE_VOLUME;
    music.play().catch(e => console.warn("Background music blocked by browser policy.", e));
  }
};

const controlMusicResume = () => {
  const music = getBackgroundMusic();
  if (music) {
    if (music.paused) {
      music.play().catch(e => console.warn("Music resumption failed (browser policy re-applied).", e));
    } else if (music.volume !== BASE_VOLUME) {
      music.volume = BASE_VOLUME; // Ensure volume returns to normal after TTS/laugh
    }
  }
};

// --- TEXT CLEANING FOR TTS ---
const cleanTextForTTS = (text) => {
  return text
    .replace(/\*\*/g, '')  // Remove bold **
    .replace(/\*/g, '')     // Remove italic *
    .replace(/#/g, '')      // Remove headings #
    .trim();
};

// --- VOICE AND LAUGH FUNCTIONS ---
const speakResponse = (text, callback) => {
  // Background music already at VOICE_DIM_VOLUME from stopChaosMusic
  
  if ('speechSynthesis' in window) {
    const cleanedText = cleanTextForTTS(text);
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.rate = 0.6;
    utterance.pitch = 0.7;
    
    const voices = window.speechSynthesis.getVoices();
    const spookyVoice = voices.find(voice => 
      voice.name.toLowerCase().includes('low') || voice.lang.startsWith('en-GB')
    );
    if (spookyVoice) {
      utterance.voice = spookyVoice;
    }
    
    utterance.onend = () => {
      // PAUSE background music before laugh
      const bgMusic = getBackgroundMusic();
      if (bgMusic) {
        bgMusic.pause();
      }
      if (callback) callback();
    };
    
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("Web Speech API not supported.");
    // PAUSE background music before laugh
    const bgMusic = getBackgroundMusic();
    if (bgMusic) {
      bgMusic.pause();
    }
    if (callback) callback();
  }
};

const playSpookyLaugh = (callback) => {
  const monitorFrame = getMonitorFrame();
  if (monitorFrame) {
    monitorFrame.classList.add('screen-vibrate');
  }
  
  const skullGif = document.createElement('img');
  skullGif.src = '/laughing_skull.gif';
  skullGif.className = 'laughing-skull skull-appear';
  skullGif.alt = 'Laughing Skull';
  document.body.appendChild(skullGif);
  
  const audio = new Audio('/spooky_laugh.wav');
  audio.volume = 0.9;
  
  audio.onended = () => {
    if (monitorFrame) {
      monitorFrame.classList.remove('screen-vibrate');
    }
    
    if (skullGif) {
      skullGif.classList.remove('skull-appear');
      skullGif.classList.add('skull-disappear');
      
      skullGif.addEventListener('animationend', () => {
        if (skullGif.parentNode) {
          skullGif.parentNode.removeChild(skullGif);
        }
      }, { once: true });
    }
    
    // Resume background music at NORMAL volume after laugh
    const bgMusic = getBackgroundMusic();
    if (bgMusic) {
      bgMusic.volume = BASE_VOLUME;
      bgMusic.play().catch(e => console.warn("Background music resume failed.", e));
    }
    
    if (callback) callback();
  };
  
  audio.play().catch(e => console.error("Could not play audio:", e));
};

function SeancePage() { // Renamed from App to SeancePage to match file name and standard convention
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micDisabled, setMicDisabled] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [showShareButtons, setShowShareButtons] = useState(false);
  const [notification, setNotification] = useState(null);
  const [prophecyHistory, setProphecyHistory] = useState([]);
  const [unlockedBadges, setUnlockedBadges] = useState([]);
  const [activeEgg, setActiveEgg] = useState(null);
  const [collectedEggs, setCollectedEggs] = useState([]);
  const shareContainerRef = React.useRef(null);
  const navigate = useNavigate();


  // Load history and badges from localStorage on mount
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('prophecyHistory')) || [];
    setProphecyHistory(history);
    const badges = JSON.parse(localStorage.getItem('unlockedBadges')) || [];
    setUnlockedBadges(badges);
    const eggs = JSON.parse(localStorage.getItem('collectedEggs')) || [];
    setCollectedEggs(eggs);
  }, []);

  useEffect(() => {
    controlMusicStart();
    
    const startMusicOnInteraction = () => {
      controlMusicStart();
      window.removeEventListener('click', startMusicOnInteraction);
      
      const input = document.getElementById('query-input');
      if (input) {
        input.addEventListener('focus', controlMusicStart, { once: true });
      }
    };
    
    window.addEventListener('click', startMusicOnInteraction);
    
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.lang = 'en-US';
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      
      recognitionInstance.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setQuery(finalTranscript);
        } else if (interimTranscript) {
          setQuery(interimTranscript);
        }
      };
      
      recognitionInstance.onend = () => {
        setIsRecording(false);
        controlMusicResume();
        
        // Return focus to input field after mic stops
        setTimeout(() => {
          const input = document.getElementById('query-input');
          if (input) {
            input.focus();
          }
        }, 100);
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        controlMusicResume();
        
        // Return focus to input field on error too
        setTimeout(() => {
          const input = document.getElementById('query-input');
          if (input) {
            input.focus();
          }
        }, 100);
      };
      
      setRecognition(recognitionInstance);
    }
    
    return () => {
      window.removeEventListener('click', startMusicOnInteraction);
    };
  }, []);

  // Auto-scroll to share buttons when they appear
  useEffect(() => {
    if (showShareButtons && shareContainerRef.current) {
      setTimeout(() => {
        shareContainerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
        
        // Add highlight pulse effect
        shareContainerRef.current.classList.add('highlight');
        setTimeout(() => {
          if (shareContainerRef.current) {
            shareContainerRef.current.classList.remove('highlight');
          }
        }, 2000);
      }, 300);
    }
  }, [showShareButtons]);

  const toggleMicrophone = () => {
    if (!recognition || micDisabled) {
      if (!micDisabled) console.warn('Speech recognition not supported in this browser.');
      return;
    }
    
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      controlMusicResume();
      
      // Return focus to input after manual stop
      setTimeout(() => {
        const input = document.getElementById('query-input');
        if (input) {
          input.focus();
        }
      }, 100);
    } else {
      // Pause background music when starting mic
      const music = getBackgroundMusic();
      if (music) {
        music.pause();
      }
      
      setIsRecording(true);
      recognition.start();
      
      // Auto-stop after 3 seconds of silence
      setTimeout(() => {
        // Only stop if still recording (i.e., user hasn't manually stopped or final result hasn't come)
        if (isRecording) { 
          recognition.stop();
        }
      }, 3000);
    }
  };

  const showNotification = (message, duration = 3000) => {
    setNotification(message);
    setTimeout(() => setNotification(null), duration);
  };

  const scrollToProphecy = () => {
    setTimeout(() => {
      const prophecyElement = document.querySelector('.result-section');
      if (prophecyElement) {
        prophecyElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }
    }, 500);
  };

  const saveToHistory = (query, prophecy) => {
    const newItem = {
      id: Date.now(),
      query: query,
      cipher: prophecy.cryptic_response,
      interpretation: prophecy.interpretation,
      timestamp: new Date().toISOString()
    };
    const updatedHistory = [newItem, ...prophecyHistory].slice(0, 10);
    setProphecyHistory(updatedHistory);
    localStorage.setItem('prophecyHistory', JSON.stringify(updatedHistory));
  };

  const handleSelectProphecy = (item) => {
    setResult({
      cryptic_response: item.cipher,
      interpretation: item.interpretation
    });
    setShowShareButtons(true);
  };

  const handleDeleteProphecy = (index) => {
    const updatedHistory = prophecyHistory.filter((_, i) => i !== index);
    setProphecyHistory(updatedHistory);
    localStorage.setItem('prophecyHistory', JSON.stringify(updatedHistory));
  };

  const handleClearAll = () => {
    setProphecyHistory([]);
    localStorage.removeItem('prophecyHistory');
  };

  const showBadgePopup = (keyword) => {
    const badgeNames = {
      gopher: 'Gopher Seeker',
      protocol: 'Protocol Scholar',
      ancient: 'Ancient Wisdom',
      kiroween: 'Kiroween Spirit',
      kiro: 'Kiro Champion'
    };
    
    const popup = document.createElement('div');
    popup.className = 'badge-popup';
    popup.innerHTML = `
      <div class="popup-icon">🔮</div>
      <div class="popup-title">Secret Discovered!</div>
      <div class="popup-badge">${badgeNames[keyword]}</div>
    `;
    document.body.appendChild(popup);
    
    setTimeout(() => {
      popup.classList.add('fade-out');
      setTimeout(() => popup.remove(), 500);
    }, 3000);
  };

  const checkAndUnlockBadges = (query) => {
    const keywords = ['kiroween', 'protocol', 'ancient', 'gopher', 'kiro'];
    const unlocked = [...unlockedBadges];
    const newUnlocks = [];
    const queryLower = query.toLowerCase();

    keywords.forEach(keyword => {
      // Use word boundary regex to match exact words only
      const wordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (wordRegex.test(queryLower) && !unlocked.includes(keyword)) {
        unlocked.push(keyword);
        newUnlocks.push(keyword);
      }
    });

    if (newUnlocks.length > 0) {
      setUnlockedBadges(unlocked);
      localStorage.setItem('unlockedBadges', JSON.stringify(unlocked));
      newUnlocks.forEach(showBadgePopup);
    }
  };

  const checkAndSpawnEgg = (userQuery) => {
    const keywords = ['kiroween', 'protocol', 'ancient', 'gopher', 'kiro'];
    const queryLower = userQuery.toLowerCase();
    
    for (const keyword of keywords) {
      // Use word boundary regex to match exact words only
      const wordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (wordRegex.test(queryLower) && !collectedEggs.includes(keyword)) {
        spawnEgg(keyword);
        break;
      }
    }
  };

  const spawnEgg = (keyword) => {
    const eggData = {
      keyword: keyword,
      file: `egg-${keyword}.png`,
      x: Math.random() * (window.innerWidth - 150) + 50,
      y: Math.random() * (window.innerHeight - 150) + 50
    };
    setActiveEgg(eggData);
    
    setTimeout(() => {
      setActiveEgg(prev => {
        if (prev?.keyword === keyword) {
          showNotification('An egg vanished into the void...');
          return null;
        }
        return prev;
      });
    }, 15000);
  };

  const handleEggClick = () => {
    if (!activeEgg) return;
    
    const eggElement = document.querySelector('.easter-egg');
    if (eggElement) {
      eggElement.classList.add('collecting');
    }
    
    setTimeout(() => {
      collectEgg(activeEgg.keyword);
    }, 600);
  };

  const collectEgg = (keyword) => {
    const updated = [...collectedEggs, keyword];
    setCollectedEggs(updated);
    localStorage.setItem('collectedEggs', JSON.stringify(updated));
    setActiveEgg(null);
    showEggCollectionPopup(keyword);
  };

  const showEggCollectionPopup = (keyword) => {
    const badgeNames = {
      gopher: 'Gopher Seeker',
      protocol: 'Protocol Scholar',
      ancient: 'Ancient Wisdom',
      kiroween: 'Kiroween Spirit',
      kiro: 'Kiro Champion'
    };
    
    const popup = document.createElement('div');
    popup.className = 'egg-collect-popup';
    popup.innerHTML = `
      <div class="popup-icon">🥚</div>
      <div class="popup-title">Egg Discovered!</div>
      <div class="popup-badge">${badgeNames[keyword]}</div>
    `;
    document.body.appendChild(popup);
    
    setTimeout(() => {
      popup.classList.add('fade-out');
      setTimeout(() => popup.remove(), 500);
    }, 3000);
  };



  const handleCopyText = async () => {
    if (!result) return;
    
    const prophecyText = `CIPHER:\n${result.cryptic_response}\n\nINTERPRETATION:\n${result.interpretation}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(prophecyText);
        showNotification("The cipher has been copied to thy scroll!");
      } catch (err) {
        console.error('Failed to copy:', err);
        showNotification("The spirits resist! Copy failed.");
      }
    } else {
      showNotification("Thy browser doth not support this sorcery!");
    }
  };

  const captureTerminalImage = async () => {
    const terminalElement = document.querySelector('.result-section');
    if (!terminalElement) {
      showNotification("No prophecy to capture!");
      return null;
    }

    try {
      const canvas = await html2canvas(terminalElement, {
        backgroundColor: '#000000',
        scale: 2,
        logging: false
      });
      return canvas;
    } catch (err) {
      console.error('Screenshot failed:', err);
      showNotification("The image capture hath failed!");
      return null;
    }
  };

  const handleDownloadImage = async () => {
    const canvas = await captureTerminalImage();
    if (!canvas) return;

    const timestamp = new Date().getTime();
    const link = document.createElement('a');
    link.download = `gopher-prophecy-${timestamp}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    showNotification("The prophecy has been captured!");
  };

  const handleTweetThis = async () => {
    if (!result) return;

    try {
      // Step 1: Download the image
      const canvas = await captureTerminalImage();
      if (!canvas) return;

      const timestamp = new Date().getTime();
      const link = document.createElement('a');
      link.download = `gopher-prophecy-${timestamp}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Step 2: Copy full prophecy text to clipboard
      const fullProphecyText = `CIPHER:\n${result.cryptic_response}\n\nMedium's Interpretation:\n${result.interpretation}`;
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullProphecyText);
      }

      // Step 3: Show helpful notification (5 seconds)
      showNotification(
        "The cipher hath been captured! The prophecy text is copied - paste it and attach the downloaded image to thy tweet, mortal!",
        5000
      );

      // Step 4: Open Twitter with short pre-filled text
      const tweetText = encodeURIComponent("I consulted the Gopher Oracle... 🔮👻 #GopherSeance #Kiroween");
      const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
      
      const twitterWindow = window.open(twitterUrl, '_blank', 'width=550,height=420');
      
      if (!twitterWindow) {
        showNotification("The portal was blocked! Allow popups to share.", 3000);
      }
    } catch (error) {
      console.error('Tweet sharing failed:', error);
      showNotification("The spirits resist! Try again, seeker...", 3000);
    }
  };

  const handleSeance = async () => {
    if (!query.trim()) return;

    // Check for badge unlocks
    checkAndUnlockBadges(query);
    
    // Check for egg spawns
    checkAndSpawnEgg(query);

    // Disable microphone during prophecy
    setMicDisabled(true);
    setShowShareButtons(false);
    
    // Start chaos music
    startChaosMusic();
    setLoading(true);
    setResult(null);
    setError(null);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    try {
      const response = await fetch('http://localhost:5000/api/seance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_query: query }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'The nexus rejected the transmission.');
      }

      setResult(data);
      
      // Save to history
      saveToHistory(query, data);
      
      // Stop chaos music when prophecy arrives
      stopChaosMusic();
      
      // Auto-scroll to prophecy output after it appears
      scrollToProphecy();

      const resumeCallback = () => {
        controlMusicResume();
        // Re-enable microphone after everything is done
        setMicDisabled(false);
        // Show share buttons after TTS completes (scroll handled by useEffect)
        setShowShareButtons(true);
      };

      const laughCallback = () => {
        playSpookyLaugh(resumeCallback);
      };

      speakResponse(data.interpretation, laughCallback);
    } catch (err) {
      setError(err.message);
      stopChaosMusic();
      setMusicVolume(BASE_VOLUME);
      setMicDisabled(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="monitor-frame">
      <audio id="bg-music" loop>
        <source src="/spooky_bg_music.wav" type="audio/wav" />
      </audio>
      <audio id="creepy-music" loop>
        <source src="/creepymusic.ogg" type="audio/ogg" />
      </audio>
      
      {activeEgg && (
        <img 
          src={`/easter-egg/${activeEgg.file}`}
          className="easter-egg"
          style={{ left: `${activeEgg.x}px`, top: `${activeEgg.y}px` }}
          onClick={handleEggClick}
          alt="Easter Egg"
        />
      )}
      
      <Sidebar 
        history={prophecyHistory}
        onSelectProphecy={handleSelectProphecy}
        onDeleteProphecy={handleDeleteProphecy}
        onClearAll={handleClearAll}
        className={loading ? 'shaking' : ''}
      />
      
      <button 
        className={`learn-btn ${loading ? 'shaking' : ''}`}
        onClick={() => navigate('/learn')}
      >
        <div className="learn-icon">📚</div>
        <div className="learn-title">SEEK</div>
        <div className="learn-subtitle">Elder Wisdom</div>
      </button>
      
      <BadgeBox 
        collectedEggs={collectedEggs}
        className={loading ? 'shaking' : ''}
      />
      
      <HintBox 
        collectedEggs={collectedEggs}
        className={loading ? 'shaking' : ''}
      />
      
      <div className="monitor-title">
        <ScatteredText text="Prophecy-Ai" /> <span className="title-emoji">🔮</span>
      </div>
      
      <div className={`App ${loading ? 'chaos-active' : ''}`}>
        <h1>
          <ScatteredText text="KIRO-WEEN: The Gopher Séance" /> 👻
        </h1>
        
        <p>
          <ScatteredText text="Consult the Digital Medium. Ask your question and await a cipher from the forgotten net..." />
        </p>

        <div className="query-box">
          <div className="input-container">
            <textarea
              id="query-input"
              placeholder="Hark! What truth do you seek from the digital void?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && query.trim()) {
                  e.preventDefault();
                  handleSeance();
                }
              }}
            />
            <button 
              className={`mic-button ${isRecording ? 'recording' : ''} ${micDisabled ? 'disabled' : ''} ${loading ? 'shaking' : ''}`}
              onClick={toggleMicrophone}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              disabled={micDisabled || !recognition}
              title={micDisabled ? 'Mic disabled during prophecy' : isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {isRecording ? '🔴' : '🎙️'}
            </button>
          </div>
          {isRecording && (
            <p className="recording-indicator">
              <ScatteredText text="The oracle heareth thee..." />
            </p>
          )}
          <button onClick={handleSeance} disabled={loading}>
            <ScatteredText text={loading ? 'Processing...' : 'Summon Cipher'} />
          </button>
        </div>

        <div className="result-box">
          {loading && (
            <p className="output-text">
              <ScatteredText text="The spirits are restless! Awaiting the nexus..." />
            </p>
          )}
          
          {error && (
            <p className="output-text interpretation">
              <ScatteredText text={`ERROR: ${error}`} />
            </p>
          )}
          
          {result && (
            <div className="result-section">
              <h2>
                <ScatteredText text="Cipher Received (Gopher Archive Search Result)" />
              </h2>
              <p className="output-text">
                <ScatteredText text={result.cryptic_response} />
              </p>

              <h2>
                <ScatteredText text="Medium's Interpretation (Steered AI)" />
              </h2>
              <p className="output-text interpretation">
                <ScatteredText text={result.interpretation} />
              </p>
            </div>
          )}
        </div>

        {showShareButtons && result && (
          <div ref={shareContainerRef} className="share-container">
            <h3 className="share-title">
              <ScatteredText text="Share the Prophecy" />
            </h3>
            <div className="share-buttons">
              <button className="share-btn copy-btn" onClick={handleCopyText}>
                📋 <span>Copy Text</span>
              </button>
              <button className="share-btn download-btn" onClick={handleDownloadImage}>
                📸 <span>Download Image</span>
              </button>
              <button className="share-btn tweet-btn" onClick={handleTweetThis}>
                🐦 <span>Tweet This</span>
              </button>
            </div>
          </div>
        )}

        {notification && (
          <div className="notification-toast">
            <ScatteredText text={notification} />
          </div>
        )}

        <p style={{ fontSize: '0.8em', color: '#005517', marginTop: '10px' }}>
          <ScatteredText text="Project built using Kiro Spec-Driven Development (Resurrection Category)." />
        </p>
      </div>
    </div>
  );
}

export default SeancePage;