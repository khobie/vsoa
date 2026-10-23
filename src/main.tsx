import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { ElectionsProvider } from './components/elections-provider'
import { AuthProvider } from './components/auth-provider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ElectionsProvider>
          <App />
        </ElectionsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
