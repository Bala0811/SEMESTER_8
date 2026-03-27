// ===============================
// AUTH CHECK
// ===============================

if (!localStorage.getItem("currentUser")) {
    // For local dev, comment this out if you're stuck on the login page without auth
    // window.location.href = "auth.html";
}

const currentUser = localStorage.getItem("currentUser") || "guest";
const historyKey = "history_" + currentUser;

// ===============================
// ELEMENTS
// ===============================

let recognition;
let listening = false;

const micBtn = document.getElementById("mic-btn");
const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const langSelect = document.getElementById("lang-select");
const speakBtn = document.getElementById("speak-btn");
const logoutBtn = document.getElementById("logoutBtn");
const autoSpeakCheckbox = document.getElementById("auto-speak");

// Save & Export Buttons (optional stubs)
const saveBtn = document.getElementById("save-btn");
const exportBtn = document.getElementById("export-btn");

// ===============================
// LOGOUT
// ===============================

if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
        localStorage.removeItem("currentUser");
        window.location.href = "auth.html";
    });
}

// ===============================
// SPEECH RECOGNITION
// ===============================

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        listening = true;
        micBtn.classList.add("active");
        inputText.placeholder = "Listening...";
    };

    recognition.onresult = async (event) => {

        const transcript = event.results[0][0].transcript;
        inputText.value = transcript;
        
        outputText.placeholder = "Translating...";

        try {
            const response = await fetch(
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(transcript)}`
            );

            const data = await response.json();
            const translatedText = data[0][0][0];
            outputText.value = translatedText;

            saveToHistory(transcript, translatedText);

            // Trigger auto-speak if checked
            if (autoSpeakCheckbox && autoSpeakCheckbox.checked) {
                speakTranslation(translatedText);
            }

        } catch {
            outputText.value = "Translation failed.";
        }
    };

    recognition.onend = () => stopListening();
    recognition.onerror = () => stopListening();

} else {
    alert("Speech Recognition not supported. Use Chrome or Edge.");
}

// ===============================
// MIC BUTTON
// ===============================

if (micBtn) {
    micBtn.addEventListener("click", () => {
        if (!recognition) return;

        if (!listening) {
            recognition.lang = langSelect.value;
            recognition.start();
        } else {
            stopListening();
        }
    });
}

function stopListening() {
    listening = false;
    if (micBtn) micBtn.classList.remove("active");
    if (inputText && !inputText.value) {
        inputText.placeholder = "Click microphone to start";
    }
    if (outputText && !outputText.value) {
        outputText.placeholder = "Translation will appear here";
    }
    if (recognition) recognition.stop();
}

// ===============================
// TEXT TO SPEECH (ENGLISH)
// ===============================

function speakTranslation(text) {
    if (!('speechSynthesis' in window)) return;
    
    if (!text || text === "Translation failed.") return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    
    // Add visual feedback to button
    if (speakBtn) {
        const icon = speakBtn.querySelector('i');
        icon.classList.remove('fa-volume-up');
        icon.classList.add('fa-volume-up', 'fa-beat-fade');
        speakBtn.style.color = 'var(--accent-red)';
        
        utterance.onend = () => {
            icon.classList.remove('fa-beat-fade');
            icon.classList.add('fa-volume-up');
            speakBtn.style.color = '';
        };
    }

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}

if (speakBtn) {
    speakBtn.addEventListener("click", () => {
        speakTranslation(outputText.value);
    });
}

// ===============================
// BUTTON ACTIONS (Stubs)
// ===============================

if (saveBtn) {
    saveBtn.addEventListener("click", () => {
        if (inputText.value && outputText.value) {
            saveToHistory(inputText.value, outputText.value);
            alert("Translation saved to history!");
        } else {
            alert("Nothing to save yet.");
        }
    });
}

if (exportBtn) {
    exportBtn.addEventListener("click", () => {
        if (!outputText.value) return alert("Nothing to export.");
        const blob = new Blob([`Native: ${inputText.value}\nEnglish: ${outputText.value}`], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "translation.txt";
        a.click();
        URL.revokeObjectURL(url);
    });
}

// ===============================
// HISTORY LOGIC
// ===============================

function saveToHistory(original, translated) {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(historyKey)) || [];
    } catch (e) {
        history = [];
    }
    
    // Prevent duplicate entries (double triggers or double clicks)
    if (history.length > 0 && history[0].original === original && history[0].translated === translated) {
        return; 
    }

    history.unshift({
        original: original,
        translated: translated,
        timestamp: Date.now()
    });
    localStorage.setItem(historyKey, JSON.stringify(history));
}

function renderHistory() {
    const historyList = document.getElementById("historyList");
    if (!historyList) return;

    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(historyKey)) || [];
    } catch (e) {
        history = [];
    }
    historyList.innerHTML = "";
    
    if (history.length === 0) {
        historyList.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); margin-top: 30px; font-size: 0.9rem;">
                <i class="fas fa-history" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i><br>
                No history yet. Start transcribing!
            </div>
        `;
        return;
    }

    const grouped = groupByDate(history);

    Object.keys(grouped).forEach(section => {

        const header = document.createElement("h4");
        header.classList.add("history-section");
        header.innerText = section;
        historyList.appendChild(header);

        grouped[section].forEach(item => {

            const div = document.createElement("div");
            div.classList.add("history-item");

            div.innerHTML = `
                <strong>${truncate(item.original, 35)}</strong>
                <small>${truncate(item.translated, 45)}</small>
            `;

            div.addEventListener("click", () => {
                inputText.value = item.original;
                outputText.value = item.translated;
                // Highlight active item visually
                document.querySelectorAll('.history-item').forEach(el => el.style.borderColor = 'transparent');
                div.style.borderColor = 'var(--accent-primary)';
            });

            historyList.appendChild(div);
        });
    });
}

// ===============================
// GROUPING LOGIC
// ===============================

function groupByDate(history) {

    const groups = {};
    const now = new Date();
    // Normalize current date
    now.setHours(0, 0, 0, 0);

    history.forEach(item => {

        const itemDate = new Date(item.timestamp);
        itemDate.setHours(0, 0, 0, 0);
        
        const diffTime = Math.abs(now - itemDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let label;

        if (diffDays === 0) {
            label = "Today";
        } else if (diffDays === 1) {
            label = "Yesterday";
        } else if (diffDays <= 7) {
            label = "Previous 7 Days";
        } else {
            label = "Older";
        }

        if (!groups[label]) {
            groups[label] = [];
        }

        groups[label].push(item);
    });

    return groups;
}

// ===============================
// UTIL
// ===============================

function truncate(text, length = 40) {
    return text.length > length ? text.substring(0, length) + "..." : text;
}

// ===============================
// INITIALIZATION
// ===============================

// Check intro animation on load
document.addEventListener("DOMContentLoaded", () => {
    // Add staggered entrance to grids if they exist
    const grids = document.querySelectorAll('.text-box-container');
    grids.forEach((grid, index) => {
        grid.style.opacity = '0';
        grid.style.animation = `slideUp 0.6s ease forwards ${index * 0.15 + 0.3}s`;
    });
    
    renderHistory();
});
