// Master Controller Engine - Dynamic Premium Personal HQ (Version 5)
// Fully routes between Administrator Console, Gated Student Dashboards, and protects personal portfolio values.

// --- 1. CONFIGURATION & CLIENT INIT ---
// Swap these placeholders with your actual Supabase Project Key/URL
const SUPABASE_URL = "https://ysxugzbvkhdtvfsitwgm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7_TwI8LtnGBJDDXEhIJnog_okv8a1QK";

let supabaseClient = null;
try {
    if (typeof supabasejs !== 'undefined') {
        supabaseClient = supabasejs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        supabaseClient = window['@supabase/supabase-js']?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.warn("Supabase SDK initialization warning.", e);
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

let currentPortalViewMode = 'student'; // 'student' or 'admin' depending on dropdown click

function router() {
    let hash = window.location.hash.substring(1) || 'home';
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
    document.querySelectorAll('.page-view').forEach(panel => panel.classList.add('hidden'));
    const targetPage = document.getElementById(targetPageId);
    if (targetPage) targetPage.classList.remove('hidden');

    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-route') === hash) {
            link.classList.add('active', 'text-white', 'border-b-2', 'border-blue-500');
            link.classList.remove('text-zinc-400');
        } else {
            link.classList.remove('active', 'text-white', 'border-b-2', 'border-blue-500');
            link.classList.add('text-zinc-400');
        }
    });

    document.getElementById('mobileMenu')?.classList.add('hidden');
    executePageLifecycle(hash, params);
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
    router();
    loadGlobalProfile(); // Hard locks brand to the verified Admin account
    setupGlobalEventListeners();
});

function executePageLifecycle(route, params) {
    switch(route) {
        case 'home': loadHomepageFeatured(); break;
        case 'about': loadAboutProfile(); break;
        case 'projects': loadProjectsShowcase(); break;
        case 'content': loadContentLibrary(params.filter || 'all'); break;
        case 'learning': loadLearningHub(params.lesson); break;
        case 'admin': checkPortalSession(); break;
    }
}

// Global toggle for Portal Header Access Dropdown
window.togglePortalDropdown = function(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('portalDropdownMenu');
    dropdown.classList.toggle('hidden');
};

window.triggerPortalRoute = function(role) {
    currentPortalViewMode = role;
    const dropdown = document.getElementById('portalDropdownMenu');
    dropdown.classList.add('hidden');

    // Smooth navigation into page admin with targeted layout triggers
    window.location.hash = "admin";
    updateAuthInterfaceForSelectedRole();
};

document.addEventListener('click', () => {
    document.getElementById('portalDropdownMenu')?.classList.add('hidden');
});

// Update standard Auth container header states based on selected Portal mode
function updateAuthInterfaceForSelectedRole() {
    const authHeaderTitle = document.getElementById('authHeaderTitle');
    const authHeaderSubtitle = document.getElementById('authHeaderSubtitle');
    const authHeaderIcon = document.getElementById('authHeaderIcon');
    const submitBtn = document.getElementById('adminSubmitBtn');

    // Elements to show or hide completely for security
    const authToggle = document.getElementById('authModeToggleContainer');
    const oauthDivider = document.getElementById('oauthDivider');
    const googleBtn = document.getElementById('googleOAuthBtn');

    if (currentPortalViewMode === 'admin') {
        authHeaderTitle.textContent = "Creator Portal";
        authHeaderSubtitle.textContent = "Authorized portfolio & curriculum administrator space.";
        authHeaderIcon.className = "fa-solid fa-user-shield text-purple-500 text-3xl mb-2";
        submitBtn.textContent = "Login to Console";

        // Hide new registration tools on admin login to secure endpoint
        if (authToggle) authToggle.classList.add('hidden');
        if (oauthDivider) oauthDivider.classList.add('hidden');
        if (googleBtn) googleBtn.classList.add('hidden');
    } else {
        authHeaderTitle.textContent = "Student Workspace";
        authHeaderSubtitle.textContent = "Register credentials or login with Google to unlock course materials.";
        authHeaderIcon.className = "fa-solid fa-graduation-cap text-blue-500 text-3xl mb-2";
        submitBtn.textContent = isSignUpMode ? "Register Student Account" : "Access Workspace";

        if (authToggle) authToggle.classList.remove('hidden');
        if (oauthDivider) oauthDivider.classList.remove('hidden');
        if (googleBtn) googleBtn.classList.remove('hidden');
    }
}

// --- 3. DYNAMIC DEVICE UPLOAD TRIGGER ---
async function uploadDeviceFile(fileInputId, targetUrlInputId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    try {
        const urlInput = document.getElementById(targetUrlInputId);
        if (urlInput) urlInput.value = "Uploading file... please wait...";

        const { data, error } = await supabaseClient.storage
            .from('assets')
            .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabaseClient.storage
            .from('assets')
            .getPublicUrl(filePath);

        if (urlInput) {
            urlInput.value = publicUrl;
        }
        alert("Success! The image was successfully saved to your storage bucket, and is now linked to your form!");
    } catch (err) {
        alert(`Device file upload failed: ${err.message}. (Ensure bucket "assets" exists in Supabase and is public!)`);
    }
}

