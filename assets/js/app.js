// Master Client-Side JavaScript Controller - Dynamic Personal HQ & Learning System
// Integrates client-side Routing, Supabase database bindings, Markmap visual rendering, and Admin CRUD.

// --- 1. CONFIGURATION & CLIENT INIT ---
// Replace these with your actual Supabase Project configuration values
const SUPABASE_URL = "https://ysxugzbvkhdtvfsitwgm.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_7_TwI8LtnGBJDDXEhIJnog_okv8a1QK";

let supabase = null;
try {
    if (typeof supabasejs !== 'undefined') {
        supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        supabase = window['@supabase/supabase-js']?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.warn("Supabase SDK initialization warning. Make sure variables are updated with proper keys.", e);
}

// --- 2. CLIENT-SIDE ROUTER ---
const routes = {
    'home': 'page-home',
    'about': 'page-about',
    'projects': 'page-projects',
    'content': 'page-content',
    'learning': 'page-learning',
    'contact': 'page-contact',
    'admin': 'page-admin'
};

function router() {
    let hash = window.location.hash.substring(1) || 'home';

    // Resolve route parameters if necessary (e.g. learning?lesson=slug)
    let params = {};
    if (hash.includes('?')) {
        const parts = hash.split('?');
        hash = parts[0];
        const rawParams = parts[1].split('&');
        rawParams.forEach(p => {
            const kv = p.split('=');
            params[kv[0]] = kv[1];
        });
    }

    const targetPageId = routes[hash] || 'page-home';

    // Hide all view panels
    document.querySelectorAll('.page-view').forEach(panel => {
        panel.classList.add('hidden');
    });

    // Show active page panel
    const targetPage = document.getElementById(targetPageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }

    // Toggle active navigation states
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-route') === hash) {
            link.classList.add('active', 'text-white', 'border-b-2', 'border-blue-500');
            link.classList.remove('text-zinc-400');
        } else {
            link.classList.remove('active', 'text-white', 'border-b-2', 'border-blue-500');
            link.classList.add('text-zinc-400');
        }
    });

    // Close mobile menu on route swap
    document.getElementById('mobileMenu').classList.add('hidden');

    // Section specific load hooks
    executePageLifecycle(hash, params);
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
    router();
    setupGlobalEventListeners();
});


// --- 3. DYNAMIC LIFECYCLE HOOKS ---
function executePageLifecycle(route, params) {
    switch(route) {
        case 'home':
            loadHomepageFeatured();
            break;
        case 'about':
            loadAboutProfile();
            break;
        case 'projects':
            loadProjectsShowcase();
            break;
        case 'content':
            loadContentLibrary(params.filter || 'all');
            break;
        case 'learning':
            loadLearningHub(params.lesson);
            break;
        case 'admin':
            checkAdminSession();
            break;
    }
}


// --- 4. DATA FETCHING METHODS (Grounded in Schema) ---
async function loadHomepageFeatured() {
    const grid = document.getElementById('featuredCourseGrid');
    if (!grid) return;

    if (!supabase) {
        grid.innerHTML = getSupabaseWarningHTML();
        return;
    }

    // Fetch featured courses or videos
    const { data: featured, error } = await supabase
        .from('courses')
        .select('*')
        .eq('status', 'published')
        .limit(3);

    if (error || !featured || featured.length === 0) {
        grid.innerHTML = `<div class="col-span-3 text-zinc-500 text-sm text-center py-6">No featured courses populated. Sign in to Admin to add records.</div>`;
        return;
    }

    grid.innerHTML = featured.map(course => `
        <div class="vercel-card flex flex-col justify-between">
            <div class="space-y-3">
                <div class="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 text-lg">
                    <i class="fa-solid fa-graduation-cap"></i>
                </div>
                <h3 class="font-bold text-lg text-white">${course.title}</h3>
                <p class="text-sm text-zinc-400 line-clamp-3">${course.description}</p>
            </div>
            <a href="#learning?course=${course.slug}" class="mt-4 text-xs font-semibold text-blue-400 hover:text-white flex items-center space-x-1">
                <span>Start Learning</span><i class="fa-solid fa-arrow-right text-[10px]"></i>
            </a>
        </div>
    `).join('');
}

