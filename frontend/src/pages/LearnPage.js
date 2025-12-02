import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import '../LearnPage.css';

const LearnPage = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecordingLearn, setIsRecordingLearn] = useState(false);
  const [recognitionLearn, setRecognitionLearn] = useState(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const inputRef = useRef(null); // Reference for the input field

  // --- SPEECH RECOGNITION SETUP ---
  useEffect(() => {
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
        setIsRecordingLearn(false);
        // Return focus to input field after mic stops
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecordingLearn(false);
        // Return focus to input field on error too
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      };
      
      setRecognitionLearn(recognitionInstance);
    }
  }, []);
  
  const toggleMicrophoneLearn = () => {
    if (!recognitionLearn || loading) {
      if (!recognitionLearn) console.warn('Speech recognition not supported in this browser.');
      return;
    }
    
    if (isRecordingLearn) {
      recognitionLearn.stop();
      setIsRecordingLearn(false);
      
      // Return focus to input after manual stop
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    } else {
      setIsRecordingLearn(true);
      recognitionLearn.start();
      
      // Auto-stop after 3 seconds of silence
      setTimeout(() => {
        if (isRecordingLearn) {
          recognitionLearn.stop();
        }
      }, 3000);
    }
  };

  // Welcome message on mount
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: 'Welcome to the Gopher Archive Learning Portal. I can help you understand:\n\n• Gopher protocol history and technical details\n• Differences between old and modern technologies\n• Internet evolution from 1990s to today\n• Vintage computing and protocols\n\nWhat would you like to learn about?',
      timestamp: new Date().toISOString()
    }]);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

 const handleSubmit = async (e) => {
  e.preventDefault();
  if (!query.trim()) return;
  
  // Stop recording if active before submitting
  if (isRecordingLearn) {
    recognitionLearn.stop();
  }
  
  const userMessage = { role: 'user', content: query, timestamp: new Date().toISOString() };
  setMessages(prev => [...prev, userMessage]);
  setQuery('');
  setLoading(true);
  setError(null);
  
  try {
    const response = await fetch('http://localhost:5000/api/learn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) throw new Error('Failed to get response');
    
    const data = await response.json();
    console.log('Learn API data:', data); // Debug log
    
    const assistantMessage = { 
      role: 'assistant', 
      content: data.response || 'No response from archive.',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, assistantMessage]);
    
  } catch (err) {
    setError('Unable to connect to archive. Please try again.');
    console.error('Learn API error:', err);
  } finally {
    setLoading(false);
  }
};


  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Copy all conversation text
  const handleCopyText = () => {
    const conversationText = messages.map(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const role = msg.role === 'user' ? 'YOU' : 'ARCHIVE';
      return `[${time}] ${role}:\n${msg.content}\n`;
    }).join('\n');

    navigator.clipboard.writeText(conversationText).then(() => {
      showNotification('Conversation copied to clipboard!');
    });
  };

  // Download conversation as PDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const lineHeight = 7;
    let yPosition = margin;

    // Title
    doc.setFontSize(16);
    doc.setFont('courier', 'bold');
    doc.text('GOPHER ARCHIVE - LEARNING SESSION', margin, yPosition);
    yPosition += 10;

    // Timestamp
    doc.setFontSize(10);
    doc.setFont('courier', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
    yPosition += 10;

    // Line separator
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Messages
    doc.setFontSize(10);
    messages.forEach((msg, index) => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const role = msg.role === 'user' ? 'YOU' : 'ARCHIVE';

      // Check if need new page
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      // Message header
      doc.setFont('courier', 'bold');
      doc.text(`[${time}] ${role}:`, margin, yPosition);
      yPosition += lineHeight;

      // Message content
      doc.setFont('courier', 'normal');
      const lines = doc.splitTextToSize(msg.content, pageWidth - 2 * margin);
      lines.forEach(line => {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += lineHeight;
      });

      yPosition += 5; // Space between messages
    });

    // Save PDF
    const filename = `gopher-archive-${Date.now()}.pdf`;
    doc.save(filename);
    showNotification('PDF downloaded successfully!');
  };

  const showNotification = (message) => {
    const notification = document.createElement('div');
    notification.className = 'learn-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 2500);
  };

  return (
    <div className="learn-page">
      {/* CRT Background effect */}
      <div className="crt-background"></div>
      <div className="crt-scanlines"></div>

      {/* Top navigation bar */}
      <div className="learn-nav">
        <button 
          className="back-to-seance-btn"
          onClick={() => navigate('/')}
        >
          ← BACK TO SÉANCE
        </button>
        
        <div className="learn-actions">
          <button 
            className="action-btn copy-btn"
            onClick={handleCopyText}
            disabled={messages.length <= 1}
          >
            📋 COPY TEXT
          </button>
          <button 
            className="action-btn pdf-btn"
            onClick={handleDownloadPDF}
            disabled={messages.length <= 1}
          >
            📄 DOWNLOAD PDF
          </button>
        </div>
      </div>

      {/* Main terminal container */}
      <div className="learn-container">
        <div className="learn-terminal">
          {/* Header */}
          <div className="learn-header">
            <div className="terminal-top-bar">
              <div className="terminal-buttons">
                <span className="btn-red"></span>
                <span className="btn-yellow"></span>
                <span className="btn-green"></span>
              </div>
              <div className="terminal-title">GOPHER_ARCHIVE.EXE</div>
            </div>
            <h1 className="learn-title">📚 GOPHER ARCHIVE</h1>
            <p className="learn-subtitle">Learn About Internet History & Technology</p>
          </div>

          {/* Chat messages area */}
          <div className="learn-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-bubble ${msg.role}`}>
                <div className="bubble-header">
                  <span className="bubble-role">
                    {msg.role === 'user' ? '👤 YOU' : '📚 ARCHIVE'}
                  </span>
                  <span className="bubble-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="bubble-content">{msg.content}</div>
              </div>
            ))}

            {loading && (
              <div className="chat-bubble assistant loading-bubble">
                <div className="bubble-header">
                  <span className="bubble-role">📚 ARCHIVE</span>
                </div>
                <div className="bubble-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="loading-text">Searching archives...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="learn-error-message">
                ⚠️ {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input form */}
          <div className="learn-input-area">
            <form className="learn-input-form" onSubmit={handleSubmit}>
              <div className="input-with-mic"> {/* New container for input and mic */}
                <input
                  type="text"
                  className="learn-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about technology, protocols, internet history..."
                  disabled={loading}
                  autoFocus
                  ref={inputRef}
                />
                <button 
                  type="button" 
                  className={`learn-mic-btn ${isRecordingLearn ? 'recording' : ''}`}
                  onClick={toggleMicrophoneLearn}
                  disabled={loading || !recognitionLearn}
                  title={isRecordingLearn ? 'Stop recording' : 'Start voice input'}
                >
                  {isRecordingLearn ? '🔴' : '🎙️'}
                </button>
              </div>
              
              <button 
                type="submit" 
                className="learn-submit-btn"
                disabled={loading || !query.trim()}
              >
                {loading ? '⏳' : '📤'} ASK
              </button>
            </form>
            {isRecordingLearn && (
              <p className="learn-recording-indicator">
                The archive heareth thee...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearnPage;