import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { App } from './App';
const root = document.getElementById('root');
if (!root) throw new Error('The root element is missing');
const CapabilityLab = lazy(() => import('../../recipes/CapabilityLab'));
createRoot(root).render(new URLSearchParams(location.search).get('sdk-examples') === '1' ? <Suspense fallback={<p>Loading SDK examples…</p>}><CapabilityLab /></Suspense> : <App />);
