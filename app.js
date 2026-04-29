// Deepseek API Configuration
const DEEPSEEK_API_KEY = 'sk-b99e22d1ee134b0dbfb40de44fc83e40';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// State management
let isListening = false;
let recognition = null;
let synthesis = null;
let conversationHistory = [];
let currentEmotion = null;
let currentStrategy = null;

// Web Audio API variables
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let audioFeatures = {
    volume: [],
    pitch: [],
    tempo: [],
    lastTime: Date.now()
};

// DOM Elements
const toggleListeningBtn = document.getElementById('toggleListening');
const speakResponseBtn = document.getElementById('speakResponse');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const emotionDisplay = document.getElementById('emotionDisplay');
const responseDisplay = document.getElementById('responseDisplay');
const historyList = document.getElementById('historyList');
const responseText = document.getElementById('responseText');
const strategyText = document.getElementById('strategyText');
const userSpeechDisplay = document.getElementById('userSpeechDisplay');

// Emotion display elements
const finalEmotion = document.getElementById('finalEmotion');
const volumeValue = document.getElementById('volumeValue');
const pitchValue = document.getElementById('pitchValue');
const varianceValue = document.getElementById('varianceValue');

// Initialize speech recognition
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert('Your browser does not support speech recognition. Please use Chrome, Edge, or Safari.');
        return null;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
        console.log('Speech recognition started');
    };
    
    recognition.onend = () => {
        console.log('Speech recognition ended');
        if (isListening) {
            recognition.start();
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            alert('Microphone access denied. Please enable microphone permissions.');
            stopListening();
        }
    };
    
    recognition.onresult = (event) => {
        // Get the last result (interim or final)
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        
        console.log('Recognized:', transcript);
        
        // Skip empty or silence input
        if (!transcript || transcript.trim() === '') {
            console.log('Empty speech detected, skipping analysis');
            return;
        }
        
        // Only process if it's a final result
        if (result.isFinal) {
            showUserSpeech(transcript);
            processSpeech(transcript);
        }
    };
    
    return recognition;
}

// Show user's speech on screen
function showUserSpeech(text) {
    if (userSpeechDisplay) {
        userSpeechDisplay.textContent = text;
        userSpeechDisplay.classList.remove('hidden');
    }
}

// Initialize speech synthesis
function initSpeechSynthesis() {
    if ('speechSynthesis' in window) {
        synthesis = window.speechSynthesis;
        return true;
    }
    return false;
}

// Initialize Web Audio API for real-time audio analysis
function initAudioAnalysis() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create analyser node
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        // Get microphone input
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                microphone = audioContext.createMediaStreamSource(stream);
                microphone.connect(analyser);
                
                // Create data array for frequency analysis
                dataArray = new Uint8Array(analyser.frequencyBinCount);
                
                console.log('Audio analysis initialized');
                startAudioLoop();
            })
            .catch(err => {
                console.error('Error accessing microphone:', err);
                alert('Could not access microphone for audio analysis. Please enable microphone permissions.');
            });
    } catch (e) {
        console.error('Web Audio API not supported:', e);
    }
}

// Audio analysis loop
function startAudioLoop() {
    if (!analyser || !dataArray) return;
    
    const updateInterval = 500; // Update every 500ms
    
    setInterval(() => {
        if (!isListening) return;
        
        // Get frequency data
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate volume (RMS)
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        
        // Calculate average frequency (pitch indicator)
        let weightedSum = 0;
        let totalWeight = 0;
        for (let i = 0; i < dataArray.length; i++) {
            weightedSum += i * dataArray[i];
            totalWeight += dataArray[i];
        }
        const avgFrequency = totalWeight > 0 ? weightedSum / totalWeight : 0;
        
        // Calculate tempo (changes in volume)
        const currentTime = Date.now();
        const timeDelta = currentTime - audioFeatures.lastTime;
        audioFeatures.lastTime = currentTime;
        
        // Store features
        audioFeatures.volume.push(rms);
        audioFeatures.pitch.push(avgFrequency);
        audioFeatures.tempo.push(timeDelta);
        
        // Keep only last 10 samples
        if (audioFeatures.volume.length > 10) {
            audioFeatures.volume.shift();
            audioFeatures.pitch.shift();
            audioFeatures.tempo.shift();
        }
        
        // Analyze emotion based on audio features
        analyzeEmotionFromAudio();
        
    }, updateInterval);
}

