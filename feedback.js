// feedback.js
window.addEventListener('DOMContentLoaded', function() {
    const micButton = document.getElementById('micButton');
    const feedbackBox = document.getElementById('feedbackBox');
    const micStatus = document.getElementById('micStatus');
    let recognition;
    let listening = false;
    let fullTranscript = '';

    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        micButton.disabled = true;
        micStatus.textContent = 'Voice typing not supported in this browser.';
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    micButton.addEventListener('click', function() {
        if (!listening) {
            recognition.start();
            listening = true;
            micButton.style.background = '#d1f7c4';
            micStatus.textContent = 'Listening... Click again to stop.';
            fullTranscript = feedbackBox.value; // preserve any existing text
        } else {
            recognition.stop();
            listening = false;
            micButton.style.background = '#eee';
            micStatus.textContent = 'Stopped.';
        }
    });

    recognition.onresult = function(event) {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                fullTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        feedbackBox.value = fullTranscript + interimTranscript;
    };

    recognition.onerror = function(event) {
        micStatus.textContent = 'Error: ' + event.error;
        micButton.style.background = '#eee';
        listening = false;
    };

    recognition.onend = function() {
        if (listening) {
            recognition.start(); // Auto-restart if stopped unexpectedly
        }
    };

    // Submit button logic
    const submitButton = document.getElementById('submitButton');
    if (submitButton) {
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
    }
}); 