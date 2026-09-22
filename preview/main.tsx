import React from 'react';
import { createRoot } from 'react-dom/client';
import ScanWalkthroughPreview from '../components/dev/scan-walkthrough/ScanWalkthroughPreview';

createRoot(document.getElementById('root')!).render(<React.StrictMode><ScanWalkthroughPreview /></React.StrictMode>);
