# Islamic Academy Attendance

A mobile attendance app for Islamic and Arabic classes, built with React Native, Expo, and TypeScript.

## Features

- Register students with name, date of birth, parent/guardian name and phone, address/location, and class.
- Create a student ID card with a QR code. The QR contains only a randomly generated student ID; personal details stay in the app.
- Scan QR cards with the device camera to check students in and out.
- View today's roster and attendance records, including arrival/departure times and late status.
- Local device storage for the initial version.

## Attendance schedule

The app uses the requested schedule: check-in opens at **11:00 AM**, arrival after **4:30 PM** is marked **Late**, and dismissal is **6:00 PM**. The late cutoff is implemented as 4:30 PM local device time. Students without a check-in are shown as not checked in (rather than automatically marked absent).

## Run the app

1. Install Node.js LTS and Expo Go on a compatible phone.
2. In this repository directory run `npm install`.
3. Run `npx expo start` and scan the development QR code with Expo Go.
4. Allow camera access when prompted to use the scanner.

Use `npm run typecheck` to check TypeScript. For an installable iOS or Android build, configure the Expo EAS build service and app identifiers.

## Privacy and limitations

Student data is saved locally on the device and is not synced or backed up. Protect the device with a passcode and restrict access to authorized staff. A production deployment should add authenticated staff accounts, encrypted/synced storage, backups, consent/retention policies, and a secure process for exporting or deleting student records. Do not put personal information in QR codes or public repositories.
