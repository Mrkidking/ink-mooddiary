-- =====================================================
-- INK 心情日记 — Supabase 数据库 Schema
-- 在 Supabase SQL Editor 中运行此文件
-- =====================================================

-- 1. Profiles 表：用户公开资料
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT DEFAULT '',
  handle     TEXT DEFAULT '',
  bio        TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, handle, created_at)
  VALUES (NEW.id, split_part(NEW.email, '@', 1), '@' || split_part(NEW.email, '@', 1), now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Diary Entries 表：日记数据
CREATE TABLE IF NOT EXISTS public.diary_entries (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  mood_key   TEXT NOT NULL DEFAULT 'calm',
  title      TEXT DEFAULT '',
  content    TEXT DEFAULT '',
  images     TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entries_user_id ON public.diary_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON public.diary_entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON public.diary_entries(user_id, date);

-- 3. Row Level Security (RLS) — 用户只能读写自己的数据

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Diary Entries
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own entries" ON public.diary_entries;
CREATE POLICY "Users can read own entries"
  ON public.diary_entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own entries" ON public.diary_entries;
CREATE POLICY "Users can insert own entries"
  ON public.diary_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own entries" ON public.diary_entries;
CREATE POLICY "Users can update own entries"
  ON public.diary_entries FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own entries" ON public.diary_entries;
CREATE POLICY "Users can delete own entries"
  ON public.diary_entries FOR DELETE
  USING (auth.uid() = user_id);
