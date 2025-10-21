# Voice Feedback Feature Documentation

This document explains how the voice feedback feature was built for the Comments & Feedback section, including both frontend and backend parts.

---

## 1. Frontend: HTML Structure

A feedback section was added at the bottom of `Home.html`:

```html
<div class="feedback-section">
    <h2>Comments & Feedback</h2>
    <textarea id="feedbackBox" rows="5" placeholder="Type your feedback or use the mic..."></textarea>
    <br/>
    <button id="micButton">🎤</button>
    <span>Voice Typing</span>
    <button id="submitButton">Submit</button>
    <span id="micStatus"></span>
</div>
```

- **`textarea`**: For typed or spoken feedback.

- **Mic button**: Starts/stops voice recognition.

- **Submit button**: Sends feedback to backend.

- **Status span**: Shows messages (listening, errors, etc).

---

## 2. Frontend: JavaScript (`feedback.js`)

### a. Speech Recognition Setup

```js
// Try to use the browser's SpeechRecognition API (works in Chrome, Edge, etc.)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
    micButton.disabled = true;
    micStatus.textContent = 'Voice typing not supported in this browser.';
    return;
}
const recognition = new SpeechRecognition();
recognition.continuous = true;      // Keep listening until stopped
recognition.interimResults = true;  // Show partial (not-yet-final) results as you speak
recognition.lang = 'en-US';         // Set language to English (US)
```

- Checks for browser support and sets up the recognition object.


### b. Mic Button: Start/Stop Listening

```js
let listening = false;      // Tracks if we're currently listening
let fullTranscript = '';    // Stores all finalized speech-to-text

micButton.addEventListener('click', function() {
    if (!listening) {
        recognition.start();                    // Start listening
        listening = true;
        micButton.style.background = '#d1f7c4'; // Change button color to indicate active
        micStatus.textContent = 'Listening... Click again to stop.';
        fullTranscript = feedbackBox.value;     // Keep any existing text
    } else {
        recognition.stop();                     // Stop listening
        listening = false;
        micButton.style.background = '#eee';    // Reset button color
        micStatus.textContent = 'Stopped.';
    }
});
```

- Clicking the mic toggles listening. UI feedback (color, status) helps the user know what’s happening.


### c. Handling Speech Results

```js
recognition.onresult = function(event) {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            fullTranscript += event.results[i][0].transcript; // Add finalized speech
        } else {
            interimTranscript += event.results[i][0].transcript; // Show live, not-yet-final speech
        }
    }
    feedbackBox.value = fullTranscript + interimTranscript; // Show both in the textarea
};
```

- Final results are added to `fullTranscript` (they won’t disappear).

- Interim results are shown live, but not saved until finalized.


### d. Error Handling and Auto-Restart

```js
recognition.onerror = function(event) {
    micStatus.textContent = 'Error: ' + event.error;
    micButton.style.background = '#eee';
    listening = false;
};

recognition.onend = function() {
    if (listening) {
        recognition.start(); // If stopped unexpectedly, restart (for continuous listening)
    }
};
```

- Handles errors (e.g., no mic access).

- If the browser stops listening unexpectedly, it restarts automatically (unless you stopped it).


### e. Submitting Feedback to the Backend (with Timezone)

```js
submitButton.addEventListener('click', function() {
    const feedback = feedbackBox.value.trim();
    if (feedback) {
        fetch('http://localhost:3001/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: feedback, timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                feedbackBox.value = '';
                fullTranscript = '';
                micStatus.textContent = 'Feedback submitted!';
            } else {
                micStatus.textContent = 'Error: Could not submit feedback.';
            }
        })
        .catch(() => {
            micStatus.textContent = 'Error: Could not connect to server.';
        });
    } else {
        micStatus.textContent = 'Please enter feedback before submitting.';
    }
});
```

- When you click Submit, it sends the feedback and timestamp (in Asia/Kolkata timezone) to the backend using `fetch`.

- If successful, clears the textarea and shows a success message.

- If not, shows an error.


#### **About Timezones in JavaScript**

- By default, `new Date().toLocaleString()` uses the browser's local timezone, which may not always match your system clock or your desired timezone.
- To ensure consistency, you can specify a timezone explicitly using the `timeZone` option.
- Example:

```js
// UTC
new Date().toLocaleString('en-US', { timeZone: 'UTC' })

// India Standard Time
new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })

// US Eastern Time
new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })

// Japan Standard Time
new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
```

- You can find a full list of valid timezone strings here: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

---

## 3. Backend: Node.js/Express (`backend/server.js`)

### a. Setup and Middleware

```js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;
const FEEDBACK_FILE = path.join(__dirname, 'feedbacks.json');

app.use(cors());           // Allow requests from other origins (like your frontend)
app.use(express.json());   // Parse JSON request bodies
```

- Sets up Express and required modules.

- Enables CORS for local development.

- Parses incoming JSON data.


### b. Ensure Feedback File Exists

```js
if (!fs.existsSync(FEEDBACK_FILE)) {
    fs.writeFileSync(FEEDBACK_FILE, '[]', 'utf8');
}
```

- If the feedback file doesn’t exist, create it as an empty JSON array.


### c. POST /feedback Endpoint

```js
app.post('/feedback', (req, res) => {
    const { text, timestamp } = req.body;
    if (!text || !timestamp) {
        return res.status(400).json({ error: 'Missing text or timestamp' });
    }
    let feedbacks = [];
    try {
        feedbacks = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
    } catch (e) {}
    feedbacks.push({ text, timestamp });
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2), 'utf8');
    res.json({ success: true });
});
```

- Receives feedback from the frontend.

- Validates that both text and timestamp are present.

- Reads the current feedbacks from the file.

- Adds the new feedback.

- Writes the updated array back to the file.

- Responds with `{ success: true }`.


### d. Start the Server

```js
app.listen(PORT, () => {
    console.log(`Feedback server running on http://localhost:${PORT}`);
});
```

- Starts the server on port 3001 and logs a message.


---

## 4. How Everything Connects

- User speaks or types feedback → Mic button uses Web Speech API to transcribe speech in real time.

- User clicks Submit → JavaScript sends feedback to backend using fetch.

- Backend receives feedback → Appends it to `feedbacks.json` in the backend folder.

- You can open `feedbacks.json` anytime to see all feedbacks.


---

## 5. Why Each Step Matters

- **SpeechRecognition**: Converts voice to text, making feedback easier and more accessible.

- **fetch**: Lets the browser talk to your server without reloading the page.

- **Express/CORS**: Handles incoming feedback and allows cross-origin requests during development.

- **File I/O**: Stores feedback persistently so you can review it later.


--- 