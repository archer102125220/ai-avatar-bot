import AvatarBotWrapper from './components/AvatarBotWrapper';

export default function HomePage() {
  return (
    <main className="avatar-bot-direct">
      <header className="avatar-bot-direct__header">
        <h1 className="avatar-bot-direct__title">AI Avatar Bot - Next.js Direct Example</h1>
        <p className="avatar-bot-direct__subtitle">
          Next.js App Router Server Component with Client Leaf Wrapper & Asset Sync
        </p>
      </header>

      <AvatarBotWrapper />
    </main>
  );
}
