-- Supabase PostgreSQL Schema for personal website & dynamic content platform
-- Derived from the Creator Digital HQ Blueprint

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES & ROLES
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    full_name text not null,
    avatar_url text,
    is_admin boolean default false not null
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

create policy "Allow public read access to profiles" 
on public.profiles for select using (true);

create policy "Allow users to update their own profile" 
on public.profiles for update using (auth.uid() = id);

-- Trigger to automatically create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, full_name, avatar_url, is_admin)
    values (
        new.id, 
        coalesce(new.raw_user_meta_data->>'full_name', 'Anonymous User'), 
        new.raw_user_meta_data->>'avatar_url',
        -- Set first user as admin by default for convenience, or false
        case when (select count(*) from public.profiles) = 0 then true else false end
    );
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();


-- Helper function to check if the current user is an admin
create or replace function public.is_admin()
returns boolean as $$
begin
    return coalesce(
        (select is_admin from public.profiles where id = auth.uid()),
        false
    );
end;
$$ language plpgsql security definer;


-- 2. PROJECTS TABLE
create table public.projects (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    title text not null,
    slug text not null unique,
    summary text not null,
    description text, -- Markdown content
    image_url text,
    project_url text,
    github_url text,
    status text default 'planning' check (status in ('planning', 'in-progress', 'completed', 'archived')),
    tags text[],
    is_featured boolean default false not null
);

alter table public.projects enable row level security;
create policy "Allow public read access to projects" on public.projects for select using (true);
create policy "Allow admin write access to projects" on public.projects 
    for all using (public.is_admin());


-- 3. VIDEOS TABLE
create table public.videos (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    title text not null,
    slug text not null unique,
    youtube_id text not null,
    duration text, -- e.g. "12:34"
    description text,
    status text default 'published' check (status in ('draft', 'published', 'archived')),
    is_featured boolean default false not null,
    tags text[]
);

alter table public.videos enable row level security;
create policy "Allow public read access to published videos" on public.videos 
    for select using (status = 'published' or public.is_admin());
create policy "Allow admin write access to videos" on public.videos 
    for all using (public.is_admin());


-- 4. PLAYLISTS & PLAYLIST_VIDEOS (Many-to-Many)
create table public.playlists (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    title text not null,
    slug text not null unique,
    description text
);

create table public.playlist_videos (
    playlist_id uuid references public.playlists on delete cascade not null,
    video_id uuid references public.videos on delete cascade not null,
    position integer not null, -- Ordering index
    primary key (playlist_id, video_id)
);

alter table public.playlists enable row level security;
create policy "Allow public read access to playlists" on public.playlists for select using (true);
create policy "Allow admin write access to playlists" on public.playlists for all using (public.is_admin());

alter table public.playlist_videos enable row level security;
create policy "Allow public read access to playlist_videos" on public.playlist_videos for select using (true);
create policy "Allow admin write access to playlist_videos" on public.playlist_videos for all using (public.is_admin());


-- 5. COURSES, MODULES, & LESSONS
create table public.courses (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    title text not null,
    slug text not null unique,
    description text not null,
    image_url text,
    status text default 'published' check (status in ('draft', 'published', 'archived')),
    tags text[]
);

create table public.course_modules (
    id uuid default uuid_generate_v4() primary key,
    course_id uuid references public.courses on delete cascade not null,
    title text not null,
    position integer not null
);

create table public.lessons (
    id uuid default uuid_generate_v4() primary key,
    module_id uuid references public.course_modules on delete cascade not null,
    title text not null,
    slug text not null unique,
    video_id uuid references public.videos on delete set null,
    mindmap_markdown text, -- Simple markdown list parsed into interactive MindMap
    quizzes_json jsonb, -- Embedded quiz questions formatted matching MDQ framework
    flashcards_json jsonb, -- Array of front/back cards
    resources_json jsonb, -- Custom links or file references
    position integer not null
);

alter table public.courses enable row level security;
create policy "Allow public read access to courses" on public.courses for select using (status = 'published' or public.is_admin());
create policy "Allow admin write access to courses" on public.courses for all using (public.is_admin());

alter table public.course_modules enable row level security;
create policy "Allow public read access to modules" on public.course_modules for select using (true);
create policy "Allow admin write access to modules" on public.course_modules for all using (public.is_admin());

alter table public.lessons enable row level security;
create policy "Allow public read access to lessons" on public.lessons for select using (true);
create policy "Allow admin write access to lessons" on public.lessons for all using (public.is_admin());


-- 6. POSTS (ARTICLES)
create table public.posts (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    title text not null,
    slug text not null unique,
    excerpt text not null,
    content text not null, -- Markdown document
    image_url text,
    status text default 'published' check (status in ('draft', 'published', 'archived')),
    tags text[]
);

alter table public.posts enable row level security;
create policy "Allow public read access to published posts" on public.posts 
    for select using (status = 'published' or public.is_admin());
create policy "Allow admin write access to posts" on public.posts 
    for all using (public.is_admin());


-- 7. ACHIEVEMENTS
create table public.achievements (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    title text not null,
    description text not null,
    category text check (category in ('milestone', 'certification', 'award', 'contribution')),
    date_achieved date not null,
    credential_url text
);

alter table public.achievements enable row level security;
create policy "Allow public read access to achievements" on public.achievements for select using (true);
create policy "Allow admin write access to achievements" on public.achievements for all using (public.is_admin());
