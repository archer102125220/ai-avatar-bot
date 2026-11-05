import 'zone.js';
import '@ai-avatar-bot/sdk/style.css';
import './styles.css';

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent).catch((err: unknown) => {
  console.error('[analog-direct] Bootstrap error:', err);
});
