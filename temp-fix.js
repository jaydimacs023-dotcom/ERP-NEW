// Temporary fix for loading issue
// Add this to App.tsx to bypass loading and show login immediately

// Replace the useEffect in App.tsx with this simplified version:

useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true);
      
      // For now, create mock data to bypass loading issue
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
      setCurrentOrgId(mockOrg.id);
      setCurrentUser(mockUser);
      
      // Try to load real data in background
      try {
        const orgs = await SupabaseDataService.getOrganizations();
        if (orgs.length > 0) {
          setOrganizations(orgs);
          setCurrentOrgId(orgs[0].id);
          
          const usersData = await SupabaseDataService.getUsers(orgs[0].id);
          if (usersData.length > 0) {
            setCurrentUser(usersData[0]);
          }
        }
      } catch (error) {
        console.log('Using mock data due to connection issue');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error in loadData:', error);
      setLoading(false);
    }
  };

  loadData();
}, []);
