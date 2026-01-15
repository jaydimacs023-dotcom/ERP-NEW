import React, { useState, useEffect } from 'react';
import { Organization, User } from './types';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Simplified data loading
  useEffect(() => {
    console.log('App useEffect running');
    
    // Set mock data immediately to bypass loading
    const mockOrg: Organization = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'AccounTech Platform Host',
      currency: 'PHP',
      isVatRegistered: true,
      subscriptionStatus: 'ACTIVE',
      planType: 'PROFESSIONAL',
      licenseExpiry: '2026-12-31',
      createdAt: new Date().toISOString(),
      primaryColor: '#4f46e5'
    };

    const mockUser: User = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'System Administrator',
      email: 'admin@accountech.io',
      role: 'SYSTEM_ADMIN',
      orgId: mockOrg.id
    };

    setOrganizations([mockOrg]);
    setCurrentUser(mockUser);
    setLoading(false);
    
    console.log('Mock data set, loading false');
  }, []);

  const showNotify = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  console.log('App rendering, loading:', loading, 'currentUser:', currentUser);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AT-ERP...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Login Required</h1>
          <p className="text-gray-600">Please log in to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">AT-ERP Dashboard</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Welcome, {currentUser.name}!</h2>
          <p className="text-gray-600">Organization: {organizations[0]?.name}</p>
          <p className="text-gray-600">Role: {currentUser.role}</p>
          <p className="text-gray-600">Email: {currentUser.email}</p>
        </div>
        
        {/* Toast notifications */}
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3">
          {toasts.map(toast => (
            <div key={toast.id} className={`p-4 rounded-lg shadow-lg ${
              toast.type === 'success' ? 'bg-green-500 text-white' : 
              toast.type === 'error' ? 'bg-red-500 text-white' : 
              'bg-blue-500 text-white'
            }`}>
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
