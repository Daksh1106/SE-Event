-- Rename the Google Developer Student Club to DSC and add Naada from the supplied club list.
-- Preserve event and coordinator links if both old and new DSC rows exist.

DO $$
DECLARE
  old_dsc_id UUID;
  new_dsc_id UUID;
BEGIN
  SELECT id INTO old_dsc_id
  FROM public.clubs
  WHERE name = 'Google Developer Student Clubs - JSSSTU';

  SELECT id INTO new_dsc_id
  FROM public.clubs
  WHERE name = 'DSC-Developer Student Club';

  IF old_dsc_id IS NOT NULL AND new_dsc_id IS NOT NULL THEN
    UPDATE public.events
    SET club_id = new_dsc_id
    WHERE club_id = old_dsc_id;

    UPDATE public.profiles
    SET club_id = new_dsc_id
    WHERE club_id = old_dsc_id;

    UPDATE public.clubs
    SET is_active = FALSE
    WHERE id = old_dsc_id;

    UPDATE public.clubs
    SET
      faculty_mentor = 'Dr. Anil Kumar K M, Prof. Dept of CSE',
      is_active = TRUE
    WHERE id = new_dsc_id;
  ELSIF old_dsc_id IS NOT NULL THEN
    UPDATE public.clubs
    SET
      name = 'DSC-Developer Student Club',
      faculty_mentor = 'Dr. Anil Kumar K M, Prof. Dept of CSE',
      is_active = TRUE
    WHERE id = old_dsc_id;
  ELSE
    INSERT INTO public.clubs (name, description, faculty_mentor, is_active)
    VALUES (
      'DSC-Developer Student Club',
      NULL,
      'Dr. Anil Kumar K M, Prof. Dept of CSE',
      TRUE
    )
    ON CONFLICT (name) DO UPDATE
    SET
      faculty_mentor = EXCLUDED.faculty_mentor,
      is_active = TRUE;
  END IF;
END $$;

INSERT INTO public.clubs (name, description, faculty_mentor, is_active)
VALUES ('Naada-The Music Club', NULL, NULL, TRUE)
ON CONFLICT (name) DO UPDATE
SET
  faculty_mentor = EXCLUDED.faculty_mentor,
  is_active = TRUE;
