-- ==============================================================================
-- College Event & Club Hub - Seed Data
-- Clubs directory initial seed (FR-15, Section 7.2)
-- ==============================================================================

INSERT INTO public.clubs (name, description, faculty_mentor, is_active)
VALUES
  (
    'Linux Campus Club (LCC-JSSSTU)',
    NULL,
    'Dr. Prasanna B T, Associate Prof. Dept of CSE',
    TRUE
  ),
  (
    'IEEE-SJCE',
    NULL,
    'Dr Veena M G, Prof. Dept of ECE',
    TRUE
  ),
  (
    'DSC-Developer Student Club',
    NULL,
    'Dr. Anil Kumar K M, Prof. Dept of CSE',
    TRUE
  ),
  (
    'Computer Society Of India (CSI-JSSSTU)',
    NULL,
    'Dr.S P Shiva Prakash., Prof. Dept of ISE',
    TRUE
  ),
  (
    'Team AeroJC',
    NULL,
    'Arun YC & Abhinandan MS, Dept of Mech',
    TRUE
  ),
  (
    'TESLA-SJCE',
    NULL,
    'Mr. Ravishankar B S, Assistant Prof. Department of EEE.',
    TRUE
  ),
  (
    'Stellar JC',
    NULL,
    'A Thyagarajamurthy & Dr. Sudarshan Patil Kulkarni, Department of ECE.',
    TRUE
  ),
  (
    'Hardware Club SJCE',
    NULL,
    'A Thyagarajamurthy & Dr. Sudarshan Patil Kulkarni, Department of ECE.',
    TRUE
  ),
  (
    'IIC- JSSSTU',
    NULL,
    'Dr. S Nanjunda Swamy, Department of BT.',
    TRUE
  ),
  (
    'VentureX SJCE',
    NULL,
    'Shivashankar B SJCE, STEP.',
    TRUE
  ),
  (
    'Bureau Club',
    NULL,
    'Dr Sidram M H, Department of EEE.',
    TRUE
  ),
  (
    'The Editorial Board',
    NULL,
    'Dr. Vanishree Arun, Department of ISE.',
    TRUE
  ),
  (
    'PhotoOn Photography Club',
    NULL,
    'H.N. Rajendra Prasad, Department of CTM.',
    TRUE
  ),
  (
    'Team Gravity',
    NULL,
    NULL,
    TRUE
  ),
  (
    'Velocity Dance Crew',
    NULL,
    NULL,
    TRUE
  ),
  (
    'Sahas Adventure Club',
    NULL,
    NULL,
    TRUE
  ),
  (
    'Naada-The Music Club',
    NULL,
    NULL,
    TRUE
  )
ON CONFLICT (name) DO UPDATE 
SET 
  description = EXCLUDED.description,
  faculty_mentor = EXCLUDED.faculty_mentor,
  is_active = EXCLUDED.is_active;
