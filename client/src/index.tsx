import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from "react-helmet-async";
import App from './App';
import './index.css';
import { router } from './app/router';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <RouterProvider router={router}>
        <App />
      </RouterProvider>
    </HelmetProvider>
  </React.StrictMode>
);

