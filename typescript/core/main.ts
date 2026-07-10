import './style/style.scss';

export function initAvatarBot(element: HTMLElement | null): void {
  if (!element) return;
  element.innerHTML = '<h1>Hello World from TypeScript Avatar Bot!</h1>';
}
