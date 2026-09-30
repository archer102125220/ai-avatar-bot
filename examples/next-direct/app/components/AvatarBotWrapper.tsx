'use client';

import dynamic from 'next/dynamic';

const AvatarBotDirect = dynamic(
  () => import('./AvatarBotDirect'),
  {
    ssr: false,
    loading: () => (
      <div className="avatar-bot-direct__workspace">
        <section className="avatar-bot-direct__stage-card">
          <div className="avatar-bot-direct__viewport">
            <div className="avatar-bot-direct__placeholder">
              Loading AI Avatar Bot on Client...
            </div>
          </div>
        </section>
      </div>
    )
  }
);

export default function AvatarBotWrapper() {
  return <AvatarBotDirect />;
}
