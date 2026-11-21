-- Align the public directory with the official JSS STU clubs page.
-- Legacy records stay in place but are archived so their event and profile links remain intact.

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.clubs
SET is_active = FALSE;

-- Reuse the existing records (and their event/profile references) for clear name corrections.
UPDATE public.clubs AS legacy
SET
  name = 'Computer Society Of India (CSI-JSSSTU)',
  description = NULL,
  faculty_mentor = 'Dr.S P Shiva Prakash., Prof. Dept of ISE',
  is_active = TRUE
WHERE legacy.name = 'CSI Student Chapter'
  AND NOT EXISTS (
    SELECT 1 FROM public.clubs AS official
    WHERE official.name = 'Computer Society Of India (CSI-JSSSTU)'
  );

UPDATE public.events AS event
SET club_id = official.id
FROM public.clubs AS legacy, public.clubs AS official
WHERE legacy.name = 'CSI Student Chapter'
  AND official.name = 'Computer Society Of India (CSI-JSSSTU)'
  AND event.club_id = legacy.id;

UPDATE public.profiles AS profile
SET club_id = official.id
FROM public.clubs AS legacy, public.clubs AS official
WHERE legacy.name = 'CSI Student Chapter'
  AND official.name = 'Computer Society Of India (CSI-JSSSTU)'
  AND profile.club_id = legacy.id;

UPDATE public.clubs AS legacy
SET
  name = 'IEEE-SJCE',
  description = NULL,
  faculty_mentor = 'Dr Veena M G, Prof. Dept of ECE',
  is_active = TRUE
WHERE legacy.name = 'IEEE Student Branch'
  AND NOT EXISTS (
    SELECT 1 FROM public.clubs AS official
    WHERE official.name = 'IEEE-SJCE'
  );

UPDATE public.events AS event
SET club_id = official.id
FROM public.clubs AS legacy, public.clubs AS official
WHERE legacy.name = 'IEEE Student Branch'
  AND official.name = 'IEEE-SJCE'
  AND event.club_id = legacy.id;

UPDATE public.profiles AS profile
SET club_id = official.id
FROM public.clubs AS legacy, public.clubs AS official
WHERE legacy.name = 'IEEE Student Branch'
  AND official.name = 'IEEE-SJCE'
  AND profile.club_id = legacy.id;

INSERT INTO public.clubs (name, description, faculty_mentor, is_active)
VALUES
  ('Linux Campus Club (LCC-JSSSTU)', NULL, 'Dr. Prasanna B T, Associate Prof. Dept of CSE', TRUE),
  ('IEEE-SJCE', NULL, 'Dr Veena M G, Prof. Dept of ECE', TRUE),
  ('DSC-Developer Student Club', NULL, 'Dr. Anil Kumar K M, Prof. Dept of CSE', TRUE),
  ('Computer Society Of India (CSI-JSSSTU)', NULL, 'Dr.S P Shiva Prakash., Prof. Dept of ISE', TRUE),
  ('Team AeroJC', NULL, 'Arun YC & Abhinandan MS, Dept of Mech', TRUE),
  ('TESLA-SJCE', NULL, 'Mr. Ravishankar B S, Assistant Prof. Department of EEE.', TRUE),
  ('Stellar JC', NULL, 'A Thyagarajamurthy & Dr. Sudarshan Patil Kulkarni, Department of ECE.', TRUE),
  ('Hardware Club SJCE', NULL, 'A Thyagarajamurthy & Dr. Sudarshan Patil Kulkarni, Department of ECE.', TRUE),
  ('IIC- JSSSTU', NULL, 'Dr. S Nanjunda Swamy, Department of BT.', TRUE),
  ('VentureX SJCE', NULL, 'Shivashankar B SJCE, STEP.', TRUE),
  ('Bureau Club', NULL, 'Dr Sidram M H, Department of EEE.', TRUE),
  ('The Editorial Board', NULL, 'Dr. Vanishree Arun, Department of ISE.', TRUE),
  ('PhotoOn Photography Club', NULL, 'H.N. Rajendra Prasad, Department of CTM.', TRUE),
  ('Team Gravity', NULL, NULL, TRUE),
  ('Velocity Dance Crew', NULL, NULL, TRUE),
  ('Sahas Adventure Club', NULL, NULL, TRUE),
  ('Naada-The Music Club', NULL, NULL, TRUE)
ON CONFLICT (name) DO UPDATE
SET
  description = EXCLUDED.description,
  faculty_mentor = EXCLUDED.faculty_mentor,
  is_active = EXCLUDED.is_active;

CREATE INDEX IF NOT EXISTS idx_clubs_active_name
  ON public.clubs (is_active, name);
