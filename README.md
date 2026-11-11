# Portfolio CMS

A personal portfolio website built with React and Vite, using Firebase for authentication and data storage.

The website allows visitors to explore my profile, skills, and projects. It also includes an admin dashboard where I can update my personal information and manage my projects without editing the code manually.

### Features
- Personal profile and introduction
- Project showcase with images and descriptions
- Admin login using Firebase Authentication
- Dashboard for managing profile details and projects
- Cloudinary integration for project image uploads
- Real-time updates through Cloud Firestore

### Tech Stack
- React
- Vite
- Firebase Authentication
- Cloud Firestore
- Cloudinary

### Configure Firebase on Vercel

The live site needs Firebase environment variables in Vercel. A local `.env.local` file only applies when running the project on your computer.

1. In Firebase Console, open **Project settings** and copy the config values from your registered web app.
2. In **Authentication**, enable the sign-in provider used by the admin account, then create the admin user and copy its UID.
3. In Vercel, open the project and go to **Settings → Environment Variables**. Add these variables for each environment where the site should work (Production, and Preview if needed):

	- `VITE_FIREBASE_API_KEY`
	- `VITE_FIREBASE_AUTH_DOMAIN`
	- `VITE_FIREBASE_PROJECT_ID`
	- `VITE_FIREBASE_MESSAGING_SENDER_ID`
	- `VITE_FIREBASE_APP_ID`
	- `VITE_ADMIN_UID` (the admin user's Firebase Authentication UID)

4. For project image uploads, also add `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` using your Cloudinary settings.
5. Save the variables and redeploy the project. Vite reads `VITE_` variables during the build, so changing them requires a new deployment.

For local development, copy `.env.example` to `.env.local`, fill in the same values, and restart the Vite dev server. Do not commit `.env.local` or add Firebase service-account private keys to Vercel; this app uses the Firebase web configuration in the browser.
