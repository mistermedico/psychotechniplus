alter table if exists public.questions
  add column if not exists explanation_image_url text;
