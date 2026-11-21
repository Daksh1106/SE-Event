# Software Requirements Specification (SRS)
## College Event & Club Hub
**JSS Science and Technology University, Mysuru | Software Engineering course project**  
**Version 0.3 | 21 November 2026**

---

### 1. Preface
This document defines what the College Event & Club Hub must do. It is written for the course teacher, the five team members (developers and testers), and the club coordinators and students who will use the system. It is meant to be agreed before design and implementation begin and to serve as the basis for the test cases in Appendix C.

| Version | Date | Change |
|---|---|---|
| 0.1 | 3 Nov 2026 | First draft from interviews and class notes |
| 0.2 | 3 Nov 2026 | Scope cut to 14 must-have requirements; diagrams added; restructured to the ten-point SRS layout; every requirement now has a test |
| 0.3 | 21 Nov 2026 | Updated the development increments to use functional names instead of calendar-day labels and aligned the description with the delivered feature groups |

---

### 2. Introduction
#### 2.1 Problem
Events and club activities are announced through WhatsApp groups, posters, Instagram and class announcements, so students who miss one channel miss the event. Registration happens through separate Google Forms, which expire, hide the number of seats left, and allow duplicates. Coordinators have no single place to manage events, members and registrations, and certificates reach students days after an event, as soft or hard copies.

#### 2.2 Proposed system
A web platform where students browse approved events and a read-only clubs directory, register (or join a waitlist when full), see reminders and download certificates. Club coordinators create events, send them for faculty approval, manage registrations, mark attendance and issue certificates. Faculty/HOD approvers approve or reject events.

#### 2.3 Scope
The first version has 14 must-have and 2 should-have requirements, which five people can build and test in 7-10 days.  
- **Must have:** accounts and roles, event creation and approval, an event list with live seats left, registration with a seat limit and waitlist, a My Events page with reminders and alerts, attendance, PDF export of registrations, certificate generation and download.  
- **Should have:** a read-only clubs directory and a WhatsApp share button.  
- **Future uses (Section 8):** calendar view, joining clubs, email reminders, editing or cancelling events, club-member attendance, uploading ready-made certificates, online payments, WhatsApp automation, USN verification.

#### 2.4 Advantages and disadvantages
- **Advantages:** all events on one page; live seat count; no duplicate or expired registrations; coordinators work from one dashboard; certificates available as soon as the coordinator issues them.  
- **Disadvantages:** needs internet access; value depends on coordinators posting events; reminders reach only students who open the site; USN is not independently verified, so someone could create an account with another student's USN before that student does.

#### 2.5 Development approach
The project uses incremental development: specification, design, implementation and testing overlap, and each increment provides a working version. Increments are described by their functionality rather than by calendar-day labels:
- **Identity and event governance:** accounts, roles, event creation and approvals.
- **Event discovery and registration:** event browsing, seat limits, waitlists, My Events and alerts.
- **Coordinator operations and certificates:** registration exports, attendance and certificate generation and download.
- **Club directory and delivery:** official club information, responsive presentation, performance checks and documentation.

---

### 3. Glossary
| Term | Meaning |
|---|---|
| USN | University Seat Number, the student's college ID |
| Coordinator | A club member who creates and manages events for a club |
| Approver | A faculty member or HOD who approves events |
| Seat limit | Maximum confirmed registrations for an event |
| Waitlist | Ordered queue of students waiting for a seat in a full event |
| Registration deadline | Last date and time to register for an event |
| Alert | A message shown on the student's My Events page, such as a waitlist seat opening |
| Increment | A working version of the system built in one stage of development |
| SRS | Software Requirements Specification |
| FR / NFR / UR | Functional / Non-functional / User requirement |

---

### 4. User requirements definition
#### 4.1 Users
| Actor | Description |
|---|---|
| Student | Browses events, registers, downloads certificates |
| Club Coordinator | Creates events for their club; the publicity team uses this role |
| Approver (Faculty/HOD) | Approves or rejects events |
| System admin | Creates coordinator and approver accounts (done by the team) |

