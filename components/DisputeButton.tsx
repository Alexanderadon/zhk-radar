'use client';
import { useState } from 'react';

/**
 * Кнопка «Оспорить данные».
 *
 * Адреса нет ни в разметке страницы, ни открытым текстом в бандле: почтовые
 * сборщики выгребают и видимый текст, и href="mailto:", поэтому письмо
 * собирается только в момент нажатия. От человека, который откроет исходник,
 * это не спасает — но именно так адрес и попадает в спам-базы.
 */
const BOX = ['YWxleGFuZGVya3VyYWNoYWtvdg==', 'Z21haWwuY29t'];
const mail = () => `${atob(BOX[0])}@${atob(BOX[1])}`;

export default function DisputeButton({ zhkName, slug }: { zhkName: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  const compose = () => {
    const subject = encodeURIComponent(`Оспорить данные: ${zhkName}`);
    const body = encodeURIComponent(
      `ЖК: ${zhkName}\nСтраница: https://zhk-radar.vercel.app/zhk${slug}\n\n` +
        `Что не так:\n\n\nЧем подтверждается (ссылка, документ):\n`
    );
    window.location.href = `mailto:${mail()}?subject=${subject}&body=${body}`;
  };

  // Запасной путь: на телефоне без настроенного почтового клиента mailto молча
  // не делает ничего, и человек упирается в мёртвую кнопку.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mail());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Скопируйте адрес:', mail());
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <button type="button" className="btn" onClick={compose}>Оспорить данные</button>
      <button
        type="button"
        onClick={copy}
        style={{
          border: 'none', background: 'transparent', color: 'var(--text-faint)',
          fontSize: 12, fontFamily: 'var(--font)', cursor: 'pointer', padding: '4px 2px',
        }}
      >
        {copied ? 'адрес скопирован' : 'скопировать адрес почты'}
      </button>
    </div>
  );
}