// --- 4. HARD-LOCKED DYNAMIC PROFILE SYNC (PORTFOLIO LOCK) ---
async function loadGlobalProfile() {
    if (!supabaseClient) return;

    try {
        // ALWAYS loads the verified admin profile to represent the portfolio
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('is_admin', true)
            .limit(1)
            .maybeSingle();

        if (error || !profile) return;

        // Keep homepage card and about me details locked to your personal details
        const heroName = document.getElementById('heroProfileName');
        if (heroName) heroName.textContent = `"${profile.full_name}"`;

        const aboutDP = document.getElementById('aboutProfileDP');
        const aboutIcon = document.getElementById('aboutProfileUserIcon');
        const aboutName = document.getElementById('aboutProfileName');
        const aboutBio = document.getElementById('aboutProfileBio');

        if (aboutName) aboutName.textContent = profile.full_name;
        if (aboutBio && profile.bio) {
            aboutBio.innerHTML = typeof marked !== 'undefined' ? marked.parse(profile.bio) : profile.bio.replace(/\n/g, '<br>');
        }

        if (aboutDP && aboutIcon) {
            if (profile.avatar_url && profile.avatar_url.trim() !== '') {
                aboutDP.src = profile.avatar_url;
                aboutDP.classList.remove('hidden');
                aboutIcon.classList.add('hidden');
            } else {
                aboutDP.classList.add('hidden');
                aboutIcon.classList.remove('hidden');
            }
        }

        const ghLink = document.getElementById('profileGithubLink');
        const liLink = document.getElementById('profileLinkedinLink');
        const ytLink = document.getElementById('profileYoutubeLink');

        if (ghLink) {
            if (profile.github_link && profile.github_link.trim() !== '') {
                ghLink.href = profile.github_link;
                ghLink.classList.remove('hidden');
            } else {
                ghLink.classList.add('hidden');
            }
        }
        if (liLink) {
            if (profile.linkedin_link && profile.linkedin_link.trim() !== '') {
                liLink.href = profile.linkedin_link;
                liLink.classList.remove('hidden');
            } else {
                liLink.classList.add('hidden');
            }
        }
        if (ytLink) {
            if (profile.youtube_link && profile.youtube_link.trim() !== '') {
                ytLink.href = profile.youtube_link;
                ytLink.classList.remove('hidden');
            } else {
                ytLink.classList.add('hidden');
            }
        }
    } catch (e) {
        console.warn("Global profile load exception.", e);
    }
}

// --- 5. DATA FETCHING METHODS ---
async function loadHomepageFeatured() {
    const grid = document.getElementById('featuredCourseGrid');
    if (!grid) return;
    if (!supabaseClient) { grid.innerHTML = getSupabaseWarningHTML(); return; }

    const { data: featured, error } = await supabaseClient
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
    loadGlobalProfile();
    const list = document.getElementById('achievementsList');
    if (!list) return;

    if (!supabaseClient) return;

    const { data: achievements, error } = await supabaseClient
        .from('achievements')
        .select('*')
        .order('date_achieved', { ascending: false });

    if (error || !achievements || achievements.length === 0) {
        list.innerHTML = `<div class="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800 text-center text-xs text-zinc-500 font-mono py-6">No milestones recorded yet. Add them in your Admin panel!</div>`;
        return;
    }

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
    if (!supabaseClient) { grid.innerHTML = getSupabaseWarningHTML(); return; }

    const { data: projects, error } = await supabaseClient
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
                    ${proj.image_url ? `<div class="aspect-video w-full rounded border border-zinc-850 overflow-hidden mb-3"><img src="${proj.image_url}" class="w-full h-full object-cover"/></div>` : ''}
                    <h3 class="font-bold text-lg text-white mb-2">${proj.title}</h3>
                    <p class="text-xs text-zinc-500 line-clamp-2 mb-4">${proj.summary}</p>

                    <button onclick="viewProjectDetails('${proj.id}')" class="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold text-zinc-300 w-full text-center transition-colors">
                        <i class="fa-solid fa-circle-info mr-1"></i>View Full Specifications
                    </button>
                </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-1.5">
                ${proj.tags ? proj.tags.map(tag => `<span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-500 border border-zinc-800">${tag}</span>`).join('') : ''}
            </div>
        </div>
    `).join('');
}

window.viewProjectDetails = async function(projectId) {
    if (!supabaseClient) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert("🔐 Members Only: Please register a student account or log in to view project technical write-ups.");
        window.location.hash = "admin";
        triggerPortalRoute('student');
        return;
    }

    const { data: project, error } = await supabaseClient
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

    if (error || !project) {
        alert("Failed to load details: " + error.message);
        return;
    }

    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4";
    modal.id = "temp-project-modal";

    const processedDesc = typeof marked !== 'undefined' ? marked.parse(project.description || '*No detailed specifications recorded.*') : (project.description || '');

    modal.innerHTML = `
        <div class="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div class="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
                <h3 class="font-bold text-base text-white">${project.title}</h3>
                <button onclick="document.getElementById('temp-project-modal').remove()" class="text-zinc-500 hover:text-white text-xs px-2.5 py-1.5 rounded bg-zinc-800"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="p-6 overflow-y-auto space-y-4 text-sm text-zinc-300 leading-relaxed prose prose-invert">
                ${processedDesc}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.viewArticleModal = async function(articleSlug) {
    if (!supabaseClient) return;

    const { data: post, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('slug', articleSlug)
        .single();

    if (error || !post) {
        alert("Failed to load article content: " + error.message);
        return;
    }

    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4";
    modal.id = "temp-article-modal";

    const processedContent = typeof marked !== 'undefined' ? marked.parse(post.content || '*Content empty*') : (post.content || '');

    modal.innerHTML = `
        <div class="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
                <h3 class="font-bold text-base text-white">${post.title}</h3>
                <button onclick="document.getElementById('temp-article-modal').remove()" class="text-zinc-500 hover:text-white text-xs px-2.5 py-1.5 rounded bg-zinc-800"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="p-8 overflow-y-auto space-y-4 text-sm text-zinc-300 leading-relaxed prose prose-invert">
                ${processedContent}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

async function loadContentLibrary(filter) {
    const grid = document.getElementById('contentLibraryGrid');
    if (!grid) return;
    if (!supabaseClient) { grid.innerHTML = getSupabaseWarningHTML(); return; }

    grid.innerHTML = '<div class="col-span-3 py-12 flex justify-center"><i class="fa-solid fa-spinner animate-spin text-2xl text-blue-500"></i></div>';
    let contentItems = [];

    if (filter === 'all' || filter === 'videos') {
        const { data: videos } = await supabaseClient.from('videos').select('*').eq('status', 'published');
        if (videos) contentItems.push(...videos.map(v => ({...v, contentType: 'video'})));
    }
    if (filter === 'all' || filter === 'playlists') {
        const { data: playlists } = await supabaseClient.from('playlists').select('*');
        if (playlists) contentItems.push(...playlists.map(p => ({...p, contentType: 'playlist'})));
    }
    if (filter === 'all' || filter === 'articles') {
        const { data: posts } = await supabaseClient.from('posts').select('*').eq('status', 'published');
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
    if (!supabaseClient) { syllabus.innerHTML = getSupabaseWarningHTML(); return; }

    const { data: modules, error } = await supabaseClient
        .from('course_modules')
        .select(`
            id, title, position,
            lessons ( id, title, slug, video_id, position )
        `)
        .order('position', { ascending: true });

    if (error || !modules || modules.length === 0) {
        syllabus.innerHTML = `<div class="text-zinc-500 text-xs text-center py-6">Syllabus is empty. Initialize Modules inside the Admin panel.</div>`;
        return;
    }

    syllabus.innerHTML = modules.map(mod => {
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

    if (activeLessonSlug) {
        document.getElementById('learningHubWelcome')?.classList.add('hidden');
        document.getElementById('activeLessonViewer')?.classList.remove('hidden');
        loadLessonDetail(activeLessonSlug);
    } else {
        document.getElementById('learningHubWelcome')?.classList.remove('hidden');
        document.getElementById('activeLessonViewer')?.classList.add('hidden');
    }
}

async function loadLessonDetail(slug) {
    if (!supabaseClient) return;

    const { data: lesson, error } = await supabaseClient
        .from('lessons')
        .select(`*, videos ( youtube_id, duration )`)
        .eq('slug', slug)
        .single();

    if (error || !lesson) return;

    const lessonTitle = document.getElementById('lessonTitle');
    const lessonDuration = document.getElementById('lessonDuration');
    if (lessonTitle) lessonTitle.textContent = lesson.title;
    if (lessonDuration) lessonDuration.textContent = lesson.videos?.duration || '00:00';

    const videoIframe = document.getElementById('lessonVideoIframe');
    if (videoIframe) {
        if (lesson.videos?.youtube_id) {
            videoIframe.src = `https://www.youtube.com/embed/${lesson.videos.youtube_id}?enablejsapi=1&rel=0`;
        } else {
            videoIframe.src = '';
        }
    }

    renderMindmapTab(lesson.mindmap_markdown);
    renderQuizTab(lesson.quizzes_json);
    renderFlashcardsTab(lesson.flashcards_json);
    renderResourcesTab(lesson.resources_json);
}

