// assets/js/app.js

// Mock list of your video indexes (You can keep this updated as you add files,
// or write a quick Node/bash script to auto-generate this array from the data/videos folder)
const pythonVideosIndex = [
    { id: "v001", file: "data/videos/v001-intro.json", title: "Introduction to Python and Setup" },
    { id: "v002", file: "data/videos/v002-variables.json", title: "Python Variables and Types" }
    // You will keep appending your files dynamically here
];

// 1. Initialize Homepage Listing
function initHomepage() {
    const grid = document.getElementById("video-grid");
    const searchBar = document.getElementById("search-bar");

    if (!grid) return;

    // Load detailed data for each indexed video to populate cards
    Promise.all(pythonVideosIndex.map(v => fetch(v.file).then(res => res.json())))
        .then(videos => {
            window.allVideosData = videos; // Store globally for search filtering
            renderVideoCards(videos);
        })
        .catch(err => {
            grid.innerHTML = `<div class="error">Failed to load Python Video Catalog. Please make sure the JSON files exist under /data/videos/.</div>`;
            console.error(err);
        });

    // Add Live Search Filter
    searchBar.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = window.allVideosData.filter(video =>
            video.title.toLowerCase().includes(query) ||
            video.description.toLowerCase().includes(query)
        );
        renderVideoCards(filtered);
    });
}

// Render dynamic video grid cards [80]
function renderVideoCards(videos) {
    const grid = document.getElementById("video-grid");
    if (videos.length === 0) {
        grid.innerHTML = `<div class="no-results">No lessons found matching your search.</div>`;
        return;
    }

    grid.innerHTML = videos.map(video => `
        <article class="video-card">
            <div class="video-card-badge">${video.id.toUpperCase()}</div>
            <div class="video-card-content">
                <h3>${video.title}</h3>
                <p>${video.description.substring(0, 100)}...</p>
                <div class="card-meta">
                    <span><i class="fas fa-tasks"></i> Quiz</span>
                    <span><i class="fas fa-project-diagram"></i> Mindmap</span>
                </div>
                <a href="video-player.html?v=${video.id}" class="btn-primary-small">Start Lesson <i class="fas fa-chevron-right"></i></a>
            </div>
        </article>
    `).join('');
}

// 2. Initialize Video Player & Dynamic Assets
function initVideoPlayer() {
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('v');

    if (!videoId) {
        window.location.href = "index.html";
        return;
    }

    // Find video in our indexed files
    const indexEntry = pythonVideosIndex.find(v => v.id === videoId);
    if (!indexEntry) {
        document.body.innerHTML = `<div class="container" style="padding: 100px 0; text-align:center;"><h2>Lesson Not Found</h2><a href="index.html">Back to Home</a></div>`;
        return;
    }

    // Fetch details dynamically
    fetch(indexEntry.file)
        .then(res => res.json())
        .then(video => {
            // Populate text elements [114]
            document.title = `${video.title} | Python Masterclass`;
            document.getElementById("video-title").textContent = video.title;
            document.getElementById("video-badge").textContent = video.id.toUpperCase();
            document.getElementById("video-description").textContent = video.description;
            document.getElementById("video-iframe").src = video.embedUrl;

            // Load Markmap Interactive Mind Map [179]
            if (video.mindmap) {
                renderMindmap(video.mindmap);
            } else {
                document.getElementById("mindmap-tab").innerHTML = `<p class="no-assets">No mind map is available for this lesson yet.</p>`;
            }

            // Load CompSciRocks styled Interactive Quizzes [57]
            if (video.quiz && video.quiz.length > 0) {
                renderQuiz(video.quiz);
            } else {
                document.getElementById("quiz-container").innerHTML = `<p class="no-assets">No quiz available for this lesson yet.</p>`;
            }

            // Load simple Flashcard from Description
            document.getElementById("fc-question").textContent = `Key Term Concept from: ${video.title}`;
            document.getElementById("fc-answer").textContent = video.description;
        })
        .catch(err => {
            console.error("Error loading dynamic lesson:", err);
        });
}

// Render Markdown Markmap Mind Map [179]
function renderMindmap(markdownText) {
    try {
        const svgEl = document.getElementById("markmap-canvas");
        const { Markmap, loadCSS, loadJS } = window.markmap;

        // Render mind map dynamically on SVG
        const root = markmap.Transformer.transform(markdownText);
        svgEl.innerHTML = ""; // Clear loader
        Markmap.create(svgEl, null, root);
    } catch (e) {
        console.error("Failed to render interactive mindmap:", e);
    }
}

// Render Interactive Quiz with Direct Feedback [57]
function renderQuiz(quizArray) {
    const container = document.getElementById("quiz-container");
    container.innerHTML = ""; // Clear loader

    quizArray.forEach((q, idx) => {
        const qDiv = document.createElement("div");
        qDiv.className = "quiz-question-card";

        let answersHtml = "";

        if (q.type === "MC") {
            const options = q.options.split("\n");
            answersHtml = options.map((opt, oIdx) => `
                <label class="quiz-option">
                    <input type="radio" name="q-${idx}" value="${oIdx}">
                    <span>${opt}</span>
                </label>
            `).join('');
        } else if (q.type === "TF") {
            answersHtml = `
                <label class="quiz-option">
                    <input type="radio" name="q-${idx}" value="true">
                    <span>True</span>
                </label>
                <label class="quiz-option">
                    <input type="radio" name="q-${idx}" value="false">
                    <span>False</span>
                </label>
            `;
        }

        qDiv.innerHTML = `
            <h4>Q${idx + 1}: ${q.question}</h4>
            <div class="quiz-options-group">${answersHtml}</div>
            <button class="btn-check-quiz" onclick="checkAnswer(${idx}, '${q.answer}')">Check Answer</button>
            <div id="quiz-feedback-${idx}" class="quiz-feedback hidden"></div>
        `;
        container.appendChild(qDiv);
    });
}

// Validate Selected Quiz Option [57]
function checkAnswer(questionIdx, correctValue) {
    const selected = document.querySelector(`input[name="q-${questionIdx}"]:checked`);
    const feedbackEl = document.getElementById(`quiz-feedback-${questionIdx}`);

    feedbackEl.classList.remove("hidden", "correct", "incorrect");

    if (!selected) {
        feedbackEl.innerHTML = `<span style="color: #dc3545;"><i class="fas fa-exclamation-triangle"></i> Please select an answer first!</span>`;
        feedbackEl.classList.add("incorrect");
        return;
    }

    if (selected.value === correctValue) {
        feedbackEl.innerHTML = `<span style="color: #198754;"><i class="fas fa-check-circle"></i> Correct! Excellent job.</span>`;
        feedbackEl.classList.add("correct");
    } else {
        feedbackEl.innerHTML = `<span style="color: #dc3545;"><i class="fas fa-times-circle"></i> Incorrect. Try again!</span>`;
        feedbackEl.classList.add("incorrect");
    }
}