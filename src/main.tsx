import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Spike } from './spike/Spike';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Spike />
  </StrictMode>,
);