// --- EDUCATIONAL COMPONENT PARSERS ---
function renderMindmapTab(markdownContent) {
    const svgEl = document.getElementById('markmap-svg');
    if (!svgEl) return;
    svgEl.innerHTML = '';

    if (!markdownContent) {
        svgEl.innerHTML = '<text x="50%" y="50%" fill="#a1a1aa" text-anchor="middle" font-size="12" font-family="sans-serif">No mind map configured for this lesson yet.</text>';
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

function renderQuizTab(quizData) {
    const root = document.getElementById('mdq-quiz-root');
    if (!root) return;
    root.innerHTML = '';

    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        root.innerHTML = '<p class="text-xs text-zinc-500 font-mono">No quiz is set up for this lesson module.</p>';
        return;
    }

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
    questions.forEach((q, qIndex) => {
        const selected = document.querySelector(`input[name="q_${qIndex}"]:checked`);
        const feedback = document.getElementById(`feedback_${qIndex}`);
        if (!feedback) return;
        feedback.classList.remove('hidden', 'text-green-400', 'text-red-400');

        if (selected) {
            const answerIndex = parseInt(selected.value);
            if (answerIndex === q.correct_index) {
                feedback.textContent = `✓ Correct! ${q.explanation || ''}`;
                feedback.classList.add('text-green-400');
                recordLocalGradedQuizScore();
            } else {
                feedback.textContent = `✗ Incorrect. Correct answer: "${q.options[q.correct_index]}". ${q.explanation || ''}`;
                feedback.classList.add('text-red-400');
            }
        } else {
            feedback.textContent = `⚠ Please select an answer.`;
            feedback.classList.add('text-zinc-500');
        }
    });
};

function recordLocalGradedQuizScore() {
    let score = parseInt(localStorage.getItem('quizzes_score_total') || '0');
    score++;
    localStorage.setItem('quizzes_score_total', score.toString());

    // Sync current metrics live onto active view
    const metricsEl = document.getElementById('studentCompletedQuizzes');
    if (metricsEl) metricsEl.textContent = score.toString();
}

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
    if (!container || lessonFlashcards.length === 0) return;

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

// Premium Lockout mapping on resources folder
async function renderResourcesTab(resources) {
    const list = document.getElementById('lessonResourcesList');
    if (!list) return;
    list.innerHTML = '';

    if (!supabaseClient) return;

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        list.innerHTML = `
            <li class="p-6 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center space-y-3">
                <i class="fa-solid fa-lock text-blue-500 text-lg"></i>
                <p class="text-xs font-semibold text-zinc-300">Downloadable Resources are Locked</p>
                <p class="text-[11px] text-zinc-500 max-w-xs mx-auto">Please create a student account or log in via the Portal menu to download Python source codes and cheatsheets.</p>
                <a href="#admin" onclick="triggerPortalRoute('student')" class="inline-block mt-2 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-[10px] font-bold text-white transition-colors">Log In / Sign Up</a>
            </li>
        `;
        return;
    }

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

// --- 6. ROLE ROUTING & PORTAL MANAGEMENT SESSION ENGINE ---
let currentAdminTab = 'videos';
let loadedAdminData = [];
let isEditMode = false;
let editingRecordId = null;

async function checkPortalSession() {
    const authContainer = document.getElementById('adminAuthContainer');
    const workspace = document.getElementById('adminWorkspace');
    const studentWorkspace = document.getElementById('studentWorkspace');
    if (!authContainer || !workspace || !studentWorkspace) return;

    if (!supabaseClient) {
        authContainer.innerHTML = getSupabaseWarningHTML();
        return;
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData && sessionData.session) {
        authContainer.classList.add('hidden');

        // Fetch user profile properties to confirm authorization level
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', sessionData.session.user.id)
            .single();

        if (profile?.is_admin === true) {
            // Logged in as Administrator
            workspace.classList.remove('hidden');
            studentWorkspace.classList.add('hidden');
            document.getElementById('adminUserDisplayName').textContent = profile.full_name;
            loadAdminContentList();
        } else {
            // Logged in as Student
            workspace.classList.add('hidden');
            studentWorkspace.classList.remove('hidden');
            loadStudentDashboardDetails(sessionData.session.user, profile);
        }
    } else {
        authContainer.classList.remove('hidden');
        workspace.classList.add('hidden');
        studentWorkspace.classList.add('hidden');
        updateAuthInterfaceForSelectedRole();
    }
}

// Loads student account metrics and checks completed lists
async function loadStudentDashboardDetails(user, profile) {
    const nameInput = document.getElementById('student_full_name');
    const avatarInput = document.getElementById('student_avatar_url');
    if (nameInput) nameInput.value = profile?.full_name || '';
    if (avatarInput) avatarInput.value = profile?.avatar_url || '';

    // Load completed questions metrics
    const scoreVal = parseInt(localStorage.getItem('quizzes_score_total') || '0');
    document.getElementById('studentCompletedQuizzes').textContent = scoreVal.toString();

    // Fetch master curriculum syllabus details to render visual checklist progress bar
    const checklist = document.getElementById('studentCompletedLessonsList');
    if (!checklist) return;

    const { data: lessons } = await supabaseClient
        .from('lessons')
        .select('id, title, slug')
        .order('position', { ascending: true });

    if (!lessons || lessons.length === 0) {
        checklist.innerHTML = `<p class="text-xs text-zinc-500 py-4 text-center font-mono">Curriculum courses empty.</p>`;
        return;
    }

    const localKey = 'completed_lessons_v5_' + user.id;
    let completedSlugs = JSON.parse(localStorage.getItem(localKey) || '[]');

    // Calculate percentage bar
    const totalCount = lessons.length;
    const completedCount = completedSlugs.length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    document.getElementById('studentProgressPercent').textContent = `${percentage}%`;
    document.getElementById('studentProgressBar').style.width = `${percentage}%`;

    checklist.innerHTML = lessons.map(les => {
        const isChecked = completedSlugs.includes(les.slug);
        return `
            <div class="flex items-center justify-between py-2 text-xs">
                <span class="text-zinc-300 truncate pr-4">${les.title}</span>
                <label class="flex items-center space-x-2 cursor-pointer">
                    <span class="text-[10px] font-mono ${isChecked ? 'text-blue-400' : 'text-zinc-500'}">${isChecked ? 'Completed' : 'Mark Done'}</span>
                    <input type="checkbox" onchange="toggleSyllabusCompletion('${les.slug}', '${user.id}', this.checked)" ${isChecked ? 'checked' : ''} class="text-blue-500 bg-zinc-950 border-zinc-800 rounded focus:ring-0">
                </label>
            </div>
        `;
    }).join('');
}

window.toggleSyllabusCompletion = function(lessonSlug, userId, isChecked) {
    const localKey = 'completed_lessons_v5_' + userId;
    let completedSlugs = JSON.parse(localStorage.getItem(localKey) || '[]');

    if (isChecked) {
        if (!completedSlugs.includes(lessonSlug)) completedSlugs.push(lessonSlug);
    } else {
        completedSlugs = completedSlugs.filter(slug => slug !== lessonSlug);
    }

    localStorage.setItem(localKey, JSON.stringify(completedSlugs));

    // Smooth rerender of progress numbers
    const { data: sessionData } = supabaseClient.auth.getSession();
    if (sessionData && sessionData.session) {
        loadStudentDashboardDetails(sessionData.session.user);
    }
};

// Handle student profile updates
document.getElementById('studentProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;

    const full_name = document.getElementById('student_full_name').value;
    const avatar_url = document.getElementById('student_avatar_url').value;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { error } = await supabaseClient
        .from('profiles')
        .update({ full_name, avatar_url })
        .eq('id', session.user.id);

    if (error) {
        alert("Failed to update student profile: " + error.message);
    } else {
        alert("Student profile updated successfully!");
        checkPortalSession();
    }
});