// Analyze emotion based on audio features
function analyzeEmotionFromAudio() {
    if (audioFeatures.volume.length < 3) return;
    
    // Calculate averages
    const avgVolume = audioFeatures.volume.reduce((a, b) => a + b, 0) / audioFeatures.volume.length;
    const avgPitch = audioFeatures.pitch.reduce((a, b) => a + b, 0) / audioFeatures.pitch.length;
    const avgTempo = audioFeatures.tempo.reduce((a, b) => a + b, 0) / audioFeatures.tempo.length;
    
    // Calculate variance (indicates emotional intensity)
    const volumeVariance = audioFeatures.volume.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / audioFeatures.volume.length;
    
    // Normalize values for better comparison
    const normalizedVolume = Math.min(avgVolume / 128, 1); // Max 255
    const normalizedPitch = Math.min(avgPitch / 128, 1);   // Max 128 bins
    const normalizedVariance = Math.min(volumeVariance / 1000, 1);
    
    // Score each emotion based on audio characteristics
    // Based on research: angry = high volume, high variance; sad = low volume, low pitch; etc.
    const scores = {
        angry: normalizedVolume * 0.6 + normalizedVariance * 0.5 + normalizedPitch * 0.1,
        fearful: normalizedPitch * 0.5 + normalizedVariance * 0.4 + (1 - normalizedVolume) * 0.1,
        sad: (1 - normalizedVolume) * 0.6 + (1 - normalizedPitch) * 0.3 + normalizedVariance * 0.1,
        happy: normalizedVolume * 0.4 + normalizedPitch * 0.5 + normalizedVariance * 0.3,
        calm: (1 - normalizedVolume) * 0.2 + (1 - normalizedPitch) * 0.2 + (1 - normalizedVariance) * 0.1, // Reduced calm score
        neutral: 0.05 + (1 - normalizedVariance) * 0.15, // Lower base score
        surprised: normalizedVariance * 0.7 + normalizedPitch * 0.3 + normalizedVolume * 0.1,
        disgusted: (1 - normalizedPitch) * 0.3 + normalizedVariance * 0.4 + (1 - normalizedVolume) * 0.2
    };
    
    // Normalize scores to 0-100
    const maxScore = Math.max(...Object.values(scores));
    const emotionScores = {};
    for (const [emotion, score] of Object.entries(scores)) {
        emotionScores[emotion] = Math.min(Math.round((score / maxScore) * 100), 100);
    }
    
    console.log('Audio features - Volume:', avgVolume.toFixed(2), 'Pitch:', avgPitch.toFixed(2), 'Variance:', volumeVariance.toFixed(2));
    console.log('Emotion scores:', emotionScores);
    
    // Determine dominant emotion
    const dominantEmotion = Object.entries(emotionScores)
        .sort((a, b) => b[1] - a[1])[0][0];
    
    console.log('Dominant emotion:', dominantEmotion);
    
    // If all scores are very low, default to "happy"
    if (maxScore < 0.3) {
        updateEmotionDisplay('happy', avgVolume, avgPitch, volumeVariance);
        currentEmotion = 'happy';
        emotionDisplay.classList.remove('hidden');
        return;
    }
    
    // Update display with final emotion and audio features
    updateEmotionDisplay(dominantEmotion, avgVolume, avgPitch, volumeVariance);
    
    // Set current emotion
    currentEmotion = dominantEmotion;
    
    // Show emotion display
    emotionDisplay.classList.remove('hidden');
}
function startListening() {
    if (!recognition) {
        recognition = initSpeechRecognition();
        if (!recognition) return;
    }
    
    // Initialize audio analysis if not already done
    if (!audioContext) {
        initAudioAnalysis();
    }
    
    // Resume audio context if suspended (browser policy)
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    isListening = true;
    toggleListeningBtn.innerHTML = '<span class="icon">🛑</span><span class="text">Stop Listening</span>';
    toggleListeningBtn.classList.replace('btn-primary', 'btn-secondary');
    toggleListeningBtn.style.backgroundColor = 'var(--danger-color)';
    toggleListeningBtn.style.color = 'white';
    
    statusIndicator.className = 'status-indicator listening';
    statusIndicator.innerHTML = '<span class="dot"></span><span class="label">Listening...</span>';
    statusText.textContent = 'Listening to the conversation...';
    
    emotionDisplay.classList.add('hidden');
    responseDisplay.classList.add('hidden');
    
    if (userSpeechDisplay) {
        userSpeechDisplay.classList.add('hidden');
    }
    
    try {
        recognition.start();
    } catch (e) {
        console.error('Error starting recognition:', e);
    }
}

