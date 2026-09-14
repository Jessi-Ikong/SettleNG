import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import Home from './pages/Home'
import CreateProperty from './pages/CreateProperty'
import PropertyDetail from './pages/PropertyDetail'
import PropertyList from './pages/PropertyList'
import SavedProperties from './pages/SavedProperties'
import SavedSearches from './pages/SavedSearches'
import MyProperties from './pages/MyProperties'
import TenantInspections from './pages/TenantInspections'
import OwnerInspections from './pages/OwnerInspections'
import Messages from './pages/Messages'
import AdminReports from './pages/AdminReports'
import AdminVerifications from './pages/AdminVerifications'
import AdminDashboard from './pages/AdminDashboard'
import AdminUsers from './pages/AdminUsers'
import AdminLocations from './pages/AdminLocations'
import AdminAuditLog from './pages/AdminAuditLog'
import Profile from './pages/Profile'
import TenancyHistory from './pages/TenancyHistory'
import BuildingDetail from './pages/BuildingDetail'
import MyBuildings from './pages/MyBuildings'
import PropertiesHub from './pages/PropertiesHub'
import SavedHub from './pages/SavedHub'
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
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
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
        <Route
          path="/inspections/tenant"
          element={
            <ProtectedRoute>
              <TenantInspections />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/owner"
          element={
            <ProtectedRoute>
              <OwnerInspections />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:conversationId"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/locations"
          element={
            <ProtectedRoute>
              <AdminLocations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <ProtectedRoute>
              <AdminAuditLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute>
              <AdminReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/verifications"
          element={
            <ProtectedRoute>
              <AdminVerifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenancy-history"
          element={
            <ProtectedRoute>
              <TenancyHistory />
            </ProtectedRoute>
          }
        />
        <Route path="/buildings/:id" element={<BuildingDetail />} />
        <Route
          path="/my-buildings"
          element={
            <ProtectedRoute>
              <MyBuildings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/properties-hub"
          element={
            <ProtectedRoute>
              <PropertiesHub />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saved"
          element={
            <ProtectedRoute>
              <SavedHub />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}

export default App
