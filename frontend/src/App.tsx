import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import './index.css';

const Home          = lazy(() => import('@/pages/Home'));
const Dashboard     = lazy(() => import('@/pages/Dashboard'));
const Analytics     = lazy(() => import('@/pages/Analytics'));
const Login         = lazy(() => import('@/pages/Login'));
const Register      = lazy(() => import('@/pages/Register'));
const SocialQR      = lazy(() => import('@/pages/SocialQR'));
const SocialProfile = lazy(() => import('@/pages/SocialProfile'));

function Loader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <span className="spinner spinner--brand" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/"               element={<Home />} />
          <Route path="/social"         element={<SocialQR />} />
          <Route path="/profile/create" element={<SocialProfile />} />
          <Route path="/profile/edit/:id" element={<SocialProfile />} />
          <Route path="/dashboard"      element={<Dashboard />} />
          <Route path="/analytics/:id"  element={<Analytics />} />
          <Route path="/login"          element={<Login />} />
          <Route path="/register"       element={<Register />} />
        </Routes>
      </Suspense>
      <Routes>
        <Route path="/"    element={<Footer />} />
        <Route path="/social" element={<Footer />} />
      </Routes>
    </BrowserRouter>
  );
}