async function loadAboutProfile() {
    const list = document.getElementById('achievementsList');
    if (!list) return;

    if (!supabase) {
        return;
    }

    const { data: achievements, error } = await supabase
        .from('achievements')
        .select('*')
        .order('date_achieved', { ascending: false });

    if (error || !achievements || achievements.length === 0) return;

    list.innerHTML = achievements.map(ach => `
        <div class="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <i class="fa-solid fa-award text-yellow-500 text-lg"></i>
                <div>
                    <p class="font-semibold text-sm">${ach.title}</p>
                    <p class="text-xs text-zinc-500">${ach.description}</p>
                </div>
            </div>
            <span class="text-xs font-mono text-zinc-500">${ach.date_achieved}</span>
        </div>
    `).join('');
}

async function loadProjectsShowcase() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    if (!supabase) {
        grid.innerHTML = getSupabaseWarningHTML();
        return;
    }

    const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !projects || projects.length === 0) {
        grid.innerHTML = `<div class="col-span-3 text-zinc-500 text-sm text-center py-12">No portfolio projects uploaded. Add them via Admin.</div>`;
        return;
    }

    grid.innerHTML = projects.map(proj => `
        <div class="vercel-card flex flex-col justify-between">
            <div class="space-y-4">
                <div class="flex justify-between items-start">
                    <span class="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">${proj.status}</span>
                    <div class="flex space-x-2 text-zinc-400">
                        ${proj.github_url ? `<a href="${proj.github_url}" target="_blank" class="hover:text-white"><i class="fa-brands fa-github"></i></a>` : ''}
                        ${proj.project_url ? `<a href="${proj.project_url}" target="_blank" class="hover:text-white"><i class="fa-solid fa-up-right-from-square"></i></a>` : ''}
                    </div>
                </div>
                <div>
                    <h3 class="font-bold text-lg text-white mb-2">${proj.title}</h3>
                    <p class="text-sm text-zinc-400 line-clamp-4">${proj.summary}</p>
                </div>
            </div>
            <div class="mt-6 flex flex-wrap gap-1.5">
                ${proj.tags ? proj.tags.map(tag => `<span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-500 border border-zinc-800">${tag}</span>`).join('') : ''}
            </div>
        </div>
    `).join('');
}

async function loadContentLibrary(filter) {
    const grid = document.getElementById('contentLibraryGrid');
    if (!grid) return;

    if (!supabase) {
        grid.innerHTML = getSupabaseWarningHTML();
        return;
    }

    grid.innerHTML = '<div class="col-span-3 py-12 flex justify-center"><i class="fa-solid fa-spinner animate-spin text-2xl text-blue-500"></i></div>';

    let contentItems = [];

    // Depending on active category filter tab, build dynamic fetches
    if (filter === 'all' || filter === 'videos') {
        const { data: videos } = await supabase.from('videos').select('*').eq('status', 'published');
        if (videos) contentItems.push(...videos.map(v => ({...v, contentType: 'video'})));
    }
    if (filter === 'all' || filter === 'playlists') {
        const { data: playlists } = await supabase.from('playlists').select('*');
        if (playlists) contentItems.push(...playlists.map(p => ({...p, contentType: 'playlist'})));
    }
    if (filter === 'all' || filter === 'articles') {
        const { data: posts } = await supabase.from('posts').select('*').eq('status', 'published');
        if (posts) contentItems.push(...posts.map(p => ({...p, contentType: 'article'})));
    }

    if (contentItems.length === 0) {
        grid.innerHTML = `<div class="col-span-3 text-zinc-500 text-sm text-center py-12">No media assets found matching the filter option.</div>`;
        return;
    }

    grid.innerHTML = contentItems.map(item => {
        if (item.contentType === 'video') {
            return `
                <div class="vercel-card flex flex-col justify-between">
                    <div class="space-y-3">
                        <div class="aspect-video rounded bg-black relative border border-zinc-800 overflow-hidden">
                            <img src="https://img.youtube.com/vi/${item.youtube_id}/mqdefault.jpg" class="w-full h-full object-cover opacity-85 hover:scale-105 transition-transform" />
                            <span class="absolute bottom-2 right-2 text-[10px] font-mono bg-zinc-950/80 px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-400">${item.duration || '00:00'}</span>
                        </div>
                        <h3 class="font-bold text-base line-clamp-2">${item.title}</h3>
                        <p class="text-xs text-zinc-500 line-clamp-3">${item.description || ''}</p>
                    </div>
                    <a href="#learning?lesson=${item.slug}" class="mt-4 text-xs font-semibold text-blue-400 hover:text-white flex items-center space-x-1">
                        <span>Go to Lesson Player</span><i class="fa-solid fa-play text-[8px] ml-1"></i>
                    </a>
                </div>
            `;
        } else if (item.contentType === 'playlist') {
            return `
                <div class="vercel-card flex flex-col justify-between border-l-4 border-l-purple-600">
                    <div class="space-y-3">
                        <div class="w-10 h-10 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                            <i class="fa-solid fa-list-ul"></i>
                        </div>
                        <h3 class="font-bold text-base">${item.title}</h3>
                        <p class="text-xs text-zinc-500 line-clamp-3">${item.description || ''}</p>
                    </div>
                    <a href="#content?filter=playlists" class="mt-4 text-xs font-semibold text-purple-400 hover:text-white flex items-center space-x-1">
                        <span>View Playlist</span><i class="fa-solid fa-arrow-right text-[8px] ml-1"></i>
                    </a>
                </div>
            `;
        } else {
            return `
                <div class="vercel-card flex flex-col justify-between border-l-4 border-l-emerald-600">
                    <div class="space-y-3">
                        <div class="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <i class="fa-solid fa-file-invoice"></i>
                        </div>
                        <h3 class="font-bold text-base line-clamp-2">${item.title}</h3>
                        <p class="text-xs text-zinc-500 line-clamp-3">${item.excerpt}</p>
                    </div>
                    <button onclick="viewArticleModal('${item.slug}')" class="mt-4 text-left text-xs font-semibold text-emerald-400 hover:text-white flex items-center space-x-1">
                        <span>Read Article</span><i class="fa-solid fa-book-open text-[8px] ml-1"></i>
                    </button>
                </div>
            `;
        }
    }).join('');
}

async function loadLearningHub(activeLessonSlug) {
    const syllabus = document.getElementById('courseSyllabusContainer');
    if (!syllabus) return;

    if (!supabase) {
        syllabus.innerHTML = getSupabaseWarningHTML();
        return;
    }

    // Fetch Syllabus (Courses -> Modules -> Lessons)
    const { data: modules, error } = await supabase
        .from('course_modules')
        .select(`
            id, title, position,
            lessons ( id, title, slug, video_id, position )
        `)
        .order('position', { ascending: true });

    if (error || !modules || modules.length === 0) {
        syllabus.innerHTML = `<div class="text-zinc-500 text-xs text-center py-6">Syllabus is empty. Initialize via the Admin workspace.</div>`;
        return;
    }

    // Render Expandable Modules
    syllabus.innerHTML = modules.map(mod => {
        // Sort sub-lessons by position
        const sortedLessons = mod.lessons ? mod.lessons.sort((a,b) => a.position - b.position) : [];

        return `
            <div class="space-y-1.5 border-b border-zinc-800 pb-3">
                <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-500 px-1.5 py-1 mb-1 flex items-center space-x-1">
                    <i class="fa-solid fa-folder-open text-[10px] text-zinc-600"></i>
                    <span>${mod.title}</span>
                </h4>
                <div class="space-y-1 pl-1">
                    ${sortedLessons.map(les => `
                        <a href="#learning?lesson=${les.slug}"
                           class="syllabus-lesson-btn block w-full text-left px-2.5 py-1.5 rounded text-xs transition-all hover:bg-zinc-800 flex items-center justify-between group ${les.slug === activeLessonSlug ? 'bg-blue-600/10 text-blue-400 font-semibold border-l-2 border-l-blue-500' : 'text-zinc-400'}"
                           data-slug="${les.slug}">
                           <span class="truncate pr-4">${les.title}</span>
                           <i class="fa-solid fa-circle-play text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    // Load active lesson or show welcome screen
    if (activeLessonSlug) {
        document.getElementById('learningHubWelcome').classList.add('hidden');
        document.getElementById('activeLessonViewer').classList.remove('hidden');
        loadLessonDetail(activeLessonSlug);
    } else {
        document.getElementById('learningHubWelcome').classList.remove('hidden');
        document.getElementById('activeLessonViewer').classList.add('hidden');
    }
}

async function loadLessonDetail(slug) {
    if (!supabase) return;

    const { data: lesson, error } = await supabase
        .from('lessons')
        .select(`
            *,
            videos ( youtube_id, duration )
        `)
        .eq('slug', slug)
        .single();

    if (error || !lesson) return;

    // Load Title & Duration
    document.getElementById('lessonTitle').textContent = lesson.title;
    document.getElementById('lessonDuration').textContent = lesson.videos?.duration || '00:00';

    // Embed Video Iframe
    const videoIframe = document.getElementById('lessonVideoIframe');
    if (lesson.videos?.youtube_id) {
        videoIframe.src = `https://www.youtube.com/embed/${lesson.videos.youtube_id}?enablejsapi=1&rel=0`;
    } else {
        videoIframe.src = '';
    }

    // Dynamic Educational Assets Tab initialization
    renderMindmapTab(lesson.mindmap_markdown);
    renderQuizTab(lesson.quizzes_json);
    renderFlashcardsTab(lesson.flashcards_json);
    renderResourcesTab(lesson.resources_json);
}


// --- 5. INTERACTIVE EDUCATIONAL MODULE ENGINES ---

// A. Mindmap Rendering (Markmap)
function renderMindmapTab(markdownContent) {
    const svgEl = document.getElementById('markmap-svg');
    if (!svgEl) return;
    svgEl.innerHTML = ''; // reset

    if (!markdownContent) {
        svgEl.innerHTML = '<text x="50%" y="50%" fill="#a1a1aa" text-anchor="middle" font-size="12" font-family="sans-serif">No custom mind map configured for this lesson yet.</text>';
        return;
    }

    try {
        const { Transformer, Markmap } = window.markmap;
        const transformer = new Transformer();
        const { root } = transformer.transform(markdownContent);
        Markmap.create('#markmap-svg', null, root);
    } catch (e) {
        console.error("Markmap rendering error", e);
    }
}

// B. Quiz Interface Generator (Using local implementation for browser offline stability)
function renderQuizTab(quizData) {
    const root = document.getElementById('mdq-quiz-root');
    if (!root) return;
    root.innerHTML = '';

    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        root.innerHTML = '<p class="text-xs text-zinc-500 font-mono">No quiz is set up for this lesson module.</p>';
        return;
    }

    // Self-grading interactive form generator
    root.innerHTML = quizData.questions.map((q, qIndex) => `
        <div class="question-block border border-zinc-800 bg-zinc-950 p-5 rounded-lg mb-4 space-y-3">
            <h5 class="font-bold text-sm text-zinc-200">Q${qIndex + 1}: ${q.question}</h5>
            <div class="space-y-2">
                ${q.options.map((opt, oIndex) => `
                    <label class="flex items-center space-x-3 px-3 py-2 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs transition-colors">
                        <input type="radio" name="q_${qIndex}" value="${oIndex}" class="text-blue-500 focus:ring-0">
                        <span>${opt}</span>
                    </label>
                `).join('')}
            </div>
            <div id="feedback_${qIndex}" class="hidden text-xs font-semibold py-1 rounded"></div>
        </div>
    `).join('') + `
        <button id="submitQuizBtn" onclick="gradeLocalQuiz(${JSON.stringify(quizData.questions).replace(/"/g, '&quot;')})" class="btn-primary text-xs py-2 w-full mt-4">Verify Answers</button>
    `;
}

