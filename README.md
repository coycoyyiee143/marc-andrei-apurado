# Portfolio CMS

React + Vite portfolio na may Firebase Authentication at Cloud Firestore. Public read-only ang portfolio; ang admin account lang ang puwedeng mag-edit ng profile at projects.

## Firebase setup

1. Gumawa ng Firebase project sa [Firebase Console](https://console.firebase.google.com/) at mag-add ng Web App.
2. Sa **Authentication → Sign-in method**, i-enable ang **Email/Password**.
3. Sa **Authentication → Users**, gumawa ng account para sa admin. Walang public sign-up form sa app.
4. Gumawa ng Cloud Firestore database.
5. Sa Cloudinary, buksan **Settings → Upload → Upload presets** at gumawa ng preset. I-enable ang **Unsigned**, limitahan ang allowed formats sa JPG, PNG, WebP, at GIF, itakda ang maximum file size sa 5 MB, at i-set ang folder bilang `portfolio/projects`.
6. Kopyahin ang web app config sa `.env.example`, palitan ang sample values, at i-save bilang `.env.local` sa project root. Ilagay ang pangalan ng preset sa `VITE_CLOUDINARY_UPLOAD_PRESET`. Ang cloud name mo ay `cj3iusnm`.
7. Kopyahin ang UID ng admin account mula sa Authentication → Users papunta sa `VITE_ADMIN_UID` sa `.env.local`.
8. Sa Firestore Rules, i-publish ang laman ng `firestore.rules`. Siguraduhing pareho ang admin UID sa `.env.local` at sa rules file.
9. Patakbuhin ang app:

   ```sh
   npm install
   npm run dev
   ```

Pumunta sa `http://localhost:5173/#admin` para mag-sign in at maglagay ng profile details, projects, at project images (JPG, PNG, WebP, o GIF hanggang 5 MB). Sa public page, makikita ang updates nang real-time.

## Security notes

- Huwag i-commit ang `.env.local`; naka-ignore ang `*.local` sa `.gitignore`. Ang Firebase web config ay visible sa browser by design, kaya Firestore Rules ang nagpoprotekta sa writes.
- Ang `VITE_ADMIN_UID` ay client-side gate lang para sa dashboard UI. Ang tunay na authorization ay ang UID check sa `firestore.rules`.
- Gamitin ang tamang admin UID sa published rules para ikaw lang ang may write access.
- Ang Cloudinary unsigned preset ay pampubliko dahil ginagamit ito sa browser. Limitahan ang file types at size sa preset, at bantayan ang Cloudinary usage. Firestore writes ay admin-only.
- Ang pagpapalit o pag-delete ng project ay hindi awtomatikong nagtatanggal ng lumang Cloudinary file; linisin ito sa Cloudinary Media Library kung kailangan.
- Gumagana ang public page kahit hindi pa naka-configure ang Firebase, pero walang live data hanggang maidagdag ang config at Firestore documents.

## Firestore data

- `profile/main`: `name`, `role`, `location`, `email`, `bio`, `objective`, `github`, `linkedin`
- `projects/{projectId}`: `title`, `year`, `description`, `technologies` (array), `link`, `imageUrl`, `imagePublicId`