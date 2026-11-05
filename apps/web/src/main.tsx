import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
function App() {
  const [config,setConfig]=useState<{oidc:boolean;mini:boolean}>(), [message,setMessage]=useState('Проверяем доступность входа…');
  useEffect(()=>{
    void (async()=>{
      const response=await fetch('/api/config');
      if (!response.ok) throw new Error('config');
      const c=await response.json() as {oidc:boolean;mini:boolean}; setConfig(c);
      const initData=(window as Window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData;
      if (initData && c.mini) {
        const login=await fetch('/auth/mini',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData})});
        if (!login.ok) { setMessage('Не удалось войти через Telegram. Откройте Mini App заново.'); return; }
      }
      const session=await fetch('/api/session');
      if (session.ok) setMessage('Вход выполнен. Данные сохраняются на сервере. Интерфейс калькулятора готовится.');
      else if (session.status===401) setMessage(c.oidc ? 'Войдите через Telegram, чтобы открыть свои данные.' : c.mini ? 'Для входа откройте приложение в Telegram.' : 'Вход через Telegram пока не настроен. Личные данные недоступны.');
      else setMessage('Сервис временно недоступен. Попробуйте позже.');
    })().catch(()=>setMessage('Не удалось связаться с сервером. Проверьте соединение и повторите попытку.'));
  },[]);
  return <main><p className="eyebrow">Калькулятор модов Cheapshot</p><h1>Ваш инвентарь.<br/>Ваш эксперимент.</h1><p className="mods" aria-hidden="true">🅾 💢 💚 🧿</p><p role="status">{message}</p>{config?.oidc && <a className="button" href="/auth/oidc/start">Войти через Telegram</a>}<p className="note">Техническая основа сервиса. Полный интерфейс калькулятора ещё в разработке.</p></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