window.gradeLocalQuiz = function(questions) {
    let score = 0;
    questions.forEach((q, qIndex) => {
        const selected = document.querySelector(`input[name="q_${qIndex}"]:checked`);
        const feedback = document.getElementById(`feedback_${qIndex}`);
        feedback.classList.remove('hidden', 'text-green-400', 'text-red-400');

        if (selected) {
            const answerIndex = parseInt(selected.value);
            if (answerIndex === q.correct_index) {
                score++;
                feedback.textContent = `✓ Correct! ${q.explanation || ''}`;
                feedback.classList.add('text-green-400');
            } else {
                feedback.textContent = `✗ Incorrect. Correct answer: "${q.options[q.correct_index]}". ${q.explanation || ''}`;
                feedback.classList.add('text-red-400');
            }
        } else {
            feedback.textContent = `⚠ Please select an answer.`;
            feedback.classList.add('text-zinc-500');
            feedback.classList.remove('hidden');
        }
    });
};

// C. Flashcards Flipping System
let currentCardIndex = 0;
let lessonFlashcards = [];

function renderFlashcardsTab(cards) {
    const container = document.getElementById('flashcard-container');
    if (!container) return;
    container.innerHTML = '';

    if (!cards || cards.length === 0) {
        container.innerHTML = '<p class="text-xs text-zinc-500 font-mono">No practice flash cards mapped for this lesson.</p>';
        return;
    }

    lessonFlashcards = cards;
    currentCardIndex = 0;
    showFlashcard(0);
}

