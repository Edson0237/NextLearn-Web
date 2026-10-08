import { Routes } from '@angular/router';

// Le site est une page unique : les sections sont empilees dans
// `app.html`, pas routees. Les pages legales exigees par le Play Store
// sont des fichiers statiques sous `public/`, servis directement par
// l'hebergeur — voir `tools/build-legal.mjs`.
export const routes: Routes = [];
