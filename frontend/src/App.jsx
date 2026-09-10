import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CreateProperty from './pages/CreateProperty'
import PropertyDetail from './pages/PropertyDetail'
import PropertyList from './pages/PropertyList'
import SavedProperties from './pages/SavedProperties'
import SavedSearches from './pages/SavedSearches'
import MyProperties from './pages/MyProperties'
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
        <Route
          path="/edit-property/:id"
          element={
            <ProtectedRoute>
              <CreateProperty />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-properties"
          element={
            <ProtectedRoute>
              <MyProperties />
            </ProtectedRoute>
          }
        />
        <Route path="/properties" element={<PropertyList />} />
        <Route path="/properties/:id" element={<PropertyDetail />} />
        <Route
          path="/saved-properties"
          element={
            <ProtectedRoute>
              <SavedProperties />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saved-searches"
          element={
            <ProtectedRoute>
              <SavedSearches />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}

export default App
