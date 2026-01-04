# CV Coach - NotebookLM-Style CV Walkthrough

An AI-powered CV improvement tool that provides an immersive, podcast-like walkthrough experience with voice narration and visual effects.

![CV Coach Demo](https://via.placeholder.com/800x400/1e1b4b/ffffff?text=CV+Coach+Demo)

## ✨ Features

- **🎙️ Voice Narration**: AI coach explains each improvement conversationally
- **📊 Visual Before/After**: See changes with animated transitions
- **💯 Score Impact**: Track how each change contributes to your match score
- **🎬 Presentation Mode**: Full-screen immersive experience
- **⏯️ Playback Controls**: Play, pause, skip, and replay any section

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- An API key from OpenAI or Anthropic

### Installation

```bash
# Clone or download this project
cd cv-coach-project

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will open at `http://localhost:3000`

### Usage

1. **Enter your API key** (OpenAI or Anthropic)
2. **Paste the job description** you're targeting
3. **Paste your CV/resume** content
4. Click **"Start Walkthrough"**
5. Watch & listen as the AI coach walks through each improvement

## 🔑 API Keys

### OpenAI
Get your API key from: https://platform.openai.com/api-keys

### Anthropic
Get your API key from: https://console.anthropic.com/

Your API key is stored locally in your browser and never sent anywhere except directly to the AI provider.

## 📁 Project Structure

```
cv-coach-project/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          # Main application component
│   ├── main.jsx         # Entry point
│   └── index.css        # Styles with Tailwind
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 🛠️ Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Web Speech API** - Voice narration
- **Web Audio API** - Sound effects

## 🎨 Customization

### Change the AI Coach

Edit the `hosts` object in `src/App.jsx`:

```javascript
const hosts = {
  main: {
    name: 'Your Coach Name',
    avatar: '👩‍💼',  // Any emoji
    color: '#3B82F6',
    voice: { pitch: 1.0, rate: 1.0 }
  }
};
```

### Add New Categories

Edit the `categoryStyles` object:

```javascript
const categoryStyles = {
  yourCategory: {
    bg: '#FEE2E2',
    text: '#DC2626',
    bar: '#EF4444',
    light: '#FEF2F2',
    gradient: 'from-red-500 to-rose-600',
    icon: '✓',
    label: 'Your Category Label'
  }
};
```

### Modify Voice Settings

In the `speak` function, adjust:
- `rate`: Speed (0.5 - 2.0)
- `pitch`: Voice pitch (0.5 - 2.0)
- `volume`: Volume (0 - 1.0)

## 🔧 Build for Production

```bash
npm run build
```

The built files will be in the `dist/` folder.

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Known Issues

- Voice narration may not work in all browsers (best support in Chrome/Edge)
- Some browsers require user interaction before playing audio

## 📧 Support

If you encounter any issues, please open an issue on GitHub or contact support.

---

Built with ❤️ for job seekers everywhere
