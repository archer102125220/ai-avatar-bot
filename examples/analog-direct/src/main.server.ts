import 'zone.js/node';
import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { AppComponent } from './app/app.component';

enableProdMode();

export default async function render(url: string, document: string): Promise<string> {
  const html = await renderApplication(
    () => bootstrapApplication(AppComponent),
    {
      document,
      url
    }
  );
  return html;
}
