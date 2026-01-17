import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import ScrollToTop from './components/common/ScrollToTop';
import { needsBasicProfileInfo } from './utils/profileValidation';

// --- COMPONENTS ---
import Navigation from './components/common/Navigation';
import Chatbot from './components/common/Chatbot';
import Footer from './components/common/Footer.jsx';
import LoadingScreen from './components/common/LoadingScreen';
import AdminNavbar from './components/admin/AdminNavbar';
import ProfileCompletionPopup from './components/common/ProfileCompletionPopup';

// --- USER PAGES ---
import Home from './pages/user/Home';
import Adopt from './pages/user/Adopt';
import AdoptionForm from './pages/user/AdoptionForm';
import Volunteer from './pages/user/Volunteer';
import Donate from './pages/user/Donate';
import Community from './pages/user/Community';
import LostFound from './pages/user/LostFound';
import MyAdoptions from './pages/user/MyAdoptions';
import Notifications from './pages/user/Notifications';
import Profile from './pages/user/Profile';
import Login from './pages/user/Login';
import Signup from './pages/user/Signup';
import ResetPassword from './pages/user/ResetPassword';
import NotFound from './pages/user/NotFound';

// --- ADMIN PAGES ---
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPetsWithProtection from './pages/admin/AdminPets';
import AdminAdoptions from './pages/admin/AdminAdoptions';
import AdminLostFound from './pages/admin/AdminLostFound';
import AdminVolunteer from './pages/admin/AdminVolunteer';
import DonationManagement from './pages/admin/DonationManagement';
import CommunityPosts from './pages/admin/CommunityPosts';

// Chatbot Wrapper - Only show for logged-in non-admin users
const ChatbotWrapper = () => {
    const { user } = useAuth();

    if (!user || user.email?.includes('admin')) {
        return null;
    }

    return <Chatbot />;
};

// Layout wrapper that conditionally shows user/admin navigation
const AppLayout = () => {
    const location = useLocation();
    const { user, profile, loading, isAdmin, refreshProfile } = useAuth();
    const isAdminRoute = location.pathname.startsWith('/admin');
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const [popupDismissed, setPopupDismissed] = useState(false);

    // Check if profile popup should show
    useEffect(() => {
        if (
            !loading &&
            user &&
            !isAdmin &&
            !popupDismissed &&
            needsBasicProfileInfo(profile)
        ) {
            setShowProfilePopup(true);
        } else {
            setShowProfilePopup(false);
        }
    }, [loading, user, isAdmin, profile, popupDismissed]);

    const handleProfileComplete = async () => {
        setShowProfilePopup(false);
        setPopupDismissed(true);
        if (refreshProfile) {
            await refreshProfile();
        }
    };

    return (
        <div className={`app-container ${isAdminRoute ? 'admin-layout' : ''}`}>
            {isAdminRoute ? <AdminNavbar /> : <Navigation />}

            <main className={`main-content ${isAdminRoute ? 'admin-main' : ''}`}>
                <Routes>
                    {/* --- PUBLIC ROUTES --- */}
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/adopt" element={<Adopt />} />
                    <Route path="/volunteer" element={<Volunteer />} />
                    <Route path="/donate" element={<Donate />} />
                    <Route path="/community" element={<Community />} />
                    <Route path="/lost-found" element={<LostFound />} />

                    {/* --- PROTECTED USER ROUTES --- */}
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/Notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                    <Route path="/adopt/:petId" element={<ProtectedRoute><AdoptionForm /></ProtectedRoute>} />
                    <Route path="/myadoptions" element={<ProtectedRoute><MyAdoptions /></ProtectedRoute>} />

                    {/* --- ADMIN ROUTES --- */}
                    <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin/users" element={<ProtectedRoute requireAdmin={true}><AdminUsers /></ProtectedRoute>} />
                    <Route path="/admin/pets" element={<ProtectedRoute requireAdmin={true}><AdminPetsWithProtection /></ProtectedRoute>} />
                    <Route path="/admin/adoptions" element={<ProtectedRoute requireAdmin={true}><AdminAdoptions /></ProtectedRoute>} />
                    <Route path="/admin/lost-found" element={<ProtectedRoute requireAdmin={true}><AdminLostFound /></ProtectedRoute>} />
                    <Route path="/admin/volunteer" element={<ProtectedRoute requireAdmin={true}><AdminVolunteer /></ProtectedRoute>} />
                    <Route path="/admin/donations" element={<ProtectedRoute requireAdmin={true}><DonationManagement /></ProtectedRoute>} />
                    <Route path="/admin/posts" element={<ProtectedRoute requireAdmin={true}><CommunityPosts /></ProtectedRoute>} />

                    {/* 404 Page */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </main>

            {!isAdminRoute && <Footer />}
            {!isAdminRoute && <ChatbotWrapper />}

            {showProfilePopup && user && (
                <ProfileCompletionPopup user={user} onComplete={handleProfileComplete} />
            )}
        </div>
    );
};

// Main App Component
const App = () => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <AuthProvider>
            {isLoading && <LoadingScreen />}
            <Router>
                <ScrollToTop />
                <AppLayout />
            </Router>
        </AuthProvider>
    );
};

export default App;
