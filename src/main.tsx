import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { ElectionsProvider } from './components/elections-provider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ElectionsProvider>
        <App />
      </ElectionsProvider>
    </BrowserRouter>
  </StrictMode>,
)