function showFlashcard(index) {
    const container = document.getElementById('flashcard-container');
    if (lessonFlashcards.length === 0) return;

    const card = lessonFlashcards[index];
    container.innerHTML = `
        <div class="flashcard-wrapper" onclick="this.classList.toggle('flipped')">
            <div class="flashcard-inner">
                <div class="flashcard-front">
                    <span class="text-xs text-zinc-500 font-mono tracking-widest uppercase mb-4">Question</span>
                    <p class="font-bold text-sm text-center text-white">${card.front}</p>
                    <span class="text-[10px] text-zinc-600 mt-6"><i class="fa-solid fa-rotate-left mr-1"></i>Click to reveal</span>
                </div>
                <div class="flashcard-back">
                    <span class="text-xs text-sky-400 font-mono tracking-widest uppercase mb-4">Answer Explanation</span>
                    <p class="text-sm font-semibold text-center">${card.back}</p>
                </div>
            </div>
        </div>
        <div class="flex items-center space-x-6 mt-4 text-xs font-mono text-zinc-400">
            <button onclick="prevFlashcard()" class="hover:text-white" ${index === 0 ? 'disabled opacity-30' : ''}><i class="fa-solid fa-chevron-left mr-1"></i>Prev</button>
            <span>${index + 1} / ${lessonFlashcards.length}</span>
            <button onclick="nextFlashcard()" class="hover:text-white" ${index === lessonFlashcards.length - 1 ? 'disabled opacity-30' : ''}>Next<i class="fa-solid fa-chevron-right ml-1"></i></button>
        </div>
    `;
}