// Stop listening
function stopListening() {
    isListening = false;
    
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.error('Error stopping recognition:', e);
        }
    }
    
    // Close audio context
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    toggleListeningBtn.innerHTML = '<span class="icon">🎤</span><span class="text">Start Listening</span>';
    toggleListeningBtn.classList.replace('btn-secondary', 'btn-primary');
    toggleListeningBtn.style.backgroundColor = '';
    toggleListeningBtn.style.color = '';
    
    statusIndicator.className = 'status-indicator inactive';
    statusIndicator.innerHTML = '<span class="dot"></span><span class="label">Ready to listen</span>';
    statusText.textContent = 'Tap the microphone to start listening to the conversation';
    
    // Disable buttons when stopping
    speakResponseBtn.disabled = true;
    
    if (currentEmotion) {
        addToHistory(currentEmotion, responseText.textContent, currentStrategy);
        currentEmotion = null;
        currentStrategy = null;
    }
}

// Process speech and analyze emotion
async function processSpeech(transcript) {
    // Skip empty or silence input
    if (!transcript || transcript.trim() === '') {
        console.log('Empty speech detected, skipping analysis');
        return;
    }
    
    // Add to conversation history
    conversationHistory.push({ role: 'user', content: transcript });
    
    // Keep only last 10 messages to avoid token limits
    if (conversationHistory.length > 10) {
        conversationHistory = conversationHistory.slice(-10);
    }
    
    // Show loading state
    statusText.innerHTML = 'Analyzing conversation... <span class="loading"></span>';
    
    try {
        // Call Deepseek API with detected emotion + transcript
        const result = await analyzeWithDeepseek(transcript, currentEmotion);
        
        if (result) {
            currentStrategy = result.strategy;
            
            // Update emotion display with detected emotion from audio
            updateEmotionDisplay(currentEmotion, 0, 0, 0);
            
            // Update response display
            responseText.textContent = result.response;
            strategyText.textContent = result.strategy;
            
            responseDisplay.classList.remove('hidden');
            
            // Enable speak button
            speakResponseBtn.disabled = false;
            
            // Auto-speak the response
            console.log('Auto-speaking response:', result.response);
            speakResponse(result.response);
        } else {
            console.log('No result from Deepseek API');
        }
    } catch (error) {
        console.error('Error processing speech:', error);
        statusText.textContent = 'Error analyzing conversation. Please try again.';
    }
}

