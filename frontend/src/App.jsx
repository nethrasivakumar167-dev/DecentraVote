import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoadingState } from './components/common'
import MainLayout from './layouts/MainLayout'
import { PollProvider } from './context/PollProvider'
import { WalletProvider } from './context/WalletProvider'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Explore = lazy(() => import('./pages/Explore'))
const CreatePoll = lazy(() => import('./pages/CreatePoll'))
const PollDetails = lazy(() => import('./pages/PollDetails'))
const Results = lazy(() => import('./pages/Results'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  return (
    <WalletProvider>
      <PollProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/create" element={<CreatePoll />} />
                <Route path="/poll/:id" element={<PollDetails />} />
                <Route path="/results" element={<Results />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </PollProvider>
    </WalletProvider>
  )
}