#### 4.2 Evidence from interviews
- Students hear about events from Instagram, friends, class announcements and WhatsApp posters; a student missed an event because there was no announcement in their class (Student).
- Registration end dates are unclear; links expire; seats left are unknown; students are turned away when full (Student).
- Certificates arrive a few days after the event, as soft or hard copy (Student).
- Student wants one good-looking page with announcements and live seat updates; would log in with USN (Student).
- Events are planned about a month ahead; a publicity team announces in classes and through class representatives on WhatsApp (Coordinator).
- Venues are often full; popular events draw around 200 students (Coordinator).
- Members attend an hour early and attendance is taken; each club has a certificate template with small changes per event (Coordinator).
- Every event needs HOD and teacher approval; registration list is needed as PDF; most events are free, a few cost Rs 50-100 (Coordinator).

#### 4.3 User requirements
| ID | Requirement |
|---|---|
| UR-1 | Students can see all approved upcoming events in one place with date, venue, fee, deadline and seats left |
| UR-2 | Students can register quickly and know whether they are confirmed or waitlisted |
| UR-3 | Students are reminded about events they registered for and are told when a waitlist seat becomes theirs |
| UR-4 | Students can see which clubs exist |
| UR-5 | Students can download their certificates after attending |
| UR-6 | Coordinators can create events and send them for approval |
| UR-7 | Coordinators can see registrations, control seat limits and export the list as PDF |
| UR-8 | Coordinators can mark attendance and issue certificates from their club template |
| UR-9 | Approvers can approve or reject events |
| UR-10 | Personal data is protected and each role sees only what it needs |

---

### 5. System architecture
The system uses a layered architecture inside a client-server setup. The browser reaches the Next.js web app over HTTPS, and only its logic layer talks to the database, authentication and file storage.

#### 5.2 Layers
- **Presentation:** Pages and components in the browser: event list, event page, registration, My Events, coordinator screens, approver screen.
- **Application logic:** Server-side rules: login and roles, approval flow, seat limit and waitlist, attendance, certificate generation.
- **Data and services:** PostgreSQL database, authentication service, file storage for certificates.

#### 5.3 Data tables
`profiles` (USN, name, optional phone and email, role), `clubs`, `events`, `registrations` (status: confirmed, waitlisted, cancelled, attended), `approvals`, `alerts`, `certificates`.

---

### 6. System requirements specification
#### 6.1 Functional requirements
| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-1 | A student can create an account with a USN in the valid format and a self-chosen password; name, phone and email are optional; one account per USN | M | UR-10 |
| FR-2 | A user can log in and log out with USN and password | M | UR-10 |
| FR-3 | Coordinator and approver accounts are created by the system admin; a student cannot give themselves these roles | M | UR-10 |
| FR-4 | A coordinator can create an event with title, description, club, date and time, venue, contact details, fee (free or amount), seat limit and registration deadline; it is saved as Pending | M | UR-6 |
| FR-5 | An approver can approve or reject a Pending event (with a reason if rejected); the approver and time are recorded; students see only approved events | M | UR-9 |
| FR-6 | Students can view approved upcoming events as a list and filter by club and date | M | UR-1 |
| FR-7 | The event page shows description, venue, fee, contact details, registration deadline and live seats left | M | UR-1 |
| FR-8 | A logged-in student can register for an event before its deadline if seats are left; one registration per student per event; registration closes automatically after the deadline | M | UR-2 |
| FR-9 | When an event is full, a student can join the waitlist and see their position; a student can cancel; when a confirmed student cancels, the first waitlisted student is promoted automatically | M | UR-2 |
| FR-10 | A My Events page shows registered, waitlisted and past events, a banner for events within 24 hours, and an alert when the student is promoted from the waitlist | M | UR-3 |
| FR-11 | A coordinator can view the registrations and waitlist of their own events and export the confirmed list as PDF | M | UR-7 |
| FR-12 | A coordinator can mark attendance of registered participants | M | UR-8 |
| FR-13 | A coordinator can generate certificates from the club template (student name, event, date, club) for attended students | M | UR-8 |
| FR-14 | A student can download their own certificates | M | UR-5 |
| FR-15 | A read-only clubs directory shows each club's name, description, faculty mentor and upcoming events | S | UR-4 |
| FR-16 | A Share on WhatsApp button creates a message with the event title, date and link | S | Coordinator |

