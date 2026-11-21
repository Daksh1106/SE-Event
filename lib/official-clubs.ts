export interface OfficialClub {
  name: string
  faculty_mentor: string | null
  logo: string
  legacyNames: string[]
}

export const OFFICIAL_CLUBS: OfficialClub[] = [
  {
    name: 'Linux Campus Club (LCC-JSSSTU)',
    faculty_mentor: 'Dr. Prasanna B T, Associate Prof. Dept of CSE',
    logo: '/logos/lcc.png',
    legacyNames: [],
  },
  {
    name: 'IEEE-SJCE',
    faculty_mentor: 'Dr Veena M G, Prof. Dept of ECE',
    logo: '/logos/ieee-sjce.png',
    legacyNames: ['IEEE Student Branch'],
  },
  {
    name: 'DSC-Developer Student Club',
    faculty_mentor: 'Dr. Anil Kumar K M, Prof. Dept of CSE',
    logo: '/logos/dsc.jpeg',
    legacyNames: ['Google Developer Student Clubs - JSSSTU'],
  },
  {
    name: 'Computer Society Of India (CSI-JSSSTU)',
    faculty_mentor: 'Dr.S P Shiva Prakash., Prof. Dept of ISE',
    logo: '/logos/csi.png',
    legacyNames: ['CSI Student Chapter'],
  },
  {
    name: 'Naada-The Music Club',
    faculty_mentor: null,
    logo: '/logos/naada.png',
    legacyNames: [],
  },
  {
    name: 'Team AeroJC',
    faculty_mentor: 'Arun YC & Abhinandan MS, Dept of Mech',
    logo: '/logos/team-aerojc.png',
    legacyNames: [],
  },
  {
    name: 'TESLA-SJCE',
    faculty_mentor: 'Mr. Ravishankar B S, Assistant Prof. Department of EEE.',
    logo: '/logos/tesla-sjce.jpeg',
    legacyNames: [],
  },
  {
    name: 'Stellar JC',
    faculty_mentor: 'A Thyagarajamurthy & Dr. Sudarshan Patil Kulkarni, Department of ECE.',
    logo: '/logos/stellar-jc.jpeg',
    legacyNames: [],
  },
  {
    name: 'Hardware Club SJCE',
    faculty_mentor: 'A Thyagarajamurthy & Dr. Sudarshan Patil Kulkarni, Department of ECE.',
    logo: '/logos/hardware-club.jpeg',
    legacyNames: [],
  },
  {
    name: 'IIC- JSSSTU',
    faculty_mentor: 'Dr. S Nanjunda Swamy, Department of BT.',
    logo: '/logos/iic.jpeg',
    legacyNames: [],
  },
  {
    name: 'VentureX SJCE',
    faculty_mentor: 'Shivashankar B SJCE, STEP.',
    logo: '/logos/venturex.jpeg',
    legacyNames: [],
  },
  {
    name: 'Bureau Club',
    faculty_mentor: 'Dr Sidram M H, Department of EEE.',
    logo: '/logos/bureau.png',
    legacyNames: [],
  },
  {
    name: 'The Editorial Board',
    faculty_mentor: 'Dr. Vanishree Arun, Department of ISE.',
    logo: '/logos/editorial-board.png',
    legacyNames: [],
  },
  {
    name: 'PhotoOn Photography Club',
    faculty_mentor: 'H.N. Rajendra Prasad, Department of CTM.',
    logo: '/logos/photoon.jpeg',
    legacyNames: [],
  },
  {
    name: 'Team Gravity',
    faculty_mentor: null,
    logo: '/logos/team-gravity.png',
    legacyNames: [],
  },
  {
    name: 'Velocity Dance Crew',
    faculty_mentor: null,
    logo: '/logos/velocity-dance-crew.png',
    legacyNames: [],
  },
  {
    name: 'Sahas Adventure Club',
    faculty_mentor: null,
    logo: '/logos/sahas.png',
    legacyNames: [],
  },
]
