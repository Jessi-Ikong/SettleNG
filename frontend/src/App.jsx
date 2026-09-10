import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CreateProperty from './pages/CreateProperty'
import PropertyDetail from './pages/PropertyDetail'
import PropertyList from './pages/PropertyList'
import ProtectedRoute from './components/ProtectedRoute'
import Nav from './components/Nav'

function App() {
  return (
    <>
      <Nav />
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create-property"
        element={
          <ProtectedRoute>
            <CreateProperty />
          </ProtectedRoute>
        }
      />
      <Route path="/properties" element={<PropertyList />} />
      <Route path="/properties/:id" element={<PropertyDetail />} />
      </Routes>
    </>
  )
}

export default App