// Analyze with Deepseek API
async function analyzeWithDeepseek(transcript, detectedEmotion) {
    const systemPrompt = `You are WarmPause, an emotion-aware conversation assistant. Your task is to:
1. Analyze the emotional state of the speaker using these emotions (pay more attention to the emotion than what they said)
2. Provide a brief strategy explanation
3. Generate a complete English response sentence that helps de-escalate or improve the conversation

Return your response in JSON format with these fields:
- emotion: one of "neutral", "calm", "happy", "sad", "angry", "fearful", "disgusted", "surprised"
- strategy: brief strategy explanation (1-2 sentences)
- response: complete English response sentence
- emotionScores: object with scores for all 8 emotions (neutral, calm, happy, sad, angry, fearful, disgusted, surprised) - each score should be 0-100

Example output:
{
  "emotion": "angry",
  "strategy": "Use validation to acknowledge their feelings without agreeing with their position",
  "response": "I can see this is really frustrating for you, and I want to understand where you're coming from.",
  "emotionScores": {"neutral": 5, "calm": 10, "happy": 5, "sad": 15, "angry": 70, "fearful": 10, "disgusted": 5, "surprised": 20}
}`;

    // Include detected emotion from Web Audio API in the prompt
    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-5).map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: `Current statement: "${transcript}". Detected emotion from voice analysis: ${detectedEmotion}. Please use this as context for your response.` }
    ];

    console.log('Sending to Deepseek:', {
        url: DEEPSEEK_API_URL,
        model: 'deepseek-chat',
        messages: messages.length,
        detectedEmotion: detectedEmotion
    });

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
        })
    });

    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Deepseek API error response:', errorText);
        throw new Error(`Deepseek API error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    console.log('Deepseek response data:', data);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from Deepseek API');
    }

    const content = data.choices[0].message.content;
    console.log('Response content:', content);
    
    // Parse JSON from response
    try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Could not parse JSON from response');
    } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Raw response:', content);
        throw new Error('Failed to parse AI response');
    }
}

// Update emotion display
function updateEmotionDisplay(dominantEmotion, volume, pitch, variance) {
    // Show final emotion
    if (finalEmotion) {
        finalEmotion.textContent = dominantEmotion ? dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1) : '-';
    }
    
    // Show audio features
    if (volumeValue) {
        volumeValue.textContent = volume ? volume.toFixed(1) : '-';
    }
    if (pitchValue) {
        pitchValue.textContent = pitch ? pitch.toFixed(1) : '-';
    }
    if (varianceValue) {
        varianceValue.textContent = variance ? variance.toFixed(1) : '-';
    }
}

// Speak response using speech synthesis
function speakResponse(text) {
    if (!synthesis) {
        console.log('Speech synthesis not available');
        return;
    }
    
    console.log('Speaking response:', text);
    
    // Cancel any ongoing speech
    synthesis.cancel();
    
    // Stop voice recognition while speaking
    if (recognition && isListening) {
        try {
            recognition.stop();
            console.log('Voice recognition stopped for speaking');
        } catch (e) {
            console.error('Error stopping recognition:', e);
        }
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.7;
    
    utterance.onstart = () => {
        console.log('Speaking response');
    };
    
    utterance.onend = () => {
        console.log('Finished speaking');
        // Restart voice recognition after speaking
        if (isListening && recognition) {
            try {
                recognition.start();
                console.log('Voice recognition restarted');
            } catch (e) {
                console.error('Error restarting recognition:', e);
            }
        }
    };
    
    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
    };
    
    synthesis.speak(utterance);
}

// Add to history
function addToHistory(emotion, response, strategy) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    const emotionClass = emotion || 'calm';
    
    historyItem.innerHTML = `
        <span class="emotion-tag ${emotionClass}">${emotion ? emotion.charAt(0).toUpperCase() + emotion.slice(1) : 'Unknown'}</span>
        <div class="response">${response}</div>
        <div class="strategy">${strategy}</div>
    `;
    
    historyList.prepend(historyItem);
    
    if (historyList.children.length > 10) {
        historyList.lastElementChild.remove();
    }
}

// Event listeners
toggleListeningBtn.addEventListener('click', () => {
    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
});

speakResponseBtn.addEventListener('click', () => {
    // Stop speaking when button is clicked
    if (synthesis) {
        synthesis.cancel();
        console.log('Speech stopped');
    }
});

// Initialize on load
window.addEventListener('load', () => {
    initSpeechSynthesis();
    
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
});

// Service Worker registration for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err => console.error('Service Worker registration failed:', err));
}
