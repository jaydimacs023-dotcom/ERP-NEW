
import { IDataService, InitialData } from './IDataService';
import { MockDataService } from './MockDataService';

/**
 * SupabaseDataService
 * 
 * Future implementation for Cloud synchronization.
 * Currently serves as a graceful proxy to MockDataService to prevent app crashes
 * when Cloud mode is toggled without a live backend.
 */
export class SupabaseDataService implements IDataService {
  private mockFallback = new MockDataService();

  async getInitialData(): Promise<InitialData> {
    console.warn("[Supabase] ☁️ Cloud Data Service initialized in 'Simulated' mode.");
    console.info("[Supabase] Connect your real Supabase instance in 'services/SupabaseDataService.ts' to enable live persistence.");
    
    // Return mock data for now so the app initialization (useEffect) succeeds
    return this.mockFallback.getInitialData();
  }
}