// --- 7. SECURED CREATOR ADMIN BACKEND (CMS CRUD IMPLEMENTATION) ---
async function loadAdminContentList() {
    const tbody = document.getElementById('adminCMSTableBody');
    if (!tbody) return;

    const tableContainer = tbody.closest('.overflow-x-auto');
    const addBtn = document.getElementById('adminAddNewContentBtn');

    // Dynamic Table Head titles
    const colTitle = document.getElementById('adminTableColTitle');
    const colSlug = document.getElementById('adminTableColSlug');

    // Special Case: Manage Messages (Contact Inbox Panel)
    if (currentAdminTab === 'contact_submissions') {
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (addBtn) addBtn.classList.add('hidden'); // No adding messages manually

        colTitle.textContent = "Sender Name";
        colSlug.textContent = "Email Address";
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-6"><i class="fa-solid fa-spinner animate-spin text-blue-500"></i></td></tr>';

        const { data: submissions, error } = await supabaseClient
            .from('contact_submissions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center text-xs text-red-400 py-6">Fetch Error: ${error.message}</td></tr>`;
            return;
        }

        if (!submissions || submissions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-zinc-500 text-xs py-6">Your inbox is currently empty!</td></tr>';
            return;
        }

        tbody.innerHTML = submissions.map(msg => `
            <tr class="hover:bg-zinc-900/50">
                <td class="px-4 py-3 font-semibold text-white max-w-xs truncate">${msg.name}</td>
                <td class="px-4 py-3 font-mono text-xs text-zinc-500">${msg.email}</td>
                <td class="px-4 py-3 text-right space-x-1.5">
                    <button onclick="viewContactMessageDetails('${msg.id}')" class="text-blue-500 hover:text-white text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-blue-600 transition-colors" title="Read Message"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="deleteContactMessage('${msg.id}')" class="text-red-500 hover:text-white text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-600 transition-colors" title="Delete Message"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            </tr>
        `).join('');
        return;
    }

    // Special Case: Manage Profile (Direct Form render)
    if (currentAdminTab === 'profiles') {
        if (tableContainer) tableContainer.classList.add('hidden');
        if (addBtn) addBtn.classList.add('hidden');
        tbody.innerHTML = '';

        const { data: sessionData } = await supabaseClient.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;

        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center text-xs text-red-400 py-6">Profile Fetch Error: ${error.message}</td></tr>`;
            return;
        }

        showAdminCMSForm(true, userId, profile);
        return;
    }

    // Reset back table column headers
    colTitle.textContent = "Title";
    colSlug.textContent = "Unique ID / Slug";

    if (tableContainer) tableContainer.classList.remove('hidden');
    if (addBtn) addBtn.classList.remove('hidden');
    hideAdminCMSForm();

    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-6"><i class="fa-solid fa-spinner animate-spin text-blue-500"></i></td></tr>';

    const { data, error } = await supabaseClient
        .from(currentAdminTab)
        .select('*');

    if (error) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-xs text-red-400 py-6">Database Fetch Error: ${error.message}</td></tr>`;
        return;
    }

    loadedAdminData = data;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-zinc-500 text-xs py-6">No records populated in table yet. Click "Add New Record".</td></tr>';
        return;
    }

    // Fixed profile column maps using "full_name" rather than untitled titles
    tbody.innerHTML = data.map(item => {
        const titleText = item.title || item.name || item.full_name || 'Untitled';
        return `
            <tr class="hover:bg-zinc-900/50">
                <td class="px-4 py-3 font-semibold text-white max-w-xs truncate">${titleText}</td>
                <td class="px-4 py-3 font-mono text-xs text-zinc-500">${item.slug || item.id}</td>
                <td class="px-4 py-3 text-right space-x-1">
                    <button onclick="editAdminRecord('${item.id}')" class="text-blue-500 hover:text-white text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-blue-600 transition-colors"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteAdminRecord('${item.id}')" class="text-red-500 hover:text-white text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-600 transition-colors"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// Eye button Modal reader for Inbox submissions
window.viewContactMessageDetails = async function(messageId) {
    const { data: msg, error } = await supabaseClient
        .from('contact_submissions')
        .select('*')
        .eq('id', messageId)
        .single();

    if (error || !msg) {
        alert("Failed to load message: " + error.message);
        return;
    }

    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4";
    modal.id = "temp-msg-modal";

    modal.innerHTML = `
        <div class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
            <div class="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
                <h3 class="font-bold text-sm text-white">Message from ${msg.name}</h3>
                <button onclick="document.getElementById('temp-msg-modal').remove()" class="text-zinc-500 hover:text-white text-xs px-2 py-1 rounded bg-zinc-800"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="p-6 space-y-4 text-xs leading-relaxed">
                <div>
                    <span class="text-zinc-500 block font-mono">Email Address</span>
                    <a href="mailto:${msg.email}" class="text-blue-400 font-semibold hover:underline">${msg.email}</a>
                </div>
                <div>
                    <span class="text-zinc-500 block font-mono">Submitted On</span>
                    <span class="text-zinc-300 font-mono">${new Date(msg.created_at).toLocaleString()}</span>
                </div>
                <div class="border-t border-zinc-800 pt-3">
                    <span class="text-zinc-500 block font-mono mb-1">Message Content</span>
                    <p class="text-zinc-200 bg-zinc-950 p-3 rounded-lg border border-zinc-850 whitespace-pre-wrap">${msg.message}</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.deleteContactMessage = async function(messageId) {
    if (!confirm("Delete this submission permanently?")) return;

    const { error } = await supabaseClient
        .from('contact_submissions')
        .delete()
        .eq('id', messageId);

    if (error) {
        alert("Failed to delete submission: " + error.message);
    } else {
        alert("Message successfully deleted!");
        loadAdminContentList();
    }
};

window.editAdminRecord = function(id) {
    const record = loadedAdminData.find(item => item.id === id);
    if (!record) return;
    showAdminCMSForm(true, id, record);
};

window.deleteAdminRecord = async function(id) {
    // Alerting user of standard Supabase Cascade Auth rules
    const confirmText = "Confirm Record Deletion? Note: If deleting a profile, you MUST also manually delete their authentication credentials inside your Supabase dashboard (Authentication -> Users) or their profile row will reappear upon their next login session!";
    if (!confirm(confirmText)) return;

    const { error } = await supabaseClient
        .from(currentAdminTab)
        .delete()
        .eq('id', id);

    if (error) {
        alert(`Delete failed: ${error.message}`);
    } else {
        alert("Record successfully wiped!");
        loadAdminContentList();
        loadGlobalProfile();
    }
};

async function showAdminCMSForm(isEdit, recordId = null, record = null) {
    isEditMode = isEdit;
    editingRecordId = recordId;

    const formContainer = document.getElementById('adminCMSFormContainer');
    const headerTitle = document.getElementById('adminFormHeaderTitle');
    if (!formContainer || !headerTitle) return;

    if (isEdit) {
        headerTitle.textContent = `Edit ${currentAdminTab.split('_').join(' ').toUpperCase()} Entry`;
    } else {
        headerTitle.textContent = `Create New ${currentAdminTab.split('_').join(' ').toUpperCase()} Entry`;
    }

    await setupAdminFormFields(record);
    formContainer.classList.remove('hidden');
    formContainer.scrollIntoView({ behavior: 'smooth' });
}

function hideAdminCMSForm() {
    const formContainer = document.getElementById('adminCMSFormContainer');
    if (formContainer) formContainer.classList.add('hidden');

    const form = document.getElementById('adminCMSForm');
    if (form) form.reset();
    isEditMode = false;
    editingRecordId = null;
}

async function setupAdminFormFields(record = null) {
    const form = document.getElementById('adminCMSForm');
    if (!form) return;

    let inputsHTML = '';

    if (currentAdminTab === 'videos') {
        inputsHTML = `
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Video Title</label>
                <input type="text" name="title" required value="${record?.title || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Slug (unique URL path)</label>
                <input type="text" name="slug" required value="${record?.slug || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">YouTube Video ID (e.g., dQw4w9WgXcQ)</label>
                <input type="text" name="youtube_id" required value="${record?.youtube_id || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Duration (e.g., 12:34)</label>
                <input type="text" name="duration" value="${record?.duration || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-mono text-zinc-400 mb-1">Description</label>
                <textarea name="description" rows="3" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">${record?.description || ''}</textarea>
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Status</label>
                <select name="status" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
                    <option value="published" ${record?.status === 'published' ? 'selected' : ''}>Published</option>
                    <option value="draft" ${record?.status === 'draft' ? 'selected' : ''}>Draft</option>
                    <option value="archived" ${record?.status === 'archived' ? 'selected' : ''}>Archived</option>
                </select>
            </div>
            <div class="flex items-center space-x-3 pt-6">
                <input type="checkbox" name="is_featured" id="is_featured" ${record?.is_featured ? 'checked' : ''} class="text-blue-500 focus:ring-0 rounded bg-zinc-900 border-zinc-800">
                <label for="is_featured" class="text-xs font-mono text-zinc-400">Featured Content</label>
            </div>
        `;
    } else if (currentAdminTab === 'course_modules') {
        let coursesOptions = '';
        try {
            const { data: courses } = await supabaseClient.from('courses').select('id, title');
            if (courses) {
                coursesOptions = courses.map(c => `<option value="${c.id}" ${record?.course_id === c.id ? 'selected' : ''}>${c.title}</option>`).join('');
            }
        } catch (e) {
            console.error("Error loading courses selection", e);
        }

        inputsHTML = `
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Module Title</label>
                <input type="text" name="title" required value="${record?.title || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Parent Course</label>
                <select name="course_id" required class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
                    ${coursesOptions}
                </select>
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Syllabus Order Position</label>
                <input type="number" name="position" required value="${record?.position || '1'}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
        `;
    } else if (currentAdminTab === 'lessons') {
        let modulesOptions = '<option value="">-- Select Module --</option>';
        let videosOptions = '<option value="">-- No linked video --</option>';

        try {
            const { data: modules } = await supabaseClient.from('course_modules').select('id, title').order('position', { ascending: true });
            if (modules) {
                modulesOptions += modules.map(m => `<option value="${m.id}" ${record?.module_id === m.id ? 'selected' : ''}>${m.title}</option>`).join('');
            }
            const { data: videos } = await supabaseClient.from('videos').select('id, title').order('title', { ascending: true });
            if (videos) {
                videosOptions += videos.map(v => `<option value="${v.id}" ${record?.video_id === v.id ? 'selected' : ''}>${v.title}</option>`).join('');
            }
        } catch (e) {
            console.error("Error loading selection inputs", e);
        }

        inputsHTML = `
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Lesson Title</label>
                <input type="text" name="title" required value="${record?.title || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Slug (unique URL path)</label>
                <input type="text" name="slug" required value="${record?.slug || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Parent Module</label>
                <select name="module_id" required class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
                    ${modulesOptions}
                </select>
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Linked Video</label>
                <select name="video_id" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
                    ${videosOptions}
                </select>
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Syllabus Index Position (e.g. 1, 2, 3)</label>
                <input type="number" name="position" required value="${record?.position || '1'}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-mono text-zinc-400 mb-1">Interactive Mind Map Markdown (Simple List structure)</label>
                <textarea name="mindmap_markdown" rows="4" placeholder="# Main Topic\n## Sub Topic\n- Detail Point" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-blue-500">${record?.mindmap_markdown || ''}</textarea>
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-mono text-zinc-400 mb-1">Interactive Quiz JSON (MDQ format)</label>
                <textarea name="quizzes_json" id="quizzes_json" rows="4" placeholder='{ "questions": [ { "question": "Question text?", "options": ["Option 1", "Option 2"], "correct_index": 0, "explanation": "Answer description" } ] }' class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-blue-500">${record?.quizzes_json ? JSON.stringify(record.quizzes_json, null, 2) : ''}</textarea>
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-mono text-zinc-400 mb-1">Practice Flashcards JSON</label>
                <textarea name="flashcards_json" id="flashcards_json" rows="4" placeholder='[ { "front": "Question card text", "back": "Answer card text" } ]' class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-blue-500">${record?.flashcards_json ? JSON.stringify(record.flashcards_json, null, 2) : ''}</textarea>
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-mono text-zinc-400 mb-1">Lesson Download Resources JSON</label>
                <textarea name="resources_json" id="resources_json" rows="4" placeholder='[ { "title": "Cheat Sheet", "url": "https://..." } ]' class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-blue-500">${record?.resources_json ? JSON.stringify(record.resources_json, null, 2) : ''}</textarea>
            </div>
        `;
    } else if (currentAdminTab === 'projects') {
        inputsHTML = `
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Project Title</label>
                <input type="text" name="title" required value="${record?.title || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Slug (unique URL path)</label>
                <input type="text" name="slug" required value="${record?.slug || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-mono text-zinc-400 mb-1">Short Summary (1-2 sentences)</label>
                <input type="text" name="summary" required value="${record?.summary || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-mono text-zinc-400 mb-1">Detailed Description (Markdown)</label>
                <textarea name="description" rows="4" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">${record?.description || ''}</textarea>
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Banner Image URL</label>
                <input type="url" name="image_url" id="project_image_url_val" value="${record?.image_url || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
                <input type="file" id="project_file_picker" accept="image/*" class="mt-2 text-xs text-zinc-500 block w-full file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700" onchange="uploadDeviceFile('project_file_picker', 'project_image_url_val')">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Live Demo URL</label>
                <input type="url" name="project_url" value="${record?.project_url || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">GitHub Repo URL</label>
                <input type="url" name="github_url" value="${record?.github_url || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Tags (comma separated)</label>
                <input type="text" name="tags" placeholder="python, api, web-scraping" value="${record?.tags ? record.tags.join(', ') : ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Status</label>
                <select name="status" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
                    <option value="planning" ${record?.status === 'planning' ? 'selected' : ''}>Planning</option>
                    <option value="in-progress" ${record?.status === 'in-progress' ? 'selected' : ''}>In-Progress</option>
                    <option value="completed" ${record?.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="archived" ${record?.status === 'archived' ? 'selected' : ''}>Archived</option>
                </select>
            </div>
            <div class="flex items-center space-x-3 pt-6">
                <input type="checkbox" name="is_featured" id="proj_featured" ${record?.is_featured ? 'checked' : ''} class="text-blue-500 focus:ring-0 rounded bg-zinc-900 border-zinc-800">
                <label for="proj_featured" class="text-xs font-mono text-zinc-400">Featured Project</label>
            </div>
        `;
    } else if (currentAdminTab === 'posts') {
        inputsHTML = `
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Article Title</label>
                <input type="text" name="title" required value="${record?.title || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Slug (unique URL path)</label>
                <input type="text" name="slug" required value="${record?.slug || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-mono text-zinc-400 mb-1">Brief Excerpt</label>
                <input type="text" name="excerpt" required value="${record?.excerpt || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-mono text-zinc-400 mb-1">Content (Markdown)</label>
                <textarea name="content" rows="6" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">${record?.content || ''}</textarea>
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Featured Image URL</label>
                <input type="url" name="image_url" value="${record?.image_url || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Tags (comma separated)</label>
                <input type="text" name="tags" placeholder="tutorial, coding, design" value="${record?.tags ? record.tags.join(', ') : ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Status</label>
                <select name="status" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
                    <option value="published" ${record?.status === 'published' ? 'selected' : ''}>Published</option>
                    <option value="draft" ${record?.status === 'draft' ? 'selected' : ''}>Draft</option>
                    <option value="archived" ${record?.status === 'archived' ? 'selected' : ''}>Archived</option>
                </select>
            </div>
        `;
    } else if (currentAdminTab === 'profiles') {
        inputsHTML = `
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Display/Full Name</label>
                <input type="text" name="full_name" required value="${record?.full_name || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">Display Picture (Avatar URL)</label>
                <input type="url" name="avatar_url" id="admin_avatar_url_val" value="${record?.avatar_url || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
                <input type="file" id="admin_avatar_file_picker" accept="image/*" class="mt-2 text-xs text-zinc-500 block w-full file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700" onchange="uploadDeviceFile('admin_avatar_file_picker', 'admin_avatar_url_val')">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">GitHub Profile Link</label>
                <input type="url" name="github_link" value="${record?.github_link || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">LinkedIn Profile Link</label>
                <input type="url" name="linkedin_link" value="${record?.linkedin_link || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
                <label class="block text-xs font-mono text-zinc-400 mb-1">YouTube Channel Link</label>
                <input type="url" name="youtube_link" value="${record?.youtube_link || ''}" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-mono text-zinc-400 mb-1">Biography / Backstory (Supports Markdown: **bold**, - list, line breaks)</label>
                <textarea name="bio" rows="5" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 text-sm">${record?.bio || ''}</textarea>
            </div>
        `;
    }

    const buttonSection = form.querySelector('.flex.justify-end');
    const formFields = Array.from(form.children).filter(child => child !== buttonSection);
    formFields.forEach(field => form.removeChild(field));

    const div = document.createElement('div');
    div.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2';
    div.innerHTML = inputsHTML;
    form.insertBefore(div, buttonSection);
}

async function saveAdminRecord(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const form = document.getElementById('adminCMSForm');
    const formData = new FormData(form);
    const payload = {};

    for (const [key, value] of formData.entries()) {
        if (key !== 'file' && !key.startsWith('avatar_file') && !key.startsWith('project_file')) {
            payload[key] = value;
        }
    }

    if (currentAdminTab === 'videos' || currentAdminTab === 'projects') {
        payload['is_featured'] = !!formData.get('is_featured');
    }

    if (payload['tags']) {
        payload['tags'] = payload['tags'].split(',').map(t => t.trim()).filter(Boolean);
    }

    if (currentAdminTab === 'lessons') {
        const jsonFields = ['quizzes_json', 'flashcards_json', 'resources_json'];
        for (const field of jsonFields) {
            const rawVal = formData.get(field);
            if (rawVal && rawVal.trim() !== '') {
                try {
                    payload[field] = JSON.parse(rawVal);
                } catch (err) {
                    alert(`Invalid JSON format in the '${field}' field. Verify JSON rules: ${err.message}`);
                    return;
                }
            } else {
                payload[field] = null;
            }
        }
    }

    if (payload['position']) {
        payload['position'] = parseInt(payload['position']);
    }

    let error = null;

    if (currentAdminTab === 'profiles') {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) {
            alert("No authenticated session found.");
            return;
        }
        const { error: err } = await supabaseClient
            .from('profiles')
            .update(payload)
            .eq('id', userId);
        error = err;
    } else {
        if (isEditMode && editingRecordId) {
            const { error: err } = await supabaseClient
                .from(currentAdminTab)
                .update(payload)
                .eq('id', editingRecordId);
            error = err;
        } else {
            const { error: err } = await supabaseClient
                .from(currentAdminTab)
                .insert([payload]);
            error = err;
        }
    }

    if (error) {
        alert(`Save operation failed: ${error.message}`);
    } else {
        alert("Record successfully saved to your cloud database!");
        hideAdminCMSForm();
        loadAdminContentList();
        loadGlobalProfile();
        loadAboutProfile();
    }
}

// --- SECURED ADMIN LOGOUT WITH FIELDS WIPE ---
async function handleAdminLogout() {
    if (!supabaseClient) return;

    await supabaseClient.auth.signOut();

    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.reset();
    }

    checkPortalSession();
    loadGlobalProfile();
}