window.prevFlashcard = function() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        showFlashcard(currentCardIndex);
    }
};

window.nextFlashcard = function() {
    if (currentCardIndex < lessonFlashcards.length - 1) {
        currentCardIndex++;
        showFlashcard(currentCardIndex);
    }
};

// D. Resources List Renderer
function renderResourcesTab(resources) {
    const list = document.getElementById('lessonResourcesList');
    if (!list) return;
    list.innerHTML = '';

    if (!resources || resources.length === 0) {
        list.innerHTML = '<li class="text-xs text-zinc-500 font-mono">No supplementary resources uploaded for this session.</li>';
        return;
    }

    list.innerHTML = resources.map(res => `
        <li class="p-3 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between hover:border-zinc-700 transition-colors">
            <div class="flex items-center space-x-3">
                <i class="fa-solid fa-file-code text-blue-400 text-base"></i>
                <span class="text-xs font-semibold text-zinc-200">${res.title}</span>
            </div>
            <a href="${res.url}" target="_blank" class="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400 hover:text-white font-mono flex items-center space-x-1">
                <span>Download</span><i class="fa-solid fa-arrow-down text-[8px]"></i>
            </a>
        </li>
    `).join('');
}


// --- 6. SECURED CREATOR ADMIN BACKEND (CMS CRUD) ---
let currentAdminTab = 'videos';
let loadedAdminData = [];

async function checkAdminSession() {
    const authContainer = document.getElementById('adminAuthContainer');
    const workspace = document.getElementById('adminWorkspace');
    if (!authContainer || !workspace) return;

    if (!supabase) {
        authContainer.innerHTML = getSupabaseWarningHTML();
        return;
    }

    const { data: session } = await supabase.auth.getSession();
    if (session && session.session) {
        authContainer.classList.add('hidden');
        workspace.classList.remove('hidden');
        loadAdminUserMetadata(session.session.user);
        loadAdminContentList();
    } else {
        authContainer.classList.remove('hidden');
        workspace.classList.add('hidden');
    }
}

async function loadAdminUserMetadata(user) {
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    document.getElementById('adminUserDisplayName').textContent = profile?.full_name || user.email;
}

