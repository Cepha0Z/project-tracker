# Studio Projects

A local-first project visibility and accountability application for an architecture office.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Prototype accounts

The login screen lets you switch between Kiran and Manoj (Principal access), Sudiksha and Rahul (Project Leads), and Rahul or Siddharth (employee work views). No password is used in this local prototype.

## Data

Sample data and all changes are stored in browser `localStorage`. A repository boundary and domain services isolate projects, work items, cycles, updates, time entries, help requests, and activity from the interface so a remote adapter can replace local storage later.

The application includes direct work completion/reopening, work-item editing and assignment, project team and stage management, daily reporting, question versus blocker handling, structured escalation and Principal decisions, cycle closure, and carry-forward.

## Build check

```bash
npm run build
```