#### 6.2 Non-functional requirements
| ID | Type | Requirement |
|---|---|---|
| NFR-1 | Usability | All pages are usable on phones (360 px wide and up) and laptops |
| NFR-2 | Usability | After login, a student reaches a confirmed registration within 5 clicks from the home page |
| NFR-3 | Performance | The event list loads within 3 seconds on a normal campus connection with up to 100 events |
| NFR-4 | Performance (capacity) | One event supports at least 200 registrations |
| NFR-5 | Dependability | The seat limit is never exceeded, even when several students register at the same moment |
| NFR-6 | Security | Passwords are never stored in plain text |
| NFR-7 | Security | A student can see only their own registrations and certificates |
| NFR-8 | Security | Coordinator and approver screens are open only to those roles, and a coordinator manages only their own club's events |
| NFR-9 | Environment | Runs in current versions of Chrome, Edge, Firefox and Safari; hosted online |
| NFR-10 | Operational | The system admin creates coordinator and approver accounts |
| NFR-11 | Development | Built with Next.js, TypeScript, Tailwind CSS and Supabase; code is kept in Git; AI-assisted code must be understood and documented by the team |
| NFR-12 | Regulatory / Privacy | Only USN and optional name, phone and email are collected and used only for event purposes, in line with applicable Indian data-protection law |
| NFR-13 | Ethical | No student data is sold or shared with third parties, and there are no advertisements |
| NFR-14 | Legislative / Accountability | The system records who approved each event and when, and the time of each registration |

---

### 7. Test cases (Appendix C)
| Test | Covers | Steps | Expected result |
|---|---|---|---|
| TC-1 | FR-1 | Create an account with a valid USN and password; try an invalid USN format | Valid account created; invalid USN rejected |
| TC-2 | FR-1 | Create a second account with an existing USN | Rejected with a message |
| TC-3 | FR-2, NFR-6 | Log in with a wrong password, then the right one, then log out; check how the password is stored | Wrong password refused; right one works; password stored hashed |
| TC-4 | FR-3, NFR-8, NFR-10 | As a student, open coordinator and approver pages and try to change own role; as admin, create a coordinator | Student access refused; admin-created account works |
| TC-5 | FR-4 | Coordinator creates an event with all fields; try again with a required field missing | Saved as Pending; missing field rejected |
| TC-6 | FR-5, NFR-14 | Student views list; approver approves; student views list; approver rejects another event with a reason | Hidden while Pending, visible after approval; approver and time recorded |
| TC-7 | FR-6 | Open the event list; filter by club and by date | Only approved upcoming events shown; filters work |
| TC-8 | FR-7 | Open an event page | Description, venue, fee, contact, deadline and live seats left shown |
| TC-9 | FR-8 | Register for an event with free seats | Status Confirmed; seats left reduced by 1 |
| TC-10 | FR-8 | Register twice for the same event | Second attempt blocked |
| TC-11 | FR-8 | Register after the deadline | Refused with a clear message |
| TC-12 | FR-9 | Register for a full event | Offered the waitlist; position shown |
| TC-13 | FR-9 | A confirmed student cancels while others are waitlisted | First waitlisted student becomes Confirmed; seat count correct |
| TC-14 | NFR-5 | Two students take the last seat at the same moment | Exactly one Confirmed, the other Waitlisted |
| TC-15 | NFR-4 | Create 200 registrations on one event with a test script | No error; seat limit never exceeded |
| TC-16 | FR-10 | Register for an event within 24 hours; get promoted from a waitlist | Banner shown; alert shown on My Events |
| TC-17 | FR-11 | Coordinator opens registrations of own event and of another club's event; exports PDF | Own list shown, other club's refused; PDF lists all confirmed students |
| TC-18 | FR-12 | Coordinator marks some participants as attended | Status changes to Attended for those students only |
| TC-19 | FR-13 | Generate certificates for an event | Created only for attended students, with correct name, event, date and club |
| TC-20 | FR-14, NFR-7 | Student downloads own certificate; tries another student's link | Own works; the other is refused |
| TC-21 | FR-15 | Open the clubs directory | Clubs listed with description, mentor and upcoming events |
| TC-22 | FR-16 | Press Share on WhatsApp on an event | WhatsApp opens with title, date and link |
| TC-23 | NFR-3 | Load the event list with 100 sample events | Loads within 3 seconds |
| TC-24 | NFR-1, NFR-2 | Open main pages at 360 px width; count clicks from home to a confirmed registration | Usable without sideways scrolling; 5 clicks or fewer |
| TC-25 | NFR-9, NFR-11, NFR-12, NFR-13 | Inspection: open the site in four browsers; check the stack and Git history; list stored personal fields; check for third-party sharing and ads | Works in all four; stack as stated; only USN, phone and email stored; no sharing or ads |