async function loadAdminContentList() {
    const tbody = document.getElementById('adminCMSTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-6"><i class="fa-solid fa-spinner animate-spin text-blue-500"></i></td></tr>';

    const { data, error } = await supabase
        .from(currentAdminTab)
        .select('*');

    if (error) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-xs text-red-400 py-6">Database Fetch Error: ${error.message}</td></tr>`;
        return;
    }

    loadedAdminData = data;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-zinc-500 text-xs py-6">No records populated in table yet.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(item => `
        <tr class="hover:bg-zinc-900/50">
            <td class="px-4 py-3 font-semibold text-white max-w-xs truncate">${item.title || item.name || 'Untitled'}</td>
            <td class="px-4 py-3 font-mono text-xs text-zinc-500">${item.slug || item.id}</td>
            <td class="px-4 py-3 text-right space-x-1">
                <button onclick="editAdminRecord('${item.id}')" class="text-blue-500 hover:text-white text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-blue-600 transition-colors"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteAdminRecord('${item.id}')" class="text-red-500 hover:text-white text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-600 transition-colors"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>
    `).join('');
}


// --- 7. UX ENHANCEMENTS (CMD+K / TAB SWITCHES) ---
function setupGlobalEventListeners() {
    // Mobile Nav Drawer Toggle
    const mobileToggle = document.getElementById('mobileNavToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileToggle && mobileMenu) {
        mobileToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Command Palette hotkey listen
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            toggleCommandPalette();
        }
        if (e.key === 'Escape') {
            document.getElementById('commandPalette').classList.add('hidden');
        }
    });

    document.getElementById('searchTrigger')?.addEventListener('click', toggleCommandPalette);
    document.getElementById('cmdCloseBtn')?.addEventListener('click', () => {
        document.getElementById('commandPalette').classList.add('hidden');
    });

    // Asset Tabs Swapping inside lesson viewer
    document.querySelectorAll('.asset-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const activeTab = e.currentTarget.getAttribute('data-tab');
            document.querySelectorAll('.asset-tab').forEach(t => {
                t.classList.remove('text-blue-500', 'border-b-2', 'border-blue-500');
                t.classList.add('text-zinc-400');
            });
            e.currentTarget.classList.add('text-blue-500', 'border-b-2', 'border-blue-500');

            document.querySelectorAll('.asset-tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(`asset-${activeTab}`).classList.remove('hidden');
        });
    });

    // Admin Tabs Swapping
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.admin-nav-btn').forEach(b => {
                b.classList.remove('text-blue-400', 'bg-blue-500/10', 'font-semibold');
                b.classList.add('text-zinc-400');
            });
            e.currentTarget.classList.add('text-blue-400', 'bg-blue-500/10', 'font-semibold');

            currentAdminTab = e.currentTarget.getAttribute('data-tab');
            document.getElementById('adminActionSectionTitle').textContent = `Manage ${currentAdminTab.charAt(0).toUpperCase() + currentAdminTab.slice(1)}`;
            loadAdminContentList();
        });
    });

    // Content Library Filter Tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tab').forEach(t => {
                t.classList.remove('bg-blue-600', 'text-white');
                t.classList.add('text-zinc-400');
            });
            e.currentTarget.classList.add('bg-blue-600', 'text-white');
            loadContentLibrary(e.currentTarget.getAttribute('data-filter'));
        });
    });

    // Admin Sign in bindings
    document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLogin);
    document.getElementById('adminLogoutBtn')?.addEventListener('click', handleAdminLogout);
}

function toggleCommandPalette() {
    const cp = document.getElementById('commandPalette');
    cp.classList.toggle('hidden');
    if (!cp.classList.contains('hidden')) {
        document.getElementById('cmdInput').focus();
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    if (!supabase) return;

    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert(`Authentication Failed: ${error.message}`);
    } else {
        checkAdminSession();
    }
}

async function handleAdminLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    checkAdminSession();
}

// Global warning markup if variables are blank
function getSupabaseWarningHTML() {
    return `
        <div class="col-span-3 p-6 text-center rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-yellow-400 text-xs font-mono max-w-lg mx-auto">
            <i class="fa-solid fa-triangle-exclamation text-lg mb-2 block"></i>
            <h4 class="font-bold mb-1">Database Sync Key Required</h4>
            <p>To load lessons dynamically, set your actual cloud instance <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> credentials in <code>assets/js/app.js</code>.</p>
        </div>
    `;
}