let isSignUpMode = false;

window.toggleAuthMode = function() {
    isSignUpMode = !isSignUpMode;
    const submitBtn = document.getElementById('adminSubmitBtn');
    const modeToggle = document.getElementById('authModeToggle');
    const headerTitle = document.getElementById('authHeaderTitle');
    const headerSubtitle = document.getElementById('authHeaderSubtitle');
    const headerIcon = document.getElementById('authHeaderIcon');

    if (isSignUpMode) {
        submitBtn.textContent = "Sign Up (Register Student)";
        modeToggle.textContent = "Already have an account? Log In";
        headerTitle.textContent = "Create Student Account";
        headerSubtitle.textContent = "Join the Python Masterclass and unlock files and downloadable source assets.";
        headerIcon.className = "fa-solid fa-user-plus text-blue-500 text-3xl mb-2";
    } else {
        submitBtn.textContent = "Access Workspace";
        modeToggle.textContent = "New Student? Create an Account";
        headerTitle.textContent = "Student Workspace";
        headerSubtitle.textContent = "Register credentials or login with Google to unlock course materials.";
        headerIcon.className = "fa-solid fa-graduation-cap text-blue-500 text-3xl mb-2";
    }
};

// Professional Authentication Router supporting Email Confirmations
async function handleAdminLogin(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    if (currentPortalViewMode === 'student' && isSignUpMode) {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin + window.location.pathname + '#admin'
            }
        });

        if (error) {
            alert(`Registration Failed: ${error.message}`);
            return;
        }

        // Catch the unconfirmed session state
        if (data.user && (!data.session)) {
            alert("✉️ Verification Link Sent! We've dispatched a confirmation link to your registered email. Please click the link inside your inbox to activate your credentials before logging in.");
            isSignUpMode = false;
            toggleAuthMode();
        } else {
            alert("Success! Welcome aboard. You are now logged in.");
            isSignUpMode = false;
            toggleAuthMode();
            checkPortalSession();
            loadGlobalProfile();
        }
    } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            if (error.message.toLowerCase().includes("email not confirmed")) {
                alert("🔐 Email Unverified: Please open your email inbox and click the verification link sent by Supabase to unlock your account.");
            } else {
                alert(`Authentication Failed: ${error.message}`);
            }
        } else {
            checkPortalSession();
            loadGlobalProfile();
        }
    }
}

