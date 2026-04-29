# WarmPause

A real-time, English-language voice-based emotion recognition and response suggestion tool that helps users navigate high-emotion conversations.

## Features

- **Real-time Voice Listening**: Continuously listens to English speech in conversations
- **Emotion Detection**: Detects anger, happy, sadness, and calming emotions
- **AI-Powered Responses**: Generates personalized response suggestions using Deepseek AI
- **Strategy Suggestions**: Provides brief strategy explanations for each response
- **Privacy-First**: Conversations are processed in real-time and not stored
- **Progressive Web App**: Works in mobile browsers with offline support

## How It Works

1. Open the web app in a mobile browser
2. Tap "Start Listening" to begin listening mode
3. The app listens to the other person's English speech
4. When high-conflict emotions are detected, it whispers a response suggestion
5. Use the suggestion as a guide while responding in your own words
6. Tap "Stop Listening" when done

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Speech Recognition**: Web Speech API
- **Speech Synthesis**: Web Speech Synthesis API
- **AI Backend**: Deepseek API
- **PWA**: Service Workers for offline support

## Setup

1. Clone or download the project files
2. Open `index.html` in a modern browser (Chrome, Edge, or Safari recommended)
3. Allow microphone access when prompted
4. Start listening to conversations

## Browser Support

- Chrome (recommended)
- Edge
- Safari
- Firefox (limited support)

## Privacy

WarmPause processes conversations in real-time and does not store any conversation data. All processing happens through the Web Speech API and Deepseek API with your API key.

## License

MIT License