// Google OAuth single-sign-on integration
window.signInWithGoogle = async function() {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + window.location.pathname + '#admin'
        }
    });
    if (error) {
        alert("Google Single-Sign-On failed: " + error.message);
    }
};

// --- DYNAMIC CONTACT SUBMISSIONS RECIEVER ---
async function handleContactFormSubmit(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const name = document.getElementById('contact_name').value;
    const email = document.getElementById('contact_email').value;
    const message = document.getElementById('contact_message').value;

    const { error } = await supabaseClient
        .from('contact_submissions')
        .insert([{ name, email, message }]);

    if (error) {
        alert("Failed to send message: " + error.message);
    } else {
        alert("Your message has been safely saved to my HQ database! I will get in touch soon.");
        e.target.reset();
    }
}

// --- UX GLOBAL EVENT LISTENERS & INITS ---
function setupGlobalEventListeners() {
    const mobileToggle = document.getElementById('mobileNavToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileToggle && mobileMenu) {
        mobileToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            toggleCommandPalette();
        }
        if (e.key === 'Escape') {
            document.getElementById('commandPalette')?.classList.add('hidden');
        }
    });

    document.getElementById('searchTrigger')?.addEventListener('click', toggleCommandPalette);
    document.getElementById('cmdCloseBtn')?.addEventListener('click', () => {
        document.getElementById('commandPalette').classList.add('hidden');
    });

    document.querySelectorAll('.asset-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const activeTab = e.currentTarget.getAttribute('data-tab');
            document.querySelectorAll('.asset-tab').forEach(t => {
                t.classList.remove('text-blue-500', 'border-b-2', 'border-blue-500');
                t.classList.add('text-zinc-400');
            });
            e.currentTarget.classList.add('text-blue-500', 'border-b-2', 'border-blue-500');
            document.querySelectorAll('.asset-tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(`asset-${activeTab}`)?.classList.remove('hidden');
        });
    });

    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.admin-nav-btn').forEach(b => {
                b.classList.remove('text-blue-400', 'bg-blue-500/10', 'font-semibold');
                b.classList.add('text-zinc-400');
            });
            e.currentTarget.classList.add('text-blue-400', 'bg-blue-500/10', 'font-semibold');
            currentAdminTab = e.currentTarget.getAttribute('data-tab');
            document.getElementById('adminActionSectionTitle').textContent = `Manage ${currentAdminTab.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`;
            hideAdminCMSForm();
            loadAdminContentList();
        });
    });

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

    document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLogin);
    document.getElementById('adminAddNewContentBtn')?.addEventListener('click', () => showAdminCMSForm(false));
    document.getElementById('adminCancelCMSFormBtn')?.addEventListener('click', hideAdminCMSForm);
    document.getElementById('adminCMSForm')?.addEventListener('submit', saveAdminRecord);
    document.getElementById('contactFormElement')?.addEventListener('submit', handleContactFormSubmit);
}

function toggleCommandPalette() {
    const cp = document.getElementById('commandPalette');
    if (!cp) return;
    cp.classList.toggle('hidden');
    if (!cp.classList.contains('hidden')) {
        document.getElementById('cmdInput')?.focus();
    }
}

function getSupabaseWarningHTML() {
    return `
        <div class="col-span-3 p-6 text-center rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-yellow-400 text-xs font-mono max-w-lg mx-auto">
            <i class="fa-solid fa-triangle-exclamation text-lg mb-2 block"></i>
            <h4 class="font-bold mb-1">Database Sync Key Required</h4>
            <p>To load lessons dynamically, set your actual cloud instance <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> credentials in <code>assets/js/app.js</code>.</p>
        </div>
    `;
}